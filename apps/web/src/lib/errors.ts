import { m } from '../paraglide/messages.js';

const messagesByCode: Record<string, () => string> = {
  INVALID_EMAIL_OR_PASSWORD: () => m.error_invalid_credentials(),
  INVALID_INPUT: () => m.error_invalid_input(),
  NOT_FOUND: () => m.error_not_found(),
  UNAUTHORIZED: () => m.error_unauthorized(),
  USER_ALREADY_EXISTS: () => m.error_user_already_exists(),
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: () => m.error_user_already_exists(),
};

/**
 * Field a server error code belongs to, so forms can render it inline next to
 * the offending input instead of a generic banner. Codes not listed here have
 * no single field — show them at form level.
 */
const fieldByCode: Record<string, 'email' | 'password'> = {
  INVALID_EMAIL_OR_PASSWORD: 'password',
  USER_ALREADY_EXISTS: 'email',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'email',
};

export function fieldForError(error: unknown): 'email' | 'password' | undefined {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : null;
  return code ? fieldByCode[code] : undefined;
}

/**
 * Maps a stable machine error code (oRPC typed errors, Better Auth error
 * codes) to a localized user-facing message. Unknown codes fall back to a
 * generic message — never show raw codes or server prose to users.
 */
export function messageForError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : null;
  if (code && code in messagesByCode) {
    return messagesByCode[code]!();
  }
  return m.error_unknown();
}

/**
 * Maps a server error (Better Auth / oRPC, identified by stable `code`) to
 * the shape TanStack Form's `onSubmitAsync` validator returns: field-mapped
 * codes become localized messages on their field, everything else becomes a
 * form-level message. One seam for all forms — new codes only touch
 * `messagesByCode` / `fieldByCode` above plus `messages/en.json`.
 */
export function serverErrorToFormErrors(error: unknown): {
  fields?: Record<string, string>;
  form?: string;
} {
  const message = messageForError(error);
  const field = fieldForError(error);
  if (field !== undefined) {
    return { fields: { [field]: message } };
  }
  return { form: message };
}

const validationMessagesByKey: Record<string, () => string> = {
  error_email_invalid: () => m.error_email_invalid(),
  error_name_required: () => m.error_name_required(),
  error_password_too_short: () => m.error_password_too_short(),
};

/**
 * Maps a validation message KEY (set as the custom message in the zod schemas
 * in `schemas.ts`) to its localized text. Unknown keys fall back to the
 * generic invalid-input message.
 */
export function messageForValidation(issues: ReadonlyArray<unknown>): string | undefined {
  const first = issues[0];
  const key =
    typeof first === 'object' && first !== null && 'message' in first
      ? String((first as { message: unknown }).message)
      : undefined;
  if (key === undefined) {
    return undefined;
  }
  if (key in validationMessagesByKey) {
    return validationMessagesByKey[key]!();
  }
  return m.error_invalid_input();
}
