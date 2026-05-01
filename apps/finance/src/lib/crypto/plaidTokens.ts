/**
 * Plaid access-token encryption helpers.
 *
 * Plaid access tokens are long-lived bearer credentials to a user's bank.
 * Historically we stored them plaintext in Postgres; this module encrypts
 * them at rest with AES-256-GCM so a DB leak alone cannot impersonate the
 * bank connection.
 *
 * Encoding: `v1:{iv_b64}:{tag_b64}:{ciphertext_b64}`
 *   - v1:           version prefix so we can rotate the scheme later
 *   - iv  (12 B):   GCM nonce, randomBytes per encrypt call
 *   - tag (16 B):   GCM authentication tag
 *   - ciphertext:   AES-256-GCM of the UTF-8 plaintext token
 *
 * Key: `PLATFORM_ENCRYPTION_KEY` (legacy fallback: `PLAID_TOKEN_ENCRYPTION_KEY`)
 *   — must decode to exactly 32 bytes. The same key also protects
 *   `platform_config` secrets (admin-managed Anthropic API key, etc) —
 *   one platform-wide AES-256-GCM key, multiple consumers.
 *   - 64 hex chars (preferred), or
 *   - 44 char base64 (no padding/or with)
 * Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 *
 * Legacy-compat: `decryptPlaidToken` passes through any string that does NOT
 * start with `v1:`. This keeps the deployment race-safe — we can ship the
 * encrypt-on-write code before the backfill has touched existing rows, and
 * those rows continue to work until the backfill runs. Once the backfill
 * completes in prod, the `isEncryptedPlaidToken` check in the backfill
 * script asserts every row is encrypted.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  // Prefer PLATFORM_ENCRYPTION_KEY (the canonical name — this key protects
  // Plaid tokens AND platform_config secrets, despite the legacy name).
  // Fall back to PLAID_TOKEN_ENCRYPTION_KEY so existing deployments keep
  // working through the rename without re-encrypting any data.
  const raw =
    process.env.PLATFORM_ENCRYPTION_KEY ?? process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'PLATFORM_ENCRYPTION_KEY (or legacy PLAID_TOKEN_ENCRYPTION_KEY) is not set — ' +
        'refusing to (de)crypt at-rest secrets. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Accept hex (64 chars) or base64 (44 chars with `=` padding, 43 without).
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    try {
      key = Buffer.from(raw, 'base64');
    } catch {
      throw new Error(
        'PLATFORM_ENCRYPTION_KEY must be 64 hex chars or base64 that decodes to 32 bytes'
      );
    }
  }

  if (key.length !== 32) {
    throw new Error(
      `PLATFORM_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`
    );
  }

  cachedKey = key;
  return key;
}

export function isEncryptedPlaidToken(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${VERSION}:`);
}

/**
 * Encrypt a plaintext Plaid access token. Idempotent: if the input is
 * already encrypted (has the `v1:` prefix), it is returned unchanged. This
 * lets write sites call `encryptPlaidToken` unconditionally without worrying
 * about double-encryption in edge cases (e.g. copying a token row-to-row).
 */
export function encryptPlaidToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty Plaid token');
  }
  if (isEncryptedPlaidToken(plaintext)) {
    return plaintext;
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt a stored Plaid access token for outbound use with the Plaid SDK.
 *
 * - If the stored value has the `v1:` prefix, it is decrypted and returned.
 * - If it does not, it is treated as a legacy plaintext token and returned
 *   unchanged. This allows rollout before backfill completes.
 *
 * Throws if the stored value has our prefix but cannot be decrypted (wrong
 * key, corrupt ciphertext, tampered auth tag). Never silently fall back to
 * the raw string in that case — an unverified token is worse than failing.
 */
export function decryptPlaidToken(stored: string | null | undefined): string {
  if (!stored) {
    throw new Error('Cannot decrypt empty Plaid token');
  }
  if (!isEncryptedPlaidToken(stored)) {
    // Legacy plaintext — pass through until backfill runs.
    return stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted Plaid token: expected 4 parts');
  }
  const [, ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error(`Malformed encrypted Plaid token: IV must be ${IV_BYTES} bytes`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Malformed encrypted Plaid token: tag must be ${TAG_BYTES} bytes`);
  }

  const key = loadKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8'
  );
  return plaintext;
}

/**
 * Test-only: reset the cached key. Never call this from production code.
 */
export function __resetPlaidTokenKeyForTests(): void {
  cachedKey = null;
}
