import { serve } from "@hono/node-server";
import { honoApp } from "./app";
import { routes } from "./route";

type ServerOptions = {
  port?: number;
};

export const startServer = async (options?: ServerOptions) => {
  const { port = <default-port> } = options ?? {};

  routes(honoApp)

  const server = serve(
    {
      fetch: honoApp.fetch,
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

  process.on("SIGINT", () => {
    cleanUp();
  });

  process.on("SIGTERM", () => {
    cleanUp();
  });

  return {
    server,
    cleanUp,
  } as const;
};
