-- Desired-state schema (SQLite dialect) for Atlas. `pnpm migrate:diff <name>` compares this file
-- against `db/migrations/` and generates the next migration.

CREATE TABLE "todo" (
  "id" text NOT NULL PRIMARY KEY,
  "title" text NOT NULL,
  "done" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL
);
