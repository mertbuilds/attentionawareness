import { os } from '@orpc/server';
import { z } from 'zod';
import type { Context } from './context.ts';

/**
 * Base procedure. Every error carries a stable machine code — the web app
 * maps codes to localized messages (see ADR-0001, i18n). Never return prose.
 */
const base = os.$context<Context>().errors({
  INVALID_INPUT: {
    message: 'Input failed validation.',
  },
  NOT_FOUND: {
    message: 'Resource not found.',
  },
  UNAUTHORIZED: {
    message: 'Authentication required.',
  },
});

/** Requires a session; narrows context.session to non-null. */
const protectedBase = base.use(({ context, errors, next }) => {
  if (!context.session) {
    throw errors.UNAUTHORIZED();
  }
  return next({ context: { ...context, session: context.session } });
});

/**
 * Writes an AuditLog row after a successful mutation. Compose onto every
 * mutating procedure; `entity` names what the procedure touches.
 */
function audited(entity: string) {
  return base.middleware(async ({ context, next, path }) => {
    const result = await next();
    await context.db.auditLog.create({
      data: {
        action: path.join('.'),
        entity,
        userId: context.session?.user.id ?? null,
      },
    });
    return result;
  });
}

const subscriptionOutput = z
  .object({
    cancelAtPeriodEnd: z.boolean(),
    periodEnd: z.date().nullable(),
    plan: z.string(),
    status: z.string(),
  })
  .nullable();

export const router = base.router({
  billing: {
    plans: base
      .route({ method: 'GET', path: '/billing/plans', tags: ['billing'] })
      .output(
        z.array(
          z.object({
            interval: z.literal('month'),
            name: z.string(),
            priceId: z.string(),
            unitAmount: z.number(),
          }),
        ),
      )
      .handler(({ context }) => context.plans),
    subscription: protectedBase
      .route({ method: 'GET', path: '/billing/subscription', tags: ['billing'] })
      .output(subscriptionOutput)
      .handler(async ({ context }) => {
        const row = await context.db.subscription.findFirst({
          orderBy: { periodEnd: 'desc' },
          where: {
            referenceId: context.session.user.id,
            status: { notIn: ['canceled', 'incomplete_expired'] },
          },
        });
        if (!row) {
          return null;
        }
        return {
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
          periodEnd: row.periodEnd,
          plan: row.plan,
          status: row.status,
        };
      }),
  },
  health: {
    ping: base
      .route({ method: 'GET', path: '/health/ping', tags: ['health'] })
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true })),
  },
  hello: base
    .use(audited('demo'))
    .route({ method: 'POST', path: '/hello', tags: ['demo'] })
    .input(z.object({ name: z.string().min(1) }))
    .output(z.object({ message: z.string() }))
    .handler(({ input }) => ({ message: `Hello, ${input.name}!` })),
  me: protectedBase
    .route({ method: 'GET', path: '/me', tags: ['auth'] })
    .output(
      z.object({
        email: z.string(),
        emailVerified: z.boolean(),
        id: z.string(),
        name: z.string(),
      }),
    )
    .handler(({ context }) => {
      const { email, emailVerified, id, name } = context.session.user;
      return { email, emailVerified, id, name };
    }),
});

export type AppRouter = typeof router;
