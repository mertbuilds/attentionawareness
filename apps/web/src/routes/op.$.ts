import { createFileRoute } from '@tanstack/react-router';
import { proxyAnalytics } from '../lib/op-proxy.ts';

export const Route = createFileRoute('/op/$')({
  server: {
    handlers: {
      GET: proxyAnalytics,
      POST: proxyAnalytics,
    },
  },
});
