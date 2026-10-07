// CLI over decision-block.ts. Run with Node.js 24+ (native TypeScript):
//
//   node scripts/decisions.ts list [category...]   decisions in the templates, as JSON
//   node scripts/decisions.ts check                syntax and id uniqueness of the templates
//   node scripts/decisions.ts leftovers <path...>  unresolved decision blocks and TODOs in generated files
//
// `list` and `leftovers` print JSON. `check` and `leftovers` exit with 1 when something is left to fix.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDecisions, findLeftovers, type SourceFile } from "./decision-block.ts";

const TEMPLATES = fileURLToPath(new URL("../templates/", import.meta.url));
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

// Symlinks inside a directory are skipped: in a harness they point to files that are walked anyway
// (CLAUDE.md -> AGENTS.md, .claude/skills -> .agents/skills), and following them reports everything twice.
const walk = (path: string): string[] => {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => !entry.isSymbolicLink())
    .filter((entry) => !(entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => walk(join(path, entry.name)));
};

const readMarkdown = (root: string, paths: readonly string[]): SourceFile[] =>
  paths
    .flatMap(walk)
    .filter((path) => path.endsWith(".md"))
    .map((path) => ({ path: relative(root, path), source: readFileSync(path, "utf8") }));

const readTemplates = (): SourceFile[] => readMarkdown(TEMPLATES, [TEMPLATES]);

const print = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const usage = (): never => {
  process.stderr.write(
    "usage: node scripts/decisions.ts list [category...] | check | leftovers <path...>\n",
  );
  process.exit(2);
};

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "list": {
    const { decisions } = collectDecisions(readTemplates());
    print(
      args.length === 0
        ? decisions
        : decisions.filter((decision) =>
            args.some((category) => decision.category === category || decision.category.startsWith(`${category}/`)),
          ),
    );
    break;
  }
  case "check": {
    const { decisions, issues } = collectDecisions(readTemplates());
    if (issues.length > 0) {
      print(issues);
      process.exit(1);
    }
    process.stdout.write(`ok: ${decisions.length} decisions\n`);
    break;
  }
  case "leftovers": {
    if (args.length === 0) usage();
    const leftovers = findLeftovers(readMarkdown(process.cwd(), args));
    print(leftovers);
    if (leftovers.decisions.length > 0) process.exit(1);
    break;
  }
  default:
    usage();
}
