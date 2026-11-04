import { bindings, defineConfig } from 'cf/config';

// Modes are selected with `cf --mode <mode>`. `cf dev` / `cf build` / `cf deploy` default to
// `development` / `production`, which fall through to the dev config below.
const common = {
  compatibilityDate: '2025-12-13',
  compatibilityFlags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
  entrypoint: 'src/server/worker.ts',
  observability: { enabled: true },
  workersDev: true,
  assets: {
    notFoundHandling: 'single-page-application',
    runWorkerFirst: ['/api/*'],
  },
} as const;

export default defineConfig((ctx) => {
  switch (ctx.mode) {
    case 'prod':
      return {
        worker: {
          ...common,
          name: '<project-name>-prod',
          env: {
            ENVIRONMENT: bindings.text('prod'),
            // Remove if D1 is not used.
            DB: bindings.d1({ name: '<project-name>-prod', id: '<prod-d1-database-id>' }),
          },
        },
      };
    default:
      return {
        worker: {
          ...common,
          name: '<project-name>',
          env: {
            ENVIRONMENT: bindings.text('dev'),
            // Remove if D1 is not used.
            DB: bindings.d1({ name: '<project-name>-dev', id: '<dev-d1-database-id>' }),
          },
        },
      };
  }
});
