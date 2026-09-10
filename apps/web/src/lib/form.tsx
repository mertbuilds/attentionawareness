import { Button, Field, FieldError, FieldLabel, Input } from '@keepyourattention/ui';
import { colors, font, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { messageForValidation } from './errors.ts';

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

const styles = create({
  formError: {
    color: colors.error,
    fontSize: font.sizeSm,
  },
  submitRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing.s3,
  },
});

/**
 * Resolves a field's error array to one localized string. Handles both
 * shapes that land in `field.state.meta.errors`:
 * - zod Standard Schema issues (objects whose `message` is a Paraglide KEY,
 *   resolved via messageForValidation), and
 * - plain strings returned by `onSubmitAsync` (already localized server
 *   errors from serverErrorToFormErrors).
 */
function resolveFieldError(errors: ReadonlyArray<unknown>): string | undefined {
  const first = errors[0];
  if (first === undefined) {
    return undefined;
  }
  if (typeof first === 'string') {
    return first;
  }
  return messageForValidation([first]);
}

function TextField({
  label,
  placeholder,
  type,
}: {
  label: string;
  placeholder?: string | undefined;
  type?: 'email' | 'password' | 'text';
}) {
  const field = useFieldContext<string>();
  const error = field.state.meta.isTouched ? resolveFieldError(field.state.meta.errors) : undefined;
  return (
    <Field data-invalid={error !== undefined || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-invalid={error !== undefined || undefined}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        type={type ?? 'text'}
        value={field.state.value}
      />
      {error === undefined ? null : <FieldError role="alert">{error}</FieldError>}
    </Field>
  );
}

/**
 * Renders the form-level error set by an `onSubmitAsync` validator returning
 * `{ form: '...' }` (e.g. a server error with no single field). zod form
 * validators put a Record here instead — only strings are rendered.
 */
function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) =>
        typeof error === 'string' ? (
          <p role="alert" {...props(styles.formError)}>
            {error}
          </p>
        ) : null
      }
    </form.Subscribe>
  );
}

function SubmitButton({ label }: { label: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <div {...props(styles.submitRow)}>
          <Button disabled={isSubmitting} type="submit">
            {label}
          </Button>
        </div>
      )}
    </form.Subscribe>
  );
}

/**
 * App-wide form hook. Fields render through `form.AppField` +
 * `field.TextField`; the form-level server error and submit button render
 * through `form.AppForm` + `form.FormError` / `form.SubmitButton`.
 * Server calls belong in `validators.onSubmitAsync` returning
 * `serverErrorToFormErrors(error)` — see AGENTS.md Forms.
 */
export const { useAppForm } = createFormHook({
  fieldComponents: { TextField },
  fieldContext,
  formComponents: { FormError, SubmitButton },
  formContext,
});
