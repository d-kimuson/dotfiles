import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Keep in sync with `defaultPort` in src/server/server.ts (hono pattern).
const apiServerPort = 8787;

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
      '/api': `http://localhost:${apiServerPort}`,
    },
  },
}));

export default config;
