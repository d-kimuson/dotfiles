import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

type TanStackStartMode = 'prerender' | 'spa';

const getTanStackStartMode = (): TanStackStartMode => {
  // {Customize: choose during setup. Use 'spa' as the replacement for the old TanStack Router SPA template.}
  if (process.env['TANSTACK_START_MODE'] === 'spa') return 'spa';
  return 'prerender';
};

const getDefineValues = (): Record<string, string> => ({
  // {Customize: keep only when the app uses auth bypass for QA/E2E.}
  __DISABLE_AUTH__: JSON.stringify(process.env['DISABLE_AUTH'] ?? 'false'),
});

const getPrerenderPages = () => [
  // `/` intentionally renders no UI and redirects to `/home` after hydration.
  // This avoids top-page flicker when Cloudflare SPA fallback serves `/` HTML for client routes.
  { path: '/', prerender: { enabled: true, crawlLinks: false } },
  { path: '/home', prerender: { enabled: true, crawlLinks: false } },
];

const getTanStackStartPrerenderConfig = () => {
  if (getTanStackStartMode() === 'spa') {
    return {
      prerender: {
        enabled: false,
      },
    };
  }

  return {
    prerender: {
      enabled: true,
      autoStaticPathsDiscovery: false,
      crawlLinks: false,
    },
    pages: getPrerenderPages(),
  };
};

const config = defineConfig(() => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src/web',
      router: {
        routesDirectory: './app',
        generatedRouteTree: './routeTree.gen.ts',
        routeToken: 'page',
        routeFileIgnorePattern: '^(?!page\\.(tsx|ts|jsx|js)$).*\\.(tsx|ts|jsx|js)$',
      },
      ...getTanStackStartPrerenderConfig(),
    }),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  define: getDefineValues(),
  clean: true,
}));

export default config;
