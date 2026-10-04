import { describe, expect, it } from 'vitest';
import { authErrorKey, validateSignUp } from './authErrors';

describe('authErrorKey', () => {
  it('maps Firebase codes to messages without revealing which part was wrong', () => {
    expect(authErrorKey({ code: 'auth/user-not-found' })).toBe('err.invalidCredential');
    expect(authErrorKey({ code: 'auth/wrong-password' })).toBe('err.invalidCredential');
    expect(authErrorKey({ code: 'auth/email-already-in-use' })).toBe('err.emailInUse');
    expect(authErrorKey({ code: 'auth/network-request-failed' })).toBe('err.network');
  });

  it('falls back to a generic message', () => {
    expect(authErrorKey({ code: 'auth/something-new' })).toBe('err.generic');
    expect(authErrorKey(new Error('boom'))).toBe('err.generic');
    expect(authErrorKey(null)).toBe('err.generic');
  });
});

describe('validateSignUp', () => {
  it('needs a name, a long enough password, and a matching confirmation', () => {
    expect(validateSignUp(' ', 'longenough', 'longenough')).toBe('err.nameRequired');
    expect(validateSignUp('Asha', 'short', 'short')).toBe('err.passwordShort');
    expect(validateSignUp('Asha', 'longenough', 'different1')).toBe('err.passwordMismatch');
    expect(validateSignUp('Asha', 'longenough', 'longenough')).toBeNull();
  });
});
