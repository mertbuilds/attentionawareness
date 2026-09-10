import { describe, expect, it } from 'vitest';
import { m } from '../paraglide/messages.js';
import { fieldForError, messageForError, serverErrorToFormErrors } from './errors.ts';

describe('messageForError', () => {
  it('maps known oRPC codes to localized messages', () => {
    expect(messageForError({ code: 'UNAUTHORIZED' })).toBe(m.error_unauthorized());
    expect(messageForError({ code: 'INVALID_INPUT' })).toBe(m.error_invalid_input());
    expect(messageForError({ code: 'NOT_FOUND' })).toBe(m.error_not_found());
  });

  it('maps Better Auth codes', () => {
    expect(messageForError({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      m.error_invalid_credentials(),
    );
    expect(messageForError({ code: 'USER_ALREADY_EXISTS' })).toBe(m.error_user_already_exists());
    expect(messageForError({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe(
      m.error_user_already_exists(),
    );
  });

  it('maps server error codes to the field they belong to', () => {
    expect(fieldForError({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe('email');
    expect(fieldForError({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('password');
    expect(fieldForError({ code: 'SOMETHING_NEW' })).toBeUndefined();
    expect(fieldForError(null)).toBeUndefined();
  });

  it('converts server errors to TanStack Form { form, fields } shape', () => {
    expect(serverErrorToFormErrors({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toEqual({
      fields: { email: m.error_user_already_exists() },
    });
    expect(serverErrorToFormErrors({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toEqual({
      fields: { password: m.error_invalid_credentials() },
    });
    expect(serverErrorToFormErrors({ code: 'SOMETHING_NEW' })).toEqual({
      form: m.error_unknown(),
    });
  });

  it('falls back to the generic message for unknown codes and shapes', () => {
    expect(messageForError({ code: 'SOMETHING_NEW' })).toBe(m.error_unknown());
    expect(messageForError(new Error('boom'))).toBe(m.error_unknown());
    expect(messageForError(null)).toBe(m.error_unknown());
    expect(messageForError('nope')).toBe(m.error_unknown());
  });
});
