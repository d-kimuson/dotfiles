import type { Hono } from "hono";
import type { HonoAppType, HonoContext } from "./app";

export const routes = (app: HonoAppType) => {
  return app
    .get("/info", (c) => {
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
