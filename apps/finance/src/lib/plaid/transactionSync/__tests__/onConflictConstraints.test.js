/**
 * Guard: every `onConflict` upsert target in the Plaid transaction-sync
 * pipeline must be backed by a real UNIQUE constraint declared in the
 * Supabase migrations.
 *
 * --- Why this test exists -------------------------------------------------
 * Commit 4d6ee68 changed the system_categories seed upsert to
 *   .upsert(rows, { onConflict: 'label,group_id', ignoreDuplicates: true })
 * on the assumption that a composite unique constraint on (label, group_id)
 * existed. It never did — no migration ever created it. Postgres rejects any
 * ON CONFLICT whose columns don't match a unique constraint (error 42P10:
 * "no unique or exclusion constraint matching the ON CONFLICT specification").
 *
 * The bug was latent: ensureSystemCategories only runs the upsert when a
 * brand-new category needs seeding, so it lay dormant for months and then
 * hard-stalled transaction sync for any user whose new transactions
 * introduced an unseen category. The existing regression test only exercised
 * the pure planning helper (getNewSystemCategories) against a mock, so it
 * could never see the broken conflict target.
 *
 * This test closes that gap by cross-checking the *code* against the *schema*
 * with no database required: it parses the migration SQL for unique
 * constraints and asserts each onConflict target in the sync code is covered.
 * If someone adds or changes an onConflict to an unbacked target — or drops
 * the constraint — CI fails before deploy.
 */
const fs = require('fs');
const path = require('path');

// __dirname = .../apps/finance/src/lib/plaid/transactionSync/__tests__
const SYNC_DIR = path.resolve(__dirname, '..');
const FINANCE_ROOT = path.resolve(__dirname, '../../../../..');
const MIGRATIONS_DIR = path.join(FINANCE_ROOT, 'supabase/migrations');

/** Strip `-- line` and block comments so commented-out DDL doesn't count. */
function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

/** Normalize a comma-separated column list into a stable, order-independent key. */
function colsKey(colsStr) {
  return colsStr
    .split(',')
    .map((c) => c.trim().toLowerCase().replace(/"/g, ''))
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * Scan every migration file and collect the set of unique constraints as
 * `${table}::${sortedCols}` keys. Recognizes the three shapes used in this
 * codebase: ALTER TABLE ... ADD CONSTRAINT ... UNIQUE, CREATE UNIQUE INDEX,
 * and inline `constraint <name> unique (...)` within a CREATE TABLE block.
 */
function collectUniqueConstraintsFromMigrations() {
  const keys = new Set();
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

  for (const file of files) {
    const sql = stripSqlComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

    // 1) ALTER TABLE [public.]<table> ... ADD CONSTRAINT <name> UNIQUE (<cols>)
    const alterRe =
      /alter\s+table\s+(?:public\.)?(\w+)[\s\S]*?add\s+constraint\s+\w+\s+unique\s*\(([^)]+)\)/gi;
    for (const m of sql.matchAll(alterRe)) {
      keys.add(`${m[1].toLowerCase()}::${colsKey(m[2])}`);
    }

    // 2) CREATE UNIQUE INDEX [IF NOT EXISTS] <name> ON [public.]<table> [USING ...] (<cols>)
    const idxRe =
      /create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?\w+\s+on\s+(?:public\.)?(\w+)\s*(?:using\s+\w+\s*)?\(([^)]+)\)/gi;
    for (const m of sql.matchAll(idxRe)) {
      keys.add(`${m[1].toLowerCase()}::${colsKey(m[2])}`);
    }

    // 3) Inline `constraint <name> unique (<cols>)` — associate with the
    //    nearest preceding CREATE TABLE [public.]<table>.
    const tableStarts = [
      ...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi),
    ];
    for (const m of sql.matchAll(/constraint\s+\w+\s+unique\s*\(([^)]+)\)/gi)) {
      const owner = tableStarts.filter((t) => t.index < m.index).pop();
      if (owner) keys.add(`${owner[1].toLowerCase()}::${colsKey(m[1])}`);
    }
  }
  return keys;
}

/**
 * Scan the sync code for `.upsert(..., { onConflict: '<cols>' })` calls and
 * pair each with its owning `.from('<table>')` (nearest preceding in source).
 * Returns [{ table, cols, file }].
 */
function collectOnConflictTargetsFromCode() {
  const targets = [];
  const files = fs.readdirSync(SYNC_DIR).filter((f) => /\.(ts|js)$/.test(f));

  for (const file of files) {
    const code = fs.readFileSync(path.join(SYNC_DIR, file), 'utf8');
    const fromMatches = [...code.matchAll(/\.from\(\s*['"]([\w]+)['"]\s*\)/g)];
    for (const oc of code.matchAll(/onConflict:\s*['"]([^'"]+)['"]/g)) {
      const owner = fromMatches.filter((f) => f.index < oc.index).pop();
      targets.push({ table: owner ? owner[1] : null, cols: oc[1], file });
    }
  }
  return targets;
}

describe('Plaid sync onConflict targets are backed by unique constraints', () => {
  const uniqueConstraints = collectUniqueConstraintsFromMigrations();
  const onConflictTargets = collectOnConflictTargetsFromCode();

  it('finds the sync code and migration sources', () => {
    // Sanity: if these are empty the scanners are pointed at the wrong path
    // and every other assertion would vacuously pass.
    expect(fs.existsSync(SYNC_DIR)).toBe(true);
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(onConflictTargets.length).toBeGreaterThan(0);
    expect(uniqueConstraints.size).toBeGreaterThan(0);
  });

  it('every onConflict target maps to a real .from() table', () => {
    for (const t of onConflictTargets) {
      expect(t.table).not.toBeNull();
    }
  });

  it.each(
    // de-dupe identical (table, cols) pairs for readable test names
    [...new Map(onConflictTargets.map((t) => [`${t.table}(${t.cols})`, t])).values()]
  )('onConflict %s is backed by a UNIQUE constraint in migrations', (t) => {
    const key = `${String(t.table).toLowerCase()}::${colsKey(t.cols)}`;
    expect(uniqueConstraints.has(key)).toBe(true);
  });

  it('regression: system_categories(label, group_id) constraint exists (incident 2026-06-19)', () => {
    // The exact constraint whose absence stalled transaction sync.
    expect(uniqueConstraints.has(`system_categories::${colsKey('group_id,label')}`)).toBe(true);
  });
});
