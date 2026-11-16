// CLI over decision-block.ts. Run with Node.js 24+ (native TypeScript):
//
//   node scripts/decisions.ts files <setup>        every template file of a setup with its target path and optional unit
//   node scripts/decisions.ts list <setup>         decisions in a setup's templates
//   node scripts/decisions.ts check                syntax, id uniqueness, and optional markers of every setup's templates
//   node scripts/decisions.ts leftovers <path...>  unresolved decision blocks and TODOs in generated files
//
// A setup names a recommended pattern whose template/ is laid out as the target repository.
// `files`, `list`, and `leftovers` print JSON. `check` and `leftovers` exit with 1 when something is left to fix.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDecisions, findLeftovers, toTemplateFile, type SourceFile } from "./decision-block.ts";

const PATTERNS = fileURLToPath(new URL("../../../references/shared/recommended-patterns/", import.meta.url));
const SETUPS: Readonly<Record<string, string>> = { core: "agent-harness", "auto-pilot": "agent-auto-pilot" };
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

const templateRoot = (pattern: string): string => join(PATTERNS, pattern, "template");

const setupRoot = (setup: string | undefined): string => {
  const pattern = setup === undefined ? undefined : SETUPS[setup];
  if (pattern === undefined) {
    process.stderr.write(`unknown setup: ${setup ?? "(none)"} (one of: ${Object.keys(SETUPS).join(", ")})\n`);
    process.exit(2);
  }
  return templateRoot(pattern);
};

const readTemplates = (root: string): SourceFile[] => readMarkdown(root, [root]);

const templatePaths = (root: string): string[] => walk(root).map((path) => relative(root, path));

const print = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const usage = (): never => {
  process.stderr.write(
    "usage: node scripts/decisions.ts files <setup> | list <setup> | check | leftovers <path...>\n",
  );
  process.exit(2);
};

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "files": {
    print(templatePaths(setupRoot(args[0])).map(toTemplateFile));
    break;
  }
  case "list": {
    print(collectDecisions(readTemplates(setupRoot(args[0]))).decisions);
    break;
  }
  case "check": {
    // Ids stay unique across setups, so a decision can be named without its setup
    const roots = Object.values(SETUPS).map(templateRoot);
    const { decisions, issues } = collectDecisions(readMarkdown(PATTERNS, roots));
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
