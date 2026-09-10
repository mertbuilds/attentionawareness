import { create, props } from '@stylexjs/stylex';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@web-starter/ui';
import { colors, font, spacing } from '@web-starter/ui/tokens.stylex';
import { useState } from 'react';
import { authClient } from '../lib/auth.ts';
import { messageForError } from '../lib/errors.ts';
import { api } from '../lib/orpc.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/dashboard')({
  // Client-only: session lives in an api-domain cookie the SSR pass cannot
  // forward, so auth checks and data loads must run in the browser.
  ssr: false,
  // oxlint-disable-next-line sort-keys -- keep ssr above the handlers it governs
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: '/login' });
    }
    return { session: data };
  },
  component: DashboardPage,
  loader: async () => {
    const [me, subscription] = await Promise.all([api.me(), api.billing.subscription()]);
    return { me, subscription };
  },
});

const styles = create({
  error: {
    color: colors.error,
    fontSize: font.sizeSm,
    margin: 0,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
  main: {
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s4,
    marginInline: 'auto',
    maxWidth: 640,
    minHeight: '100vh',
    paddingBlock: spacing.s8,
    paddingInline: spacing.s4,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightBold,
    margin: 0,
    textWrap: 'balance',
  },
});

function DashboardPage() {
  const navigate = useNavigate();
  const { me, subscription } = Route.useLoaderData();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubscribe() {
    setError(null);
    setPending(true);
    // Relative URLs resolve against the api origin (Better Auth baseURL), so build absolute web URLs.
    const result = await authClient.subscription.upgrade({
      cancelUrl: `${globalThis.location.origin}/dashboard`,
      plan: 'pro',
      successUrl: `${globalThis.location.origin}/dashboard`,
    });
    setPending(false);
    if (result.error) {
      setError(messageForError(result.error));
    }
  }

  async function onLogout() {
    await authClient.signOut();
    void navigate({ to: '/' });
  }

  return (
    <main {...props(styles.main)}>
      <div {...props(styles.header)}>
        <h1 {...props(styles.title)}>{m.dashboard_title()}</h1>
        <Button onClick={onLogout} variant="outline">
          {m.auth_logout()}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{m.dashboard_account_title()}</CardTitle>
          <CardDescription>{m.dashboard_signed_in_as({ email: me.email })}</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{m.billing_title()}</CardTitle>
          <CardDescription>
            {subscription ? m.billing_plan_pro() : m.billing_status_none()}
          </CardDescription>
          {subscription ? (
            <CardAction>
              <Badge>{subscription.status}</Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        {error === null ? null : (
          <CardContent>
            <p role="alert" {...props(styles.error)}>
              {error}
            </p>
          </CardContent>
        )}
        {subscription ? null : (
          <CardFooter>
            <Button disabled={pending} onClick={onSubscribe}>
              {m.billing_subscribe()}
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
