// Parser for the decision blocks embedded in the templates, and the mapping from a template path to
// the path it is generated at. Pure functions only; file IO lives in decisions.ts.

export type DecisionBlock = {
  readonly id: string;
  readonly line: number;
  readonly decide: string;
  readonly observe: string;
  readonly write: string;
};

export type FieldLabel = "決めること" | "観察" | "書き方";

export type ParseIssue =
  | { readonly kind: "invalid-id"; readonly line: number; readonly id: string }
  | { readonly kind: "missing-field"; readonly line: number; readonly id: string; readonly field: FieldLabel }
  | { readonly kind: "unknown-field"; readonly line: number; readonly id: string; readonly field: string }
  | { readonly kind: "duplicate-field"; readonly line: number; readonly id: string; readonly field: FieldLabel }
  | { readonly kind: "single-line"; readonly line: number; readonly id: string }
  | { readonly kind: "unclosed"; readonly line: number; readonly id: string };

export type ParseResult = {
  readonly blocks: readonly DecisionBlock[];
  readonly issues: readonly ParseIssue[];
};

const FIELD_KEYS = {
  決めること: "decide",
  観察: "observe",
  書き方: "write",
} as const satisfies Record<FieldLabel, keyof DecisionBlock>;

const FIELD_LABELS = Object.keys(FIELD_KEYS) as FieldLabel[];

const isFieldLabel = (label: string): label is FieldLabel => Object.hasOwn(FIELD_KEYS, label);

const OPEN = /^\s*<!--\s*decision:\s*(\S*)\s*$/;
// A block closed on its opening line has no room for the fields, so it is reported instead of skipped.
const SINGLE_LINE = /^\s*<!--\s*decision:\s*(\S*?)\s*-->\s*$/;
const CLOSE = /^\s*-->\s*$/;
const FIELD = /^\s*([^\s:：]+)\s*[:：]\s*(.*)$/;
const VALID_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Fields = Partial<Record<FieldLabel, string[]>>;

export const parseDecisionBlocks = (source: string): ParseResult => {
  const lines = source.split("\n");
  const blocks: DecisionBlock[] = [];
  const issues: ParseIssue[] = [];

  let index = 0;
  while (index < lines.length) {
    const single = SINGLE_LINE.exec(lines[index] ?? "");
    if (single !== null) {
      issues.push({ kind: "single-line", line: index + 1, id: single[1] ?? "" });
      index += 1;
      continue;
    }
    const open = OPEN.exec(lines[index] ?? "");
    if (open === null) {
      index += 1;
      continue;
    }

    const id = open[1] ?? "";
    const line = index + 1;
    const fields: Fields = {};
    const fieldIssues: ParseIssue[] = [];
    let current: string[] | undefined;
    let closed = false;

    index += 1;
    while (index < lines.length) {
      const text = lines[index] ?? "";
      if (CLOSE.test(text)) {
        closed = true;
        index += 1;
        break;
      }
      const field = FIELD.exec(text);
      if (field !== null) {
        const label = field[1] ?? "";
        if (isFieldLabel(label)) {
          if (fields[label] !== undefined) {
            fieldIssues.push({ kind: "duplicate-field", line: index + 1, id, field: label });
          }
          current = [(field[2] ?? "").trim()];
          fields[label] = current;
        } else {
          current = undefined;
          fieldIssues.push({ kind: "unknown-field", line: index + 1, id, field: label });
        }
      } else if (text.trim() !== "" && current !== undefined) {
        current.push(text.trim());
      }
      index += 1;
    }

    if (!closed) {
      issues.push({ kind: "unclosed", line, id });
      break;
    }
    if (!VALID_ID.test(id)) {
      issues.push({ kind: "invalid-id", line, id });
    }
    issues.push(...fieldIssues);

    const missing = FIELD_LABELS.filter((label) => fields[label] === undefined);
    issues.push(...missing.map((field) => ({ kind: "missing-field", line, id, field }) as const));
    if (missing.length === 0 && VALID_ID.test(id)) {
      blocks.push({
        id,
        line,
        decide: fields.決めること?.join("\n") ?? "",
        observe: fields.観察?.join("\n") ?? "",
        write: fields.書き方?.join("\n") ?? "",
      });
    }
  }

  return { blocks, issues };
};

// Template directories cannot start with a dot because chezmoi ignores dot entries in its source
// state, so `agents/` and `github/` stand for `.agents/` and `.github/`.
const DOT_DIRECTORIES = new Set(["agents", "github", "claude"]);

export const toTargetPath = (templatePath: string): string => {
  const segments = templatePath.split("/");
  const rest = segments[0] === "optional" ? segments.slice(2) : segments.slice(1);
  const [head, ...tail] = rest;
  if (head === undefined) return "";
  return [DOT_DIRECTORIES.has(head) && tail.length > 0 ? `.${head}` : head, ...tail].join("/");
};

export type SourceFile = { readonly path: string; readonly source: string };

export type Decision = Omit<DecisionBlock, "line"> & {
  readonly template: string;
  readonly target: string;
  readonly category: string;
  readonly line: number;
};

export type TemplateIssue =
  | (ParseIssue & { readonly template: string })
  | {
      readonly kind: "duplicate-id";
      readonly id: string;
      readonly template: string;
      readonly line: number;
      readonly first: string;
    };

const categoryOf = (templatePath: string): string => {
  const segments = templatePath.split("/");
  return segments[0] === "optional" ? segments.slice(0, 2).join("/") : (segments[0] ?? "");
};

export const collectDecisions = (
  files: readonly SourceFile[],
): { readonly decisions: readonly Decision[]; readonly issues: readonly TemplateIssue[] } => {
  const decisions: Decision[] = [];
  const issues: TemplateIssue[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const parsed = parseDecisionBlocks(file.source);
    issues.push(...parsed.issues.map((issue) => ({ ...issue, template: file.path })));
    for (const block of parsed.blocks) {
      const first = seen.get(block.id);
      if (first !== undefined) {
        issues.push({ kind: "duplicate-id", id: block.id, template: file.path, line: block.line, first });
        continue;
      }
      seen.set(block.id, file.path);
      decisions.push({
        ...block,
        template: file.path,
        target: toTargetPath(file.path),
        category: categoryOf(file.path),
      });
    }
  }

  return { decisions, issues };
};

export type Leftovers = {
  readonly decisions: readonly { readonly path: string; readonly line: number; readonly id: string }[];
  readonly todos: readonly { readonly path: string; readonly line: number; readonly text: string }[];
};

const LEFTOVER_DECISION = /<!--\s*decision:\s*(\S*)/;
const LEFTOVER_TODO = /<!--\s*TODO:\s*(.*?)\s*(?:-->|$)/;

export const findLeftovers = (files: readonly SourceFile[]): Leftovers => {
  const decisions: { path: string; line: number; id: string }[] = [];
  const todos: { path: string; line: number; text: string }[] = [];

  for (const file of files) {
    file.source.split("\n").forEach((text, index) => {
      const decision = LEFTOVER_DECISION.exec(text);
      if (decision !== null) decisions.push({ path: file.path, line: index + 1, id: decision[1] ?? "" });
      const todo = LEFTOVER_TODO.exec(text);
      if (todo !== null) todos.push({ path: file.path, line: index + 1, text: todo[1] ?? "" });
    });
  }

  return { decisions, todos };
};
