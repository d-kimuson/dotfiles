import type { D1Database } from '@cloudflare/workers-types';

import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

import type { Database } from './types';

export type { Database } from './types';

// Build per request from `c.env.DB` (see `dbMiddleware.ts`), never at module level:
// Workers isolates reuse module scope across requests, so a captured binding could leak.
export const createDb = (d1: D1Database): Kysely<Database> =>
  new Kysely<Database>({ dialect: new D1Dialect({ database: d1 }) });
