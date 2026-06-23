import { Hono } from 'hono';

import type { HonoAppType, HonoContext } from './app';

const systemRoutes = () =>
  new Hono<HonoContext>().get('/health', (c) => {
    return c.json({
      status: 'healthy',
      server: '<project-name>',
    } as const);
  });

export const routes = (app: HonoAppType) => {
  return app.route('/api/system', systemRoutes());
};

export type RouteType = ReturnType<typeof routes>;

export type ApiSchema = RouteType extends Hono<HonoContext, infer S> ? S : never;
