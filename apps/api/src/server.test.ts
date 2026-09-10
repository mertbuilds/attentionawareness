import type { Db } from '@keepyourattention/db';
import { parseServerEnv } from '@keepyourattention/env/server';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.ts';

const env = parseServerEnv({
  DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
  NODE_ENV: 'test',
});

// /health and RPC routing need no live database; a stub keeps this test
// dependency-free. Real-database tests arrive with Testcontainers (chunk 8).
// hello is audited, so the stub accepts the AuditLog write.
const db = {
  auditLog: { create: async () => ({}) },
} as unknown as Db;

describe('server', () => {
  it('serves /health', async () => {
    const app = await buildServer({ db, env });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, version: '0.0.0' });
    await app.close();
  });

  it('serves hello via OpenAPI handler', async () => {
    const app = await buildServer({ db, env });
    const response = await app.inject({
      body: { name: 'World' },
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      url: '/api/hello',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Hello, World!' });
    await app.close();
  });
});
