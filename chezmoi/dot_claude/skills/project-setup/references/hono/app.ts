import { Hono } from "hono";

export type HonoContext = {
  Variables: Record<string, never>;
};

export const honoApp = new Hono<HonoContext>();

export type HonoAppType = typeof honoApp;
