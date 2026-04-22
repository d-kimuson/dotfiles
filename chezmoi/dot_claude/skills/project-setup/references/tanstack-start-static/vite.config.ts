import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// {Customize: import JSON data for dynamic pre-render pages if needed}
// import items from './src/data/items.json' with { type: 'json' };

const getPrerenderPages = () => {
  // {Customize: add static and dynamic pre-render pages}
  return [
    { path: '/', prerender: { enabled: true, crawlLinks: false } },
  ];
};

const config = defineConfig(() => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src/web',
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
      pages: getPrerenderPages(),
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
  clean: true,
}));

export default config;
