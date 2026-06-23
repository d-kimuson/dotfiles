import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DatabaseSync } from 'node:sqlite';

import * as schema from '../server/db/schema.ts';

const db = drizzle({ client: new DatabaseSync(':memory:'), schema });

migrate(db, { migrationsFolder: 'drizzle/migrations' });
