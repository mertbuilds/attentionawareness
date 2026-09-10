import { createDb, type Db } from '@web-starter/db';
import { inject } from 'vitest';

/** Connects to the Testcontainers Postgres provided by global-setup. */
export function createTestDb(): Db {
  return createDb(inject('databaseUrl'));
}

/**
 * Empties every table between tests (Prisma has no per-test rollback).
 * `_prisma_migrations` is preserved so the schema stays intact.
 */
export async function truncateAll(db: Db): Promise<void> {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
