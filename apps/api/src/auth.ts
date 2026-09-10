import { stripe } from '@better-auth/stripe';
import { createDb, type Db } from '@web-starter/db';
import { parseServerEnv, type ServerEnv } from '@web-starter/env/server';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth, openAPI } from 'better-auth/plugins';
import Stripe from 'stripe';
import { recordStripeEvent } from './billing/events.ts';
import { getPlans } from './billing/plans.ts';

const DEV_SECRET = 'dev-secret-do-not-use-in-production';
const LOCAL_DATABASE_URL = 'postgresql://webstarter:webstarter@localhost:5433/webstarter';

/**
 * Splits STRIPE_API_BASE (e.g. http://localhost:4009) into the Stripe SDK's
 * host/port/protocol config so it talks to the emulate.dev Stripe emulator.
 */
function stripeHostOverrides(
  apiBase: string,
): Pick<Stripe.StripeConfig, 'host' | 'port' | 'protocol'> {
  const url = new URL(apiBase);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

type EmailPayload = {
  subject: string;
  text: string;
  to: string;
};

/**
 * Sends mail through Resend's REST API. A plain fetch (instead of the SDK)
 * so RESEND_API_BASE can point at the emulate.dev Resend emulator locally.
 */
async function sendEmail(env: ServerEnv, payload: EmailPayload): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn(`RESEND_API_KEY not set — skipping email "${payload.subject}" to ${payload.to}`);
    return;
  }
  const base = env.RESEND_API_BASE ?? 'https://api.resend.com';
  const response = await fetch(`${base}/emails`, {
    body: JSON.stringify({
      from: 'noreply@localhost',
      subject: payload.subject,
      text: payload.text,
      to: payload.to,
    }),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Resend request failed: ${response.status} ${await response.text()}`);
  }
}

export function createAuth(options: { db: Db; env: ServerEnv }) {
  const { db, env } = options;

  if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET is required in production.');
  }

  const webUrl = env.WEB_URL ?? 'http://localhost:3000';

  // Google's provider has hardcoded endpoints, so the emulate.dev Google
  // emulator is wired through genericOAuth + OIDC discovery instead.
  const useEmulatedGoogle = Boolean(env.GOOGLE_ISSUER_BASE);

  // Billing is optional: the starter boots without Stripe. STRIPE_API_BASE
  // points the SDK at the emulate.dev Stripe emulator locally.
  const stripeClient = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        ...(env.STRIPE_API_BASE && stripeHostOverrides(env.STRIPE_API_BASE)),
      })
    : null;

  const baseUrl = env.BETTER_AUTH_URL ?? 'http://localhost:3001';

  // Cookies must span web + api when they are sibling subdomains — in production
  // (app.x.com / api.x.com) and locally behind portless (web-starter.localhost /
  // api.web-starter.localhost). Plain localhost:port dev is same-site and needs nothing.
  const apiHost = new URL(baseUrl).hostname;
  const webHost = new URL(webUrl).hostname;
  const sharedParent =
    apiHost === webHost
      ? null
      : apiHost.endsWith(`.${webHost}`)
        ? webHost
        : webHost.endsWith(`.${apiHost}`)
          ? apiHost
          : apiHost.split('.').slice(-2).join('.') === webHost.split('.').slice(-2).join('.')
            ? apiHost.split('.').slice(-2).join('.')
            : null;

  return betterAuth({
    advanced: {
      ...(sharedParent && {
        // Explicit domain: Better Auth would otherwise scope the cookie to the api host.
        crossSubDomainCookies: { domain: `.${sharedParent}`, enabled: true },
      }),
    },
    baseURL: baseUrl,
    database: prismaAdapter(db, { provider: 'postgresql' }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.auditLog.create({
              data: {
                action: 'auth.user.create',
                entity: 'user',
                entityId: user.id,
                userId: user.id,
              },
            });
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ url, user }) => {
        await sendEmail(env, {
          subject: 'Reset your password',
          text: `Reset your password: ${url}`,
          to: user.email,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ url, user }) => {
        await sendEmail(env, {
          subject: 'Verify your email',
          text: `Verify your email: ${url}`,
          to: user.email,
        });
      },
    },
    plugins: [
      openAPI(),
      ...(stripeClient
        ? [
            stripe({
              createCustomerOnSignUp: true,
              onEvent: async (event) => {
                const isNew = await recordStripeEvent(db, event);
                if (!isNew) {
                  return;
                }
                // Custom per-event processing goes here (idempotent by guard).
              },
              stripeClient,
              stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
              subscription: {
                enabled: true,
                plans: getPlans(env).map((plan) => ({
                  name: plan.name,
                  priceId: plan.priceId,
                })),
              },
            }),
          ]
        : []),
      ...(useEmulatedGoogle && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? [
            genericOAuth({
              config: [
                {
                  clientId: env.GOOGLE_CLIENT_ID,
                  clientSecret: env.GOOGLE_CLIENT_SECRET,
                  discoveryUrl: `${env.GOOGLE_ISSUER_BASE}/.well-known/openid-configuration`,
                  providerId: 'google',
                  scopes: ['openid', 'email', 'profile'],
                },
              ],
            }),
          ]
        : []),
    ],
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    ...(!useEmulatedGoogle &&
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        },
      }),
    trustedOrigins: [webUrl],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth['$Infer']['Session'];

/**
 * Standalone instance for the Better Auth CLI (`@better-auth/cli generate`).
 * The running server builds its own via createAuth with the request-scoped db.
 */
export const auth = createAuth({
  db: createDb(process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL),
  env: parseServerEnv({
    ...process.env,
    DATABASE_URL: process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL,
  }),
});
