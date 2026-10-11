// Writes a Markdown spec next to each Lean file from its doc comments, and checks the Lean specs.
// Run with Node.js 24.2+ from the repository root:
//
//   node scripts/lean-spec.ts doc <dir...>     write <name>.lean.md next to each <name>.lean, remove orphans
//   node scripts/lean-spec.ts check <dir...>   report what keeps the specs from being trusted (exit 1)
//
// Pass the directories the lakefile's `globs` cover. The doc lists the documented declarations as 定義 (data and functions),
// 制約 (definitions whose type ends in Prop), and 定理 (theorem, lemma). Private declarations are left out.
// check reports public declarations without a doc comment, sorry and admit, axiom, and docs that are missing,
// out of date, or left behind by a removed Lean file.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export type DeclarationKind = "definition" | "constraint" | "theorem";
export type Declaration = { readonly kind: DeclarationKind; readonly name: string; readonly doc: string; readonly line: number };

export type Issue =
  | { readonly kind: "missing-doc"; readonly name: string; readonly line: number }
  | { readonly kind: "sorry"; readonly line: number }
  | { readonly kind: "axiom"; readonly name: string; readonly line: number };

export type ParsedLean = {
  readonly moduleDoc: string;
  readonly declarations: readonly Declaration[];
  readonly issues: readonly Issue[];
};

export type Problem = { readonly path: string; readonly line?: number; readonly message: string };

const GENERATOR = "scripts/lean-spec.ts";
const marker = (leanName: string): string => `<!-- Generated from ${leanName} by ${GENERATOR}. Do not edit. -->`;
const isGenerated = (content: string): boolean => content.startsWith("<!-- Generated from ") && content.includes(` by ${GENERATOR}.`);

export const docPath = (leanPath: string): string => `${leanPath.slice(0, -".lean".length)}.lean.md`;
const leanPathOf = (docPath: string): string => docPath.slice(0, -".md".length);

// Comments and strings blanked out with spaces (newlines kept, so offsets and lines stay), and the doc comments found.
type Scanned = {
  readonly code: string;
  readonly docs: readonly { readonly end: number; readonly text: string }[];
  readonly moduleDocs: readonly string[];
};

const blank = (text: string): string => text.replace(/[^\n]/g, " ");

const CHAR_LITERAL = /'(?:\\[^'\n]*|[^\\'\n])'/y;
const IDENTIFIER_CHAR = /[\p{L}\p{N}_'!?.]/u;

const scan = (source: string): Scanned => {
  let code = "";
  const docs: { end: number; text: string }[] = [];
  const moduleDocs: string[] = [];
  let i = 0;

  while (i < source.length) {
    if (source.startsWith("/-", i)) {
      // Block comments nest in Lean
      let depth = 1;
      let j = i + 2;
      while (j < source.length && depth > 0) {
        if (source.startsWith("/-", j)) {
          depth++;
          j += 2;
        } else if (source.startsWith("-/", j)) {
          depth--;
          j += 2;
        } else j++;
      }
      const comment = source.slice(i, j);
      if (comment.startsWith("/--")) docs.push({ end: j, text: dedent(comment.slice(3, -2)) });
      else if (comment.startsWith("/-!")) moduleDocs.push(dedent(comment.slice(3, -2)));
      code += blank(comment);
      i = j;
    } else if (source.startsWith("--", i)) {
      const end = source.indexOf("\n", i);
      const j = end === -1 ? source.length : end;
      code += blank(source.slice(i, j));
      i = j;
    } else if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j += source[j] === "\\" ? 2 : 1;
      code += blank(source.slice(i, j + 1));
      i = j + 1;
    } else if (source[i] === "'" && !IDENTIFIER_CHAR.test(source[i - 1] ?? " ")) {
      CHAR_LITERAL.lastIndex = i;
      const match = CHAR_LITERAL.exec(source);
      const literal = match === null ? "'" : match[0];
      code += match === null ? literal : blank(literal);
      i += literal.length;
    } else {
      code += source[i];
      i++;
    }
  }
  return { code, docs, moduleDocs };
};

// Trims the comment body and removes the indentation its continuation lines share
const dedent = (body: string): string => {
  const [first = "", ...rest] = body.split("\n").map((line) => line.trimEnd());
  const indents = rest.filter((line) => line.trim() !== "").map((line) => /^ */.exec(line)?.[0].length ?? 0);
  const indent = indents.length === 0 ? 0 : Math.min(...indents);
  return [first, ...rest.map((line) => line.slice(indent))].join("\n").trim();
};

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const MODIFIERS = "private|protected|noncomputable|partial|unsafe|nonrec";
const KEYWORDS = "theorem|lemma|def|abbrev|opaque|inductive|structure|class(?:\\s+inductive)?|axiom";
const EVENT = new RegExp(
  [
    `^(?<attributes>(?:[ \\t]*@\\[[^\\]]*\\]\\s*)*)[ \\t]*(?<modifiers>(?:(?:${MODIFIERS})\\s+)*)(?<keyword>${KEYWORDS})\\s+(?<name>[^\\s:({\\[⦃]+)`,
    `^[ \\t]*(?<scope>namespace|section)\\b[ \\t]*(?<scopeName>[^\\s]*)`,
    `^[ \\t]*end\\b`,
  ].join("|"),
  "gmu",
);
const HEADER_END = /:=|\bwhere\b|\n\s*\||$(?![\s\S])/g;
const SORRY = /(?<![\p{L}\p{N}_'.])(?:sorry|admit)(?![\p{L}\p{N}_'!?])/gu;

const kindOf = (keyword: string, header: string): DeclarationKind | "axiom" => {
  if (keyword === "theorem" || keyword === "lemma") return "theorem";
  if (keyword === "axiom") return "axiom";
  return /\bProp$/.test(header.trimEnd()) ? "constraint" : "definition";
};

export const parseLean = (source: string): ParsedLean => {
  const { code, docs, moduleDocs } = scan(source);
  const scopes: { readonly kind: string; readonly name: string }[] = [];
  const declarations: Declaration[] = [];
  const issues: (Issue & { readonly offset: number })[] = [];

  for (const match of code.matchAll(EVENT)) {
    const groups = match.groups ?? {};
    if (groups["scope"] !== undefined) {
      scopes.push({ kind: groups["scope"], name: groups["scopeName"] ?? "" });
      continue;
    }
    if (groups["keyword"] === undefined) {
      scopes.pop();
      continue;
    }

    const keyword = groups["keyword"];
    const modifiers = groups["modifiers"] ?? "";
    const rawName = groups["name"] ?? "";
    const start = match.index + (groups["attributes"] ?? "").length;
    const namespace = scopes.filter((scope) => scope.kind === "namespace" && scope.name !== "").map((scope) => scope.name);
    const name = rawName.startsWith("_root_.") ? rawName.slice("_root_.".length) : [...namespace, rawName].join(".");
    const line = lineAt(code, start + (code.slice(start).search(/\S/)));

    const nameEnd = match.index + match[0].length;
    HEADER_END.lastIndex = nameEnd;
    const headerEnd = HEADER_END.exec(code)?.index ?? code.length;
    const kind = kindOf(keyword, code.slice(nameEnd, headerEnd));

    if (kind === "axiom") {
      issues.push({ kind: "axiom", name, line, offset: match.index });
      continue;
    }
    if (/\bprivate\b/.test(modifiers)) continue;

    const doc = docs.findLast((candidate) => candidate.end <= match.index);
    if (doc === undefined || code.slice(doc.end, match.index).trim() !== "") {
      issues.push({ kind: "missing-doc", name, line, offset: match.index });
      continue;
    }
    declarations.push({ kind, name, doc: doc.text, line });
  }

  for (const match of code.matchAll(SORRY)) issues.push({ kind: "sorry", line: lineAt(code, match.index), offset: match.index });

  return {
    moduleDoc: moduleDocs.join("\n\n"),
    declarations,
    issues: issues.sort((a, b) => a.offset - b.offset).map(({ offset: _, ...issue }) => issue),
  };
};

const SECTIONS: readonly (readonly [DeclarationKind, string])[] = [
  ["definition", "定義"],
  ["constraint", "制約"],
  ["theorem", "定理"],
];

const bullet = (declaration: Declaration): string =>
  `- \`${declaration.name}\`: ${declaration.doc
    .split("\n")
    .map((line, index) => (index === 0 || line === "" ? line : `  ${line}`))
    .join("\n")}`;

export const renderDoc = (leanPath: string, parsed: ParsedLean): string => {
  const leanName = basename(leanPath);
  const blocks = [marker(leanName), `# ${leanName.slice(0, -".lean".length)}`];
  if (parsed.moduleDoc !== "") blocks.push(parsed.moduleDoc);
  for (const [kind, heading] of SECTIONS) {
    const items = parsed.declarations.filter((declaration) => declaration.kind === kind);
    if (items.length > 0) blocks.push(`## ${heading}`, items.map(bullet).join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
};

type Files = Readonly<Record<string, string>>;

// What `doc` changes: every Lean file's doc, and the generated docs whose Lean file is gone
export const planDocs = (lean: Files, docs: Files): { readonly write: Files; readonly remove: readonly string[] } => ({
  write: Object.fromEntries(Object.entries(lean).map(([path, source]) => [docPath(path), renderDoc(path, parseLean(source))])),
  remove: Object.entries(docs)
    .filter(([path, content]) => isGenerated(content) && !(leanPathOf(path) in lean))
    .map(([path]) => path),
});

const describeIssue = (issue: Issue): string => {
  switch (issue.kind) {
    case "missing-doc":
      return `\`${issue.name}\` has no doc comment`;
    case "sorry":
      return "unfinished proof (sorry or admit)";
    case "axiom":
      return `\`${issue.name}\` is an axiom; prove it or state it as a hypothesis`;
  }
};

export const checkTree = (lean: Files, docs: Files): Problem[] => {
  const problems: Problem[] = [];
  const { write, remove } = planDocs(lean, docs);
  for (const [path, source] of Object.entries(lean)) {
    for (const issue of parseLean(source).issues) problems.push({ path, line: issue.line, message: describeIssue(issue) });
  }
  for (const [path, content] of Object.entries(write)) {
    if (!(path in docs)) problems.push({ path, message: `missing; run \`node ${GENERATOR} doc\`` });
    else if (docs[path] !== content) problems.push({ path, message: `out of date; run \`node ${GENERATOR} doc\`` });
  }
  for (const path of remove) problems.push({ path, message: `its Lean file is gone; run \`node ${GENERATOR} doc\`` });
  return problems.sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0));
};

const SKIPPED = new Set([".git", ".lake", "node_modules"]);

const walk = (dir: string, accept: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : walk(path, accept);
    return entry.isFile() && accept(entry.name) ? [path] : [];
  });

const read = (dirs: readonly string[], accept: (name: string) => boolean): Files =>
  Object.fromEntries(dirs.flatMap((dir) => walk(dir, accept)).map((path) => [path, readFileSync(path, "utf8")]));

const main = (args: readonly string[]): void => {
  const [command, ...dirs] = args;
  const missing = dirs.filter((dir) => !existsSync(dir));
  if (missing.length > 0 || dirs.length === 0 || (command !== "doc" && command !== "check")) {
    if (missing.length > 0) process.stderr.write(`not found: ${missing.join(", ")}\n`);
    process.stderr.write(`usage: node ${GENERATOR} doc|check <dir...>\n`);
    process.exit(2);
  }

  const lean = read(dirs, (name) => name.endsWith(".lean") && name !== "lakefile.lean");
  const docs = read(dirs, (name) => name.endsWith(".lean.md"));

  if (command === "doc") {
    const { write, remove } = planDocs(lean, docs);
    for (const [path, content] of Object.entries(write)) if (docs[path] !== content) writeFileSync(path, content);
    for (const path of remove) rmSync(path);
    return;
  }

  const problems = checkTree(lean, docs);
  for (const problem of problems) {
    process.stdout.write(`${problem.path}${problem.line === undefined ? "" : `:${problem.line}`}: ${problem.message}\n`);
  }
  if (problems.length > 0) process.exit(1);
};

if (import.meta.main) main(process.argv.slice(2));
