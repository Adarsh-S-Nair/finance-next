import { supabaseAdmin } from '../supabase/admin';

/**
 * Reconciling a property's mortgage link. A property can either link to an
 * existing account (Plaid or otherwise) or have a manually-entered balance.
 *
 * A manually-entered balance is NOT just a number on the property — it's
 * mirrored into a real `is_manual` liability account so net worth keeps
 * counting it as a liability automatically (exactly like a Plaid mortgage).
 * That manual account is created/updated/cleaned-up here so callers don't
 * have to think about it.
 */

export class MortgageLinkError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface ResolveArgs {
  userId: string;
  propertyName: string;
  /** The property's currently-linked mortgage account id, or null on create. */
  currentLinkedAccountId: string | null;
  /** An existing account to link to (ignored when manualMortgageBalance is set). */
  linkedMortgageAccountId: string | null;
  /** A manually-entered remaining balance; when set, owns the link. */
  manualMortgageBalance: number | null;
}

interface ResolveResult {
  linkedId: string | null;
  /** Set when a new manual mortgage account was created, for rollback by callers. */
  createdAccountId: string | null;
}

export async function resolveMortgageLink(args: ResolveArgs): Promise<ResolveResult> {
  const {
    userId,
    propertyName,
    currentLinkedAccountId,
    linkedMortgageAccountId,
    manualMortgageBalance,
  } = args;

  // Is the currently-linked account a manual one we own? If so we may need to
  // update it (manual mode) or delete it (switching away / clearing).
  let currentManualId: string | null = null;
  if (currentLinkedAccountId) {
    const { data } = await supabaseAdmin
      .from('accounts')
      .select('id, is_manual')
      .eq('id', currentLinkedAccountId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.is_manual) currentManualId = data.id;
  }

  const wantsManual =
    manualMortgageBalance != null &&
    Number.isFinite(manualMortgageBalance) &&
    manualMortgageBalance >= 0;

  const nowISO = new Date().toISOString();
  // Named after the property only — it already lives under the Loans section,
  // so appending "mortgage" would be redundant.
  const mortgageName = (propertyName || 'Mortgage').slice(0, 120);

  if (wantsManual) {
    const balance = manualMortgageBalance as number;
    // Update the existing manual account in place...
    if (currentManualId) {
      await supabaseAdmin
        .from('accounts')
        .update({ balances: { current: balance }, name: mortgageName })
        .eq('id', currentManualId)
        .eq('user_id', userId);
      await supabaseAdmin
        .from('account_snapshots')
        .insert({ account_id: currentManualId, current_balance: balance, recorded_at: nowISO });
      return { linkedId: currentManualId, createdAccountId: null };
    }
    // ...or create a fresh manual liability account. subtype 'mortgage' makes
    // net worth treat it as a liability automatically.
    const { data: acc, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        user_id: userId,
        name: mortgageName,
        type: 'loan',
        subtype: 'mortgage',
        balances: { current: balance },
        is_manual: true,
        auto_sync: false,
      })
      .select('id')
      .single();
    if (error || !acc) throw new MortgageLinkError('Failed to save mortgage', 500);
    await supabaseAdmin
      .from('account_snapshots')
      .insert({ account_id: acc.id, current_balance: balance, recorded_at: nowISO });
    return { linkedId: acc.id, createdAccountId: acc.id };
  }

  // Linking an existing account, or clearing entirely.
  const target = linkedMortgageAccountId || null;
  if (target) {
    const { data: m } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', target)
      .eq('user_id', userId)
      .maybeSingle();
    if (!m) throw new MortgageLinkError('Linked mortgage account not found', 400);
  }

  // If we're moving off a manual account we created, delete it so it doesn't
  // linger as an orphan liability.
  if (currentManualId && currentManualId !== target) {
    await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', currentManualId)
      .eq('user_id', userId);
  }

  return { linkedId: target, createdAccountId: null };
}
