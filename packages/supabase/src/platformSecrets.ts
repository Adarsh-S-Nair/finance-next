/**
 * Platform-secret encryption helpers used by both apps to read/write
 * `platform_config` rows where `is_secret = true`. Uses the platform-wide
 * AES-256-GCM key — same key that protects Plaid access tokens. One key
 * to rotate, one secret to manage.
 *
 * Env var: `PLATFORM_ENCRYPTION_KEY` (legacy fallback: `PLAID_TOKEN_ENCRYPTION_KEY`).
 * Encoding: `v1:{iv_b64}:{tag_b64}:{ciphertext_b64}` (matches plaidTokens).
 *
 * Server-side only. Never imported from client components.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  // Prefer the canonical name; fall back to the legacy `PLAID_TOKEN_*`
  // alias so deployments mid-rename keep decrypting cleanly.
  const raw =
    process.env.PLATFORM_ENCRYPTION_KEY ?? process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'PLATFORM_ENCRYPTION_KEY (or legacy PLAID_TOKEN_ENCRYPTION_KEY) is not set — ' +
        'refusing to (de)crypt platform secrets.'
    );
  }

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

export function isEncryptedPlatformSecret(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${VERSION}:`);
}

export function encryptPlatformSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty platform secret');
  }
  if (isEncryptedPlatformSecret(plaintext)) {
    return plaintext;
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptPlatformSecret(stored: string | null | undefined): string {
  if (!stored) {
    throw new Error('Cannot decrypt empty platform secret');
  }
  if (!isEncryptedPlatformSecret(stored)) {
    throw new Error('Stored platform secret is not encrypted (missing v1: prefix)');
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted platform secret: expected 4 parts');
  }
  const [, ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error(`Malformed encrypted platform secret: IV must be ${IV_BYTES} bytes`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Malformed encrypted platform secret: tag must be ${TAG_BYTES} bytes`);
  }

  const key = loadKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Display-safe representation of a stored secret. Decrypts then truncates
 * to last-4 characters: `••••XYZ4`.
 */
export function maskPlatformSecret(plaintext: string): string {
  if (!plaintext || plaintext.length < 4) return '••••';
  return `••••${plaintext.slice(-4)}`;
}
