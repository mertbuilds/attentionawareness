import cors from '@fastify/cors';
import { router } from '@keepyourattention/api';
import type { Db } from '@keepyourattention/db';
import type { ServerEnv } from '@keepyourattention/env/server';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fastify';
import { RPCHandler } from '@orpc/server/fastify';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import scalarApiReference from '@scalar/fastify-api-reference';
import { setupFastifyErrorHandler } from '@sentry/node';
import { fromNodeHeaders } from 'better-auth/node';
import type { DrainContext } from 'evlog';
import { createAxiomDrain } from 'evlog/axiom';
import { evlog } from 'evlog/fastify';
import { createDrainPipeline } from 'evlog/pipeline';
import { createSentryDrain } from 'evlog/sentry';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { createAuth, type Auth } from './auth.ts';
import { getPlans } from './billing/plans.ts';

const schemaConverters = [new ZodToJsonSchemaConverter()];

const openAPIGenerator = new OpenAPIGenerator({ schemaConverters });

export async function buildServer(options: { db: Db; env: ServerEnv }): Promise<FastifyInstance> {
  const { db, env } = options;

  const app = Fastify({ logger: false });

  if (env.SENTRY_DSN) {
    setupFastifyErrorHandler(app);
  }

  const drains: Array<(ctx: DrainContext) => unknown> = [];
  if (env.AXIOM_TOKEN && env.AXIOM_DATASET) {
    const pipeline = createDrainPipeline<DrainContext>({
      batch: { intervalMs: 5000, size: 50 },
      retry: { maxAttempts: 3 },
    });
    drains.push(pipeline(createAxiomDrain({ dataset: env.AXIOM_DATASET, token: env.AXIOM_TOKEN })));
  }
  if (env.SENTRY_DSN) {
    drains.push(createSentryDrain());
  }

  await app.register(evlog, {
    ...(drains.length > 0 && {
      drain: async (ctx: DrainContext) => {
        await Promise.all(drains.map((drain) => drain(ctx)));
      },
    }),
    exclude: ['/health', '/docs/**', '/openapi.json'],
  });

  // Web and api live on different origins (ports locally, subdomains in
  // prod); the browser needs CORS with credentials for cookies to flow.
  await app.register(cors, {
    credentials: true,
    origin: [env.WEB_URL ?? 'http://localhost:3000'],
  });

  // Let oRPC parse unrecognized content types itself; Fastify's built-in
  // JSON parser stays active and oRPC reuses its parsed body.
  app.addContentTypeParser('*', (_request, _payload, done) => {
    done(null, undefined);
  });

  app.get('/health', () => ({ ok: true, version: '0.0.0' }));

  const auth = createAuth({ db, env });

  // Better Auth handler — mounted before the generic /api/* oRPC catch-all;
  // find-my-way routes the longer /api/auth/* prefix here first.
  app.route({
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const headers = fromNodeHeaders(request.headers);
      const init: RequestInit = { headers, method: request.method };
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined) {
        init.body = JSON.stringify(request.body);
      }
      const response = await auth.handler(new Request(url.toString(), init));
      reply.status(response.status);
      for (const [key, value] of response.headers) {
        reply.header(key, value);
      }
      return reply.send(response.body ? await response.text() : null);
    },
    method: ['GET', 'POST'],
    url: '/api/auth/*',
  });

  async function sessionFor(
    request: FastifyRequest,
  ): Promise<Awaited<ReturnType<Auth['api']['getSession']>>> {
    return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  }

  const plans = getPlans(env);

  const rpcHandler = new RPCHandler(router);
  app.all('/rpc/*', async (request, reply) => {
    const { matched } = await rpcHandler.handle(request, reply, {
      context: { db, plans, session: await sessionFor(request) },
      prefix: '/rpc',
    });
    if (!matched) {
      await reply.status(404).send({ code: 'NOT_FOUND' });
    }
  });

  const openAPIHandler = new OpenAPIHandler(router);
  app.all('/api/*', async (request, reply) => {
    const { matched } = await openAPIHandler.handle(request, reply, {
      context: { db, plans, session: await sessionFor(request) },
      prefix: '/api',
    });
    if (!matched) {
      await reply.status(404).send({ code: 'NOT_FOUND' });
    }
  });

  app.get('/openapi.json', async () =>
    openAPIGenerator.generate(router, {
      info: { title: 'keepyourattention API', version: '0.0.0' },
      servers: [{ url: '/api' }],
    }),
  );

  await app.register(scalarApiReference, {
    configuration: {
      sources: [
        { title: 'API', url: '/openapi.json' },
        // Served by Better Auth's openAPI() plugin.
        { title: 'Auth', url: '/api/auth/open-api/generate-schema' },
      ],
    },
    routePrefix: '/docs',
  });

  return app;
}
