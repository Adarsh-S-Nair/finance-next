import {
  DEAD_ITEM_ERROR_CODES,
  extractPlaidErrorCode,
  isDeadItemError,
} from '../errors';

describe('isDeadItemError', () => {
  it.each(DEAD_ITEM_ERROR_CODES)(
    'returns true for the %s code',
    (code) => {
      expect(isDeadItemError(code)).toBe(true);
    }
  );

  it('returns false for an unknown error code', () => {
    expect(isDeadItemError('SOMETHING_ELSE')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isDeadItemError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDeadItemError(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isDeadItemError('')).toBe(false);
  });

  it('is case-sensitive — lowercase variants are not matched', () => {
    // Plaid error codes are upper snake case. We never want to accept a
    // lowercase variant by accident.
    expect(isDeadItemError('item_not_found')).toBe(false);
  });
});

describe('extractPlaidErrorCode', () => {
  it('extracts error_code from a Plaid SDK error shape', () => {
    const err = {
      response: {
        data: { error_code: 'ITEM_NOT_FOUND', error_message: 'item not found' },
      },
    };
    expect(extractPlaidErrorCode(err)).toBe('ITEM_NOT_FOUND');
  });

  it('returns null for a plain Error instance', () => {
    expect(extractPlaidErrorCode(new Error('boom'))).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractPlaidErrorCode(null)).toBeNull();
    expect(extractPlaidErrorCode(undefined)).toBeNull();
  });

  it('returns null when response.data is missing', () => {
    expect(extractPlaidErrorCode({ response: {} })).toBeNull();
  });

  it('returns null when the shape is a string', () => {
    expect(extractPlaidErrorCode('ITEM_NOT_FOUND')).toBeNull();
  });
});
