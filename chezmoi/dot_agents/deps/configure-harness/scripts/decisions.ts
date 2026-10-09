// CLI over decision-block.ts. Run with Node.js 24+ (native TypeScript):
//
//   node scripts/decisions.ts files                every template file with its target path and optional unit
//   node scripts/decisions.ts list                 decisions in the templates
//   node scripts/decisions.ts check                syntax, id uniqueness, and optional markers of the templates
//   node scripts/decisions.ts leftovers <path...>  unresolved decision blocks and TODOs in generated files
//
// `files`, `list`, and `leftovers` print JSON. `check` and `leftovers` exit with 1 when something is left to fix.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDecisions, findLeftovers, toTemplateFile, type SourceFile } from "./decision-block.ts";

// In the chezmoi source state the directory is `exact_templates`, so stale templates are removed on apply.
const TEMPLATES = ["../templates/", "../exact_templates/"]
  .map((path) => fileURLToPath(new URL(path, import.meta.url)))
  .find((path) => existsSync(path)) ?? fileURLToPath(new URL("../templates/", import.meta.url));
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

const templatePaths = (): string[] => walk(TEMPLATES).map((path) => relative(TEMPLATES, path));

const print = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const usage = (): never => {
  process.stderr.write(
    "usage: node scripts/decisions.ts files | list | check | leftovers <path...>\n",
  );
  process.exit(2);
};

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "files": {
    print(templatePaths().map(toTemplateFile));
    break;
  }
  case "list": {
    print(collectDecisions(readTemplates()).decisions);
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
