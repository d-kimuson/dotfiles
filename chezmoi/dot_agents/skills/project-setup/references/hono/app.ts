import { Hono } from 'hono';

export type RuntimeEnvironment = 'local' | 'dev' | 'preview' | 'prod';

export type HonoContext = {
  Variables: {
    env: RuntimeEnvironment;
    user: unknown | undefined;
    // {Customize: add drizzleDb or other request-scoped handles when needed}
  };
};

export const honoApp = () => new Hono<HonoContext>();

export type HonoAppType = ReturnType<typeof honoApp>;
