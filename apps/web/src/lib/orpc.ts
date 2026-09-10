import type { AppRouter } from '@keepyourattention/api';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import { clientEnv } from './env.ts';

const link = new RPCLink({
  fetch: (request, init) => globalThis.fetch(request, { ...init, credentials: 'include' }),
  url: `${clientEnv.VITE_API_URL}/rpc`,
});

export const api: RouterClient<AppRouter> = createORPCClient(link);
