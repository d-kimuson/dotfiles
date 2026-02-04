# Hono

## Core Rule

- シングルパッケージであれば src/server 以下に hono のコードを配置
- マルチパッケージであれば src に直接配置し、exports フィールドで型を公開・FE 側のパッケージから参照できるようにする

## hono/app.ts

```typescript:hono/app.ts
import { Hono } from "hono";

export type HonoContext = {
  Variables: {};
};

export const honoApp = new Hono<HonoContext>();

export type HonoAppType = typeof honoApp;
```

## hono/routes.ts

```typescript:hono/routes.ts
import type { HonoAppType, HonoContext } from "./app";

export const routes = (app: HonoAppType) => {
  return app
    .get("/info", async (c) => {
      return c.json({
        status: "healthy",
        server: "<project-name>",
      } as const);
    })
}

export type RouteType = ReturnType<typeof routes>

export type ApiSchema = RouteType extends Hono<HonoContext, infer S>
  ? S
  : never;
```

## hono/server.ts

```typescript:hono/server.ts
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
```

## hono/main.ts

```typescript:hono/main.ts
import { startServer } from "./hono/server";

await startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## types.ts (マルチパッケージでFEに公開する場合)

```typescript:types.ts
export type { HonoAppType } from "./hono/app";
export type { ApiSchema, RouteType } from "./hono/route";
```

```json:package.json
{
  "exports": {
    "./types": "./src/types.ts"
  },
}
```

## Frontend

```typescript:lib/api/client.ts
import { hc } from "hono/client";
import type { RouteType } from "../../server/hono/route";  // シングルパッケージ
import type { RouteType } from '<pkg-name-backend>/types'; // マルチパッケージ

type Fetch = typeof fetch;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`HttpError: ${status} ${statusText}`);
  }
}

const customFetch: Fetch = async (...args) => {
  const response = await fetch(...args);
  if (!response.ok) {
    console.error(response);
    throw new HttpError(response.status, response.statusText);
  }
  return response;
};

export const honoClient = hc<RouteType>("/", {
  fetch: customFetch,
});
```

```typescript:lib/api/mock-utils.ts
import type { ApiSchema } from "../../server/hono/route";  // シングルパッケージ
import type { ApiSchema } from '<pkg-name-backend>/types'; // マルチパッケージ
import { HttpResponse, http } from "msw";

type IEndpoint = {
  status: number;
  // biome-ignore lint/complexity/noBannedTypes: allow for constraints
  input: {};
  // biome-ignore lint/complexity/noBannedTypes: allow for constraints
  output: {};
};

const BASE_URL = "http://localhost:6789"; // 適切に設定

export const createHandler = <
  const Route extends keyof ApiSchema,
  const Method extends keyof ApiSchema[Route],
  EndpointSchema extends IEndpoint = ApiSchema[Route][Method] extends IEndpoint
    ? ApiSchema[Route][Method]
    : never,
  Response extends {
    status: number;
    // biome-ignore lint/complexity/noBannedTypes: allow for constraints
    data: {};
  } = {
    status: EndpointSchema["status"];
    data: EndpointSchema["output"];
  },
>(
  route: Route,
  method: Method,
  handler: (ctx: {
    input: EndpointSchema["input"];
  }) => Response | Promise<Response>,
) => {
  const fullUrl = `${BASE_URL}${route}`;

  if (method === "$get") {
    return http.get(fullUrl, async () => {
      const response = await handler({ input: {} as EndpointSchema["input"] });

      return HttpResponse.json(response.data, {
        status: response.status,
      });
    });
  }

  if (method === "$post") {
    return http.post(fullUrl, async ({ request }) => {
      const requestData = await request.json();
      const response = await handler({
        input: { json: requestData } as EndpointSchema["input"],
      });

      return HttpResponse.json(response.data, {
        status: response.status,
      });
    });
  }

  if (method === "$put") {
    return http.put(fullUrl, async ({ request }) => {
      const requestData = await request.json();
      const response = await handler({
        input: { json: requestData } as EndpointSchema["input"],
      });

      return HttpResponse.json(response.data, {
        status: response.status,
      });
    });
  }

  if (method === "$delete") {
    return http.delete(fullUrl, async ({ request }) => {
      const requestData = await request.json();
      const response = await handler({
        input: { json: requestData } as EndpointSchema["input"],
      });

      return HttpResponse.json(response.data, {
        status: response.status,
      });
    });
  }

  throw new Error(`Method ${String(method)} not supported`);
};
```
