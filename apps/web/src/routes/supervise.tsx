import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The supervision guide and the tool it described are gone: the Mac app does
 * the whole procedure now, and the home page is where it is offered. This path
 * is in every link shared since the site went up, so it stays and sends the
 * reader on permanently.
 */
export const Route = createFileRoute('/supervise')({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: '/' });
  },
});
