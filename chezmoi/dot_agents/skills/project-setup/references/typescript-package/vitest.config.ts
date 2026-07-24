import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    isolate: false,
    projects: [
      {
        test: {
          name: 'web-hooks',
          include: ['src/web/**/use*.test.{ts,tsx}'],
          environment: 'happy-dom',
          setupFiles: ['configs/vitest/time.setup.ts'],
        },
      },
      {
        test: {
          name: 'pure',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['configs/vitest/time.setup.ts'],
          exclude: [
            'src/web/**/use*.test.{ts,tsx}',
            'src/server/**/workflows/**/*.test.{ts,tsx}',
            'src/server/**/repositories/**/*.test.{ts,tsx}',
          ],
        },
      },
      {
        test: {
          name: 'db-required',
          include: [
            'src/server/**/workflows/**/*.test.{ts,tsx}',
            'src/server/**/repositories/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['configs/vitest/time.setup.ts', 'configs/vitest/db-required.setup.ts'],
        },
      },
    ],
  },
});
