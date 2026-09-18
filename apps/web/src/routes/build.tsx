import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The profile generator is gone: the Mac app builds and installs the profile
 * itself. The path stays for the links that already point at it.
 */
export const Route = createFileRoute('/build')({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: '/' });
  },
});
