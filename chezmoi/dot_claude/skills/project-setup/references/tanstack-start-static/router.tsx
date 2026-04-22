import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const getRouter = () =>
  createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });

declare module '@tanstack/react-router' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation requires interface
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
