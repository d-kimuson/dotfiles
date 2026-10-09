import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectDecisions,
  findLeftovers,
  parseDecisionBlocks,
  toTemplateFile,
} from "./decision-block.ts";

describe("parseDecisionBlocks", () => {
  it("returns no blocks and no issues for plain Markdown", () => {
    assert.deepEqual(parseDecisionBlocks("# Title\n\nbody\n"), { blocks: [], issues: [] });
  });

  it("parses a block with the three fields", () => {
    const source = [
      "# Commit",
      "",
      "<!-- decision: commit-message-format",
      "  決めること: コミットメッセージの規約",
      "  観察: git log の直近 50 件",
      "  書き方: 採用した規約を 1〜2 行で書く",
      "-->",
    ].join("\n");

    assert.deepEqual(parseDecisionBlocks(source), {
      blocks: [
        {
          id: "commit-message-format",
          line: 3,
          decide: "コミットメッセージの規約",
          observe: "git log の直近 50 件",
          write: "採用した規約を 1〜2 行で書く",
        },
      ],
      issues: [],
    });
  });

  it("joins continuation lines into the preceding field", () => {
    const source = [
      "<!-- decision: a",
      "  決めること: x",
      "  観察: y",
      "  書き方: first",
      "          second",
      "-->",
    ].join("\n");

    assert.equal(parseDecisionBlocks(source).blocks[0]?.write, "first\nsecond");
  });

  it("reports a missing field", () => {
    const source = ["<!-- decision: a", "  決めること: x", "  書き方: z", "-->"].join("\n");

    assert.deepEqual(parseDecisionBlocks(source).issues, [
      { kind: "missing-field", line: 1, id: "a", field: "観察" },
    ]);
  });

  it("reports an unknown field", () => {
    const source = [
      "<!-- decision: a",
      "  決めること: x",
      "  観察: y",
      "  書き方: z",
      "  質問: w",
      "-->",
    ].join("\n");

    assert.deepEqual(parseDecisionBlocks(source).issues, [
      { kind: "unknown-field", line: 5, id: "a", field: "質問" },
    ]);
  });

  it("reports an invalid id", () => {
    const source = ["<!-- decision: Bad_Id", "  決めること: x", "  観察: y", "  書き方: z", "-->"].join(
      "\n",
    );

    assert.deepEqual(parseDecisionBlocks(source).issues, [
      { kind: "invalid-id", line: 1, id: "Bad_Id" },
    ]);
  });

  it("reports an unclosed block", () => {
    const source = ["<!-- decision: a", "  決めること: x"].join("\n");

    assert.deepEqual(parseDecisionBlocks(source).issues, [{ kind: "unclosed", line: 1, id: "a" }]);
  });

  it("reports a block written on one line", () => {
    assert.deepEqual(parseDecisionBlocks("<!-- decision: a -->\n").issues, [
      { kind: "single-line", line: 1, id: "a" },
    ]);
  });

  it("reports a field written twice", () => {
    const source = [
      "<!-- decision: a",
      "  決めること: x",
      "  観察: y",
      "  書き方: z",
      "  書き方: w",
      "-->",
    ].join("\n");

    assert.deepEqual(parseDecisionBlocks(source).issues, [
      { kind: "duplicate-field", line: 5, id: "a", field: "書き方" },
    ]);
  });

  it("ignores ordinary HTML comments", () => {
    assert.deepEqual(parseDecisionBlocks("<!-- TODO: fill -->\n"), { blocks: [], issues: [] });
  });
});

describe("toTemplateFile", () => {
  it("keeps the path of a template that is always generated", () => {
    assert.deepEqual(toTemplateFile("docs/guidelines/commit.md"), {
      template: "docs/guidelines/commit.md",
      target: "docs/guidelines/commit.md",
      optional: null,
    });
  });

  it("drops the optional marker from a file name and reports the file as the optional unit", () => {
    assert.deepEqual(toTemplateFile("docs/guidelines/writing/adr.optional.md"), {
      template: "docs/guidelines/writing/adr.optional.md",
      target: "docs/guidelines/writing/adr.md",
      optional: "docs/guidelines/writing/adr.md",
    });
  });

  it("reports the optional directory as the unit of every file under it", () => {
    assert.deepEqual(toTemplateFile(".agents/skills/review.optional/SKILL.md"), {
      template: ".agents/skills/review.optional/SKILL.md",
      target: ".agents/skills/review/SKILL.md",
      optional: ".agents/skills/review",
    });
  });

  it("keeps a name that only contains the word optional", () => {
    assert.equal(toTemplateFile("docs/optional-features.md").target, "docs/optional-features.md");
  });
});

const block = (id: string): string =>
  [`<!-- decision: ${id}`, "  決めること: x", "  観察: y", "  書き方: z", "-->"].join("\n");

describe("collectDecisions", () => {
  it("lists decisions with their template and target paths", () => {
    const result = collectDecisions([{ path: "docs/guidelines/commit.md", source: block("commit-message-format") }]);

    assert.deepEqual(result, {
      decisions: [
        {
          id: "commit-message-format",
          template: "docs/guidelines/commit.md",
          target: "docs/guidelines/commit.md",
          optional: null,
          line: 1,
          decide: "x",
          observe: "y",
          write: "z",
        },
      ],
      issues: [],
    });
  });

  it("reports the optional unit of a decision in an optional template", () => {
    const result = collectDecisions([{ path: "docs/guidelines/writing/adr.optional.md", source: block("adr-location") }]);

    assert.equal(result.decisions[0]?.optional, "docs/guidelines/writing/adr.md");
  });

  it("reports ids used in more than one place", () => {
    const result = collectDecisions([
      { path: "a.md", source: block("same") },
      { path: "b.md", source: block("same") },
    ]);

    assert.deepEqual(result.issues, [{ kind: "duplicate-id", id: "same", template: "b.md", line: 1, first: "a.md" }]);
  });

  it("attaches the template path to parse issues", () => {
    const result = collectDecisions([{ path: "a.md", source: "<!-- decision: a\n" }]);

    assert.deepEqual(result.issues, [{ kind: "unclosed", id: "a", template: "a.md", line: 1 }]);
  });

  it("reports an optional template nested in an optional directory", () => {
    const result = collectDecisions([{ path: ".agents/skills/review.optional/extra.optional.md", source: "" }]);

    assert.deepEqual(result.issues, [
      { kind: "nested-optional", template: ".agents/skills/review.optional/extra.optional.md" },
    ]);
  });
});

describe("findLeftovers", () => {
  it("finds unresolved decision blocks and TODO comments", () => {
    const result = findLeftovers([
      { path: "AGENTS.md", source: `# x\n\n<!-- TODO: プロダクト概要を書く -->\n` },
      { path: "docs/guidelines/commit.md", source: `# Commit\n${block("commit-message-format")}` },
    ]);

    assert.deepEqual(result, {
      decisions: [{ path: "docs/guidelines/commit.md", line: 2, id: "commit-message-format" }],
      todos: [{ path: "AGENTS.md", line: 3, text: "プロダクト概要を書く" }],
    });
  });

  it("returns nothing for a resolved harness", () => {
    assert.deepEqual(findLeftovers([{ path: "AGENTS.md", source: "# x\n" }]), {
      decisions: [],
      todos: [],
    });
  });
});
