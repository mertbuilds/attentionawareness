import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@keepyourattention/ui';
import { props } from '@stylexjs/stylex';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { authClient } from '../lib/auth.ts';
import { serverErrorToFormErrors } from '../lib/errors.ts';
import { useAppForm } from '../lib/form.tsx';
import { layout } from '../lib/layout.ts';
import { signupSchema } from '../lib/schemas.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();

  const form = useAppForm({
    defaultValues: { email: '', name: '', password: '' },
    // Runs only when every validator (including the server call) passed.
    onSubmit: () => {
      void navigate({ to: '/dashboard' });
    },
    validators: {
      // No onBlur validator: a form-level blur run stamps errors on still-empty
      // fields, and onBlur-cause errors only clear on the NEXT blur — leaving
      // stale errors that also shift layout mid-click (a blur between mousedown
      // and mouseup moves the button and the click is lost). onChange-cause
      // errors clear live as typing fixes them; display stays gated on
      // isTouched in TextField.
      onChange: signupSchema,
      onSubmit: signupSchema,
      // The mutation IS the async submit validator: server errors return as
      // { form?, fields? } and render through the same channel as zod errors.
      onSubmitAsync: async ({ value }) => {
        const result = await authClient.signUp.email({
          email: value.email,
          name: value.name,
          password: value.password,
        });
        return result.error ? serverErrorToFormErrors(result.error) : null;
      },
    },
  });

  return (
    <main {...props(layout.centered)}>
      <Card style={layout.fullWidth}>
        <CardHeader>
          <CardTitle>{m.auth_signup_title()}</CardTitle>
          <CardDescription>{m.auth_signup_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            {...props(layout.formColumn)}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label={m.auth_name_label()}
                  placeholder={m.auth_name_placeholder()}
                />
              )}
            </form.AppField>
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  label={m.auth_email_label()}
                  placeholder={m.auth_email_placeholder()}
                  type="email"
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={m.auth_password_label()}
                  placeholder={m.auth_password_placeholder()}
                  type="password"
                />
              )}
            </form.AppField>
            <form.AppForm>
              <form.FormError />
              <form.SubmitButton label={m.auth_signup_submit()} />
            </form.AppForm>
          </form>
        </CardContent>
        <CardFooter>
          <p {...props(layout.muted)}>
            {m.auth_have_account()} <Link to="/login">{m.auth_login_title()}</Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
