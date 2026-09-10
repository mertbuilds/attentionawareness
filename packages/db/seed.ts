import { createDb } from './src/index.ts';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed.');
}

const db = createDb(databaseUrl);

// Idempotent seed. Add demo data here as models land (users, plans).
// Rule: use upserts keyed on stable ids so repeated runs are no-ops.
async function seed() {
  const stripeEvents = await db.stripeEvent.count();
  process.stdout.write(`Seed complete (stripe_events rows: ${stripeEvents}).\n`);
}

try {
  await seed();
} finally {
  await db.$disconnect();
}
