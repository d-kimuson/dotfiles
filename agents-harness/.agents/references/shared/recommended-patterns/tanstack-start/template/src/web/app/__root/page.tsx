import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { type FC, type PropsWithChildren, Suspense } from 'react';

import { FullScreenLoading } from '../../shared/layout/FullScreenLoading';
import appCss from '../../styles.css?url';
import { AppProvider } from './providers/AppProvider';

const RootDocument: FC<PropsWithChildren> = ({ children }) => {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppProvider>
          <Suspense fallback={<FullScreenLoading />}>{children}</Suspense>
          <Scripts />
        </AppProvider>
      </body>
    </html>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '<site-name>' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: () => <div>Not Found</div>,
  shellComponent: RootDocument,
});
