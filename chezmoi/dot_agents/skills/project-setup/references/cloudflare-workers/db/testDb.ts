// Test-only: a D1 database on Miniflare (the same workerd D1 as production) with every
// `db/migrations/*.up.sql` applied in order, so repository/workflow tests run against the
// real migration history through the same kysely-d1 path as production.
import type { D1Database } from '@cloudflare/workers-types';
import type { Kysely } from 'kysely';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';

import type { Database } from './types';

import { createDb } from './index';

const migrationsDir = join(import.meta.dirname, '../../../db/migrations');

// Versions are fixed-length timestamps, so lexical order is apply order.
const upMigrations = (): readonly string[] =>
  readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.up.sql'))
    .toSorted()
    .map((fileName) => readFileSync(join(migrationsDir, fileName), 'utf8'));

// One Miniflare per test worker process with a pool of empty D1 bindings. Each call takes an
// unused binding, so tests never share state and do not pay Miniflare's startup per test.
const bindingPoolSize = 256;
const bindings = Array.from({ length: bindingPoolSize }, (_, i) => `DB_${i}`);

let miniflare: Miniflare | undefined;
let nextBinding = 0;

export const createMigratedD1 = async (): Promise<D1Database> => {
  const binding = bindings[nextBinding];
  if (binding === undefined) {
    throw new Error(`All ${bindingPoolSize} test D1 bindings are used; raise bindingPoolSize`);
  }
  nextBinding += 1;
  miniflare ??= new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {}',
      compatibilityDate: '2025-12-13',
      d1Databases: bindings,
    }),
  );
  const d1 = await miniflare.getD1Database(binding);
  // Apply each file as one batch, like `wrangler d1 migrations apply`.
  for (const sql of upMigrations()) {
    await d1.batch(unstable_splitSqlQuery(sql).map((statement) => d1.prepare(statement)));
  }
  return d1;
};

export const createMigratedTestDb = async (): Promise<Kysely<Database>> =>
  createDb(await createMigratedD1());

export const disposeTestDb = async (): Promise<void> => {
  await miniflare?.dispose();
  miniflare = undefined;
  nextBinding = 0;
};
