import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const getDefineValues = (): Record<string, string> => ({
  // {Customize: keep only when the app uses auth bypass for QA/E2E.}
  __DISABLE_AUTH__: JSON.stringify(process.env['DISABLE_AUTH'] ?? 'false'),
});

const config = defineConfig(() => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
      },
      prerender: {
        enabled: false,
      },
      srcDirectory: 'src/web',
      router: {
        routesDirectory: './app',
        generatedRouteTree: './routeTree.gen.ts',
        routeToken: 'page',
        routeFileIgnorePattern: '^(?!page\\.(tsx|ts|jsx|js)$).*\\.(tsx|ts|jsx|js)$',
      },
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
