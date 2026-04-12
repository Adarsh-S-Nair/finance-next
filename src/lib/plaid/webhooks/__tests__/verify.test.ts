import crypto from 'crypto';
import {
  MAX_WEBHOOK_AGE_SECONDS,
  hashPayload,
  isWebhookTooOld,
  parseJwtHeader,
} from '../verify';

describe('parseJwtHeader', () => {
  function encodeHeader(obj: unknown): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
  }

  it('parses a valid ES256 header with a kid', () => {
    const header = encodeHeader({ alg: 'ES256', kid: 'abc123', typ: 'JWT' });
    const signature = `${header}.payload.sig`;
    expect(parseJwtHeader(signature)).toEqual({ alg: 'ES256', kid: 'abc123' });
  });

  it('returns null when the header is not valid base64url JSON', () => {
    expect(parseJwtHeader('not-a-jwt')).toBeNull();
    expect(parseJwtHeader('!!!.payload.sig')).toBeNull();
  });

  it('returns null when alg or kid is missing', () => {
    const noKid = `${encodeHeader({ alg: 'ES256' })}.x.y`;
    const noAlg = `${encodeHeader({ kid: 'abc' })}.x.y`;
    expect(parseJwtHeader(noKid)).toBeNull();
    expect(parseJwtHeader(noAlg)).toBeNull();
  });

  it('returns null for an empty signature', () => {
    expect(parseJwtHeader('')).toBeNull();
  });
});

describe('hashPayload', () => {
  it('matches Node crypto SHA-256 hex', () => {
    const payload = '{"webhook_type":"TRANSACTIONS"}';
    const expected = crypto.createHash('sha256').update(payload).digest('hex');
    expect(hashPayload(payload)).toBe(expected);
  });

  it('is deterministic', () => {
    const payload = 'anything';
    expect(hashPayload(payload)).toBe(hashPayload(payload));
  });

  it('differs for different payloads', () => {
    expect(hashPayload('a')).not.toBe(hashPayload('b'));
  });
});

describe('isWebhookTooOld', () => {
  it('returns false for a fresh webhook', () => {
    const now = 1_700_000_000;
    expect(isWebhookTooOld(now - 10, now)).toBe(false);
  });

  it('returns false at exactly the age boundary', () => {
    const now = 1_700_000_000;
    expect(isWebhookTooOld(now - MAX_WEBHOOK_AGE_SECONDS, now)).toBe(false);
  });

  it('returns true just past the age boundary', () => {
    const now = 1_700_000_000;
    expect(isWebhookTooOld(now - MAX_WEBHOOK_AGE_SECONDS - 1, now)).toBe(true);
  });

  it('uses Date.now when no reference is passed', () => {
    // This is the non-injected path — just make sure it doesn't throw and
    // returns sensible booleans for obviously-recent / obviously-stale iats.
    const recent = Math.floor(Date.now() / 1000) - 1;
    const ancient = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    expect(isWebhookTooOld(recent)).toBe(false);
    expect(isWebhookTooOld(ancient)).toBe(true);
  });
});
