import { QueryClientProvider } from '@tanstack/react-query';
import { type FC, type PropsWithChildren } from 'react';

import { createQueryClient } from '../../../lib/api/queryClient';

const queryClient = createQueryClient();

export const AppProvider: FC<PropsWithChildren> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
