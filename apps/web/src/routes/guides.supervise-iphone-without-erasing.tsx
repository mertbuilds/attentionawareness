import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The supervision guide walked the retired Python tool by hand. The Mac app
 * does the same procedure, so the guide is gone and this path sends the reader
 * to the home page it is offered on.
 */
export const Route = createFileRoute('/guides/supervise-iphone-without-erasing')({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: '/' });
  },
});
