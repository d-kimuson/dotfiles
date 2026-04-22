import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
// {Customize: import QueryClientProviderWrapper, styles, etc.}
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '<site-name>' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // {Customize: add favicon, manifest, etc.}
    ],
  }),
  // {Customize: add notFoundComponent if needed}
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* {Customize: wrap with QueryClientProviderWrapper etc.} */}
        {children}
        <Scripts />
      </body>
    </html>
  );
}
