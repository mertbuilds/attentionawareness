import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The guide moved under `/guides` in September 2026. This path is in the CLI's
 * own README, in `supervise update`, and in every link anyone has shared since
 * the site went up, so it stays and sends the reader on permanently.
 */
export const Route = createFileRoute('/supervise')({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: '/guides/supervise-iphone-without-erasing' });
  },
});
