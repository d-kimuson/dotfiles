import { createMiddleware } from 'hono/factory';

import type { HonoContext } from '../app';

import { createDb } from '../db';

// Routes use `c.var.db`, never `c.env.DB` directly.
export const dbMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  c.set('db', createDb(c.env.DB));
  await next();
});
