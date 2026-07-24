import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
