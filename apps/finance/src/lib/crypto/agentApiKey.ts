/**
 * AI agent API key (BYOK) encryption helpers.
 *
 * Users supply their own Anthropic API key to power the personal agent. We
 * never store these in plaintext — same AES-256-GCM scheme as Plaid tokens
 * (see plaidTokens.ts for the full design rationale). Reusing the same env
 * var (PLAID_TOKEN_ENCRYPTION_KEY) means one key to rotate, one secret to
 * manage. The name is historical at this point — it's the platform's
 * at-rest encryption key, not Plaid-specific.
 *
 * Encoding: `v1:{iv_b64}:{tag_b64}:{ciphertext_b64}`
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'PLAID_TOKEN_ENCRYPTION_KEY is not set — refusing to (de)crypt agent API keys.'
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
        'PLAID_TOKEN_ENCRYPTION_KEY must be 64 hex chars or base64 that decodes to 32 bytes'
      );
    }
  }

  if (key.length !== 32) {
    throw new Error(
      `PLAID_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`
    );
  }

  cachedKey = key;
  return key;
}

export function isEncryptedAgentApiKey(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${VERSION}:`);
}

export function encryptAgentApiKey(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty agent API key');
  }
  if (isEncryptedAgentApiKey(plaintext)) {
    return plaintext;
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptAgentApiKey(stored: string | null | undefined): string {
  if (!stored) {
    throw new Error('Cannot decrypt empty agent API key');
  }
  if (!isEncryptedAgentApiKey(stored)) {
    throw new Error('Stored agent API key is not encrypted (missing v1: prefix)');
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted agent API key: expected 4 parts');
  }
  const [, ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error(`Malformed encrypted agent API key: IV must be ${IV_BYTES} bytes`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Malformed encrypted agent API key: tag must be ${TAG_BYTES} bytes`);
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
 * Mask an API key for display (e.g. `sk-ant-...XYZ4`). Show last 4 chars only.
 */
export function maskAgentApiKey(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) return '••••';
  return `${plaintext.slice(0, 7)}…${plaintext.slice(-4)}`;
}
