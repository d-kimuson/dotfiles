import { serve } from '@hono/node-server';

import { honoApp } from './app';
import { routes } from './routes';

type ServerOptions = {
  readonly port?: number;
};

const defaultPort = 8787;

export const startServer = (options?: ServerOptions) => {
  const { port = defaultPort } = options ?? {};
  const app = routes(honoApp());

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
    },
  );

  let isRunning = true;
  const cleanUp = () => {
    if (isRunning) {
      server.close();
      isRunning = false;
    }
  };

  process.on('SIGINT', () => {
    cleanUp();
  });

  process.on('SIGTERM', () => {
    cleanUp();
  });

  return {
    server,
    cleanUp,
  } as const;
};
