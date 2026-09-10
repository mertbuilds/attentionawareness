import { z } from 'zod';

/**
 * Shared form input schemas. Custom messages are Paraglide message KEYS,
 * resolved to localized text at render time via `messageForValidation` in
 * `errors.ts` — never English prose here.
 *
 * Auth endpoints are owned by Better Auth (not oRPC), so these schemas live
 * with the web app. If an oRPC procedure ever takes the same input, move the
 * schema to `packages/api` and import it here instead.
 *
 * Password minimum matches Better Auth's default `minPasswordLength` (8) in
 * `apps/api/src/auth.ts`.
 */
export const emailSchema = z.email('error_email_invalid');

export const passwordSchema = z.string().min(8, 'error_password_too_short');

export const nameSchema = z.string().trim().min(1, 'error_name_required');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});
