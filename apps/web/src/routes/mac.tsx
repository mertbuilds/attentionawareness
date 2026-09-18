import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The Mac app has its own section on the home page rather than a page of its
 * own. The path stays for the links that already point at it. Only the page is
 * gone: `/mac/appcast.xml` and `/mac/latest.json` are files under `public/`,
 * and the asset worker answers them before this route is reached.
 */
export const Route = createFileRoute('/mac')({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: '/' });
  },
});
