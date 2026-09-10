import { spawnSync } from 'node:child_process';

// `prisma db push` skips migration history. Local development only.
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const host = new URL(databaseUrl).hostname;
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

if (nodeEnv !== 'development' || !localHosts.has(host)) {
  throw new Error(
    `Refusing db push: NODE_ENV=${nodeEnv}, host=${host}. ` +
      'Push is allowed only with NODE_ENV=development against localhost. ' +
      'Use migrations (pnpm db:migrate) everywhere else.',
  );
}

const result = spawnSync('prisma', ['db', 'push'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
