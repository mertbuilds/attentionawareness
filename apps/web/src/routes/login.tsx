import { props } from '@stylexjs/stylex';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@web-starter/ui';
import { authClient } from '../lib/auth.ts';
import { serverErrorToFormErrors } from '../lib/errors.ts';
import { useAppForm } from '../lib/form.tsx';
import { layout } from '../lib/layout.ts';
import { loginSchema } from '../lib/schemas.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
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
      onChange: loginSchema,
      onSubmit: loginSchema,
      // The mutation IS the async submit validator: server errors return as
      // { form?, fields? } and render through the same channel as zod errors.
      onSubmitAsync: async ({ value }) => {
        const result = await authClient.signIn.email({
          email: value.email,
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
          <CardTitle>{m.auth_login_title()}</CardTitle>
          <CardDescription>{m.auth_login_description()}</CardDescription>
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
              <form.SubmitButton label={m.auth_login_submit()} />
            </form.AppForm>
          </form>
        </CardContent>
        <CardFooter>
          <p {...props(layout.muted)}>
            {m.auth_no_account()} <Link to="/signup">{m.auth_signup_title()}</Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
