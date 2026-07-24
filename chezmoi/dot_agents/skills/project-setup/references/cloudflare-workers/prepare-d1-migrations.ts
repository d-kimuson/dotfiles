/**
 * drizzle/migrations (drizzle-kit 形式) → drizzle/d1-migrations (wrangler 形式) へ
 * シンボリックリンクを作成する。
 *
 * drizzle-kit: <name>/migration.sql (ディレクトリ形式)
 * wrangler d1: <name>.sql (フラットファイル形式)
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';

const src = 'drizzle/migrations';
const dst = 'drizzle/d1-migrations';

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });

for (const entry of readdirSync(src)) {
  const srcPath = join(src, entry);

  if (entry.endsWith('.sql')) {
    symlinkSync(relative(dst, srcPath), join(dst, entry));
  } else if (statSync(srcPath).isDirectory()) {
    const migrationFile = join(srcPath, 'migration.sql');
    if (existsSync(migrationFile)) {
      symlinkSync(relative(dst, migrationFile), join(dst, `${entry}.sql`));
    }
  }
}

const count = readdirSync(dst).length;
console.info('d1-migrations symlinks created', { count });
