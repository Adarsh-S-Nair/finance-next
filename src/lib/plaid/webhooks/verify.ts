/**
 * Plaid webhook signature verification.
 *
 * Plaid signs webhooks as ES256 JWTs, with the request body SHA-256 hash
 * embedded as a claim. We verify:
 *   1. JWT header uses the ES256 algorithm.
 *   2. The signing key (identified by `kid`) matches Plaid's published
 *      verification key.
 *   3. The `request_body_sha256` claim matches the hash of the actual
 *      payload bytes.
 *   4. The `iat` claim is within MAX_WEBHOOK_AGE_SECONDS of now.
 *
 * The pure helpers are exported for direct unit-testing — the network call
 * to Plaid's key endpoint is isolated inside `verifyWebhookSignature` which
 * uses them.
 */

import crypto from 'crypto';
import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import type { WebhookLogger } from './types';

/**
 * Maximum age (in seconds) of a webhook's `iat` claim before we reject it
 * as stale. Matches legacy behavior.
 */
export const MAX_WEBHOOK_AGE_SECONDS = 300;

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------

/**
 * Decode the header portion of a JWT without verifying it. Used to read
 * the `alg` and `kid` claims so we know which key to fetch.
 *
 * Returns null on any parse failure (malformed JWT, invalid base64, etc.).
 */
export function parseJwtHeader(
  signature: string
): { alg: string; kid: string } | null {
  try {
    const [headerPart] = signature.split('.');
    if (!headerPart) return null;
    const parsed = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
    if (typeof parsed?.alg !== 'string' || typeof parsed?.kid !== 'string') return null;
    return { alg: parsed.alg, kid: parsed.kid };
  } catch {
    return null;
  }
}

/** SHA-256 of the raw payload, hex-encoded. Matches Plaid's `request_body_sha256`. */
export function hashPayload(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Is the webhook too old to trust? `iatSeconds` is the `iat` claim from
 * the verified JWT (in unix seconds); `nowSeconds` is the current time
 * (defaults to `Date.now() / 1000`, injectable for tests).
 */
export function isWebhookTooOld(
  iatSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  return nowSeconds - iatSeconds > MAX_WEBHOOK_AGE_SECONDS;
}

// ---------------------------------------------------------------------------
// IO: the one public entry point
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  payload: string;
  signature: string | null;
  logger: WebhookLogger;
}

/**
 * Verify a Plaid webhook. Returns true if the webhook is authentic and
 * recent, false otherwise. Never throws — logs context on failure.
 *
 * Legacy behavior quirk: if no signature is present at all, this returns
 * `true` to preserve the "allow in development" fallback. Production
 * deployments that care about end-to-end authenticity should require the
 * signature at the route level.
 */
export async function verifyWebhookSignature({
  payload,
  signature,
  logger,
}: VerifyOptions): Promise<boolean> {
  try {
    if (!signature) {
      logger.warn('No Plaid-Verification header found, skipping verification');
      return true;
    }

    const header = parseJwtHeader(signature);
    if (!header) {
      logger.error('Unable to parse JWT header from webhook signature');
      return false;
    }
    if (header.alg !== 'ES256') {
      logger.error('Invalid algorithm in webhook signature', null, { algorithm: header.alg });
      return false;
    }

    // Fetch Plaid's public key for this kid.
    const response = await fetch('https://production.plaid.com/webhook_verification_key/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
        'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
      },
      body: JSON.stringify({ key_id: header.kid }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch verification key', null, {
        status: response.status,
        error: errorText,
      });
      return false;
    }

    const { key } = (await response.json()) as {
      key: { kty: string; crv: string; x: string; y: string; use?: string };
    };

    // JWK → PEM (via node's native JWK support).
    const publicKey = createPublicKey({
      key: {
        kty: key.kty,
        crv: key.crv,
        x: key.x,
        y: key.y,
        use: key.use,
      },
      format: 'jwk',
    });

    const decoded = jwt.verify(signature, publicKey, {
      algorithms: ['ES256'],
    }) as jwt.JwtPayload & { request_body_sha256?: string };

    if (decoded.request_body_sha256 !== hashPayload(payload)) {
      logger.error('Payload hash mismatch in webhook verification');
      return false;
    }

    if (typeof decoded.iat !== 'number' || isWebhookTooOld(decoded.iat)) {
      logger.error('Webhook is too old', null, {
        age: decoded.iat ? Math.floor(Date.now() / 1000) - decoded.iat : null,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Webhook verification failed', error as Error);
    return false;
  }
}
