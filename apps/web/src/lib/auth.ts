import { stripeClient } from '@better-auth/stripe/client';
import { createAuthClient } from 'better-auth/react';
import { clientEnv } from './env.ts';

export const authClient = createAuthClient({
  baseURL: clientEnv.VITE_API_URL,
  plugins: [stripeClient({ subscription: true })],
});
