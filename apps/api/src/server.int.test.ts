import { router } from '@keepyourattention/api';
import type { Db } from '@keepyourattention/db';
import { parseServerEnv, type ServerEnv } from '@keepyourattention/env/server';
import { call, ORPCError } from '@orpc/server';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { recordStripeEvent } from './billing/events.ts';
import { buildServer } from './server.ts';
import { createTestDb, truncateAll } from './test/db.ts';

let db: Db;
let env: ServerEnv;
let app: FastifyInstance;

const credentials = {
  email: 'ada@example.com',
  name: 'Ada',
  password: 'password1234',
};

async function signUp(): Promise<string> {
  const response = await app.inject({
    body: credentials,
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    url: '/api/auth/sign-up/email',
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.headers['set-cookie'];
  expect(cookie).toBeDefined();
  return String(Array.isArray(cookie) ? cookie[0] : cookie).split(';')[0]!;
}

beforeAll(async () => {
  db = createTestDb();
  env = parseServerEnv({
    BETTER_AUTH_SECRET: 'integration-test-secret',
    DATABASE_URL: inject('databaseUrl'),
    NODE_ENV: 'test',
  });
  app = await buildServer({ db, env });
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('auth flow', () => {
  it('sign-up creates a user and an audit row', async () => {
    await signUp();
    const user = await db.user.findFirst({ where: { email: credentials.email } });
    expect(user?.name).toBe(credentials.name);
    const audit = await db.auditLog.findFirst({ where: { action: 'auth.user.create' } });
    expect(audit?.userId).toBe(user?.id);
  });

  it('sign-in sets a session cookie that authorizes /api/me', async () => {
    await signUp();
    const signIn = await app.inject({
      body: { email: credentials.email, password: credentials.password },
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      url: '/api/auth/sign-in/email',
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = String(signIn.headers['set-cookie']).split(';')[0]!;

    const me = await app.inject({ headers: { cookie }, method: 'GET', url: '/api/me' });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: credentials.email, name: credentials.name });
  });

  it('rejects /api/me without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('oRPC direct calls', () => {
  const plans = [
    { interval: 'month' as const, name: 'pro', priceId: 'price_test', unitAmount: 2000 },
  ];

  it('billing.plans returns configured plans', async () => {
    const result = await call(router.billing.plans, undefined, {
      context: { db, plans, session: null },
    });
    expect(result).toEqual(plans);
  });

  it('me throws UNAUTHORIZED without a session', async () => {
    await expect(
      call(router.me, undefined, { context: { db, plans, session: null } }),
    ).rejects.toSatisfy((error) => error instanceof ORPCError && error.code === 'UNAUTHORIZED');
  });

  it('me returns the session user', async () => {
    const session = {
      session: { expiresAt: new Date(Date.now() + 60_000), id: 's1', userId: 'u1' },
      user: { email: 'ada@example.com', emailVerified: true, id: 'u1', name: 'Ada' },
    };
    const result = await call(router.me, undefined, { context: { db, plans, session } });
    expect(result).toEqual(session.user);
  });
});

describe('stripe event idempotency', () => {
  it('records an event once and skips duplicates', async () => {
    const event = { id: 'evt_test_1', type: 'checkout.session.completed' } as Parameters<
      typeof recordStripeEvent
    >[1];
    expect(await recordStripeEvent(db, event)).toBe(true);
    expect(await recordStripeEvent(db, event)).toBe(false);
    expect(await db.stripeEvent.count({ where: { id: 'evt_test_1' } })).toBe(1);
  });
});
