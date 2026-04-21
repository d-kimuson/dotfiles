import { Hono } from "hono";

export type HonoContext = {
  Variables: {};
};

export const honoApp = new Hono<HonoContext>();

export type HonoAppType = typeof honoApp;
