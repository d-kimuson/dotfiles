import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkTree, docPath, parseLean, planDocs, renderDoc } from "../exact_templates/deterministic/scripts/lean-spec.optional.ts";

const SPEC = `/-! 割引の計算。 -/
namespace Discount

/-- 割引率は 0 以上 100 以下のパーセント。 -/
structure Rate where
  percent : Nat
  le_100 : percent ≤ 100

/-- 割引後の価格は、元の価格から割引率分を
切り捨てて引いた値。 -/
def apply (price : Nat) (r : Rate) : Nat := price - price * r.percent / 100

/-- 価格が正であること。 -/
def Positive (price : Nat) : Prop := 0 < price

-- 補助の補題 (説明は要らない)
private theorem helper : True := trivial

/-- 割引後の価格は元の価格を超えない。 -/
@[simp]
theorem apply_le (price : Nat) (r : Rate) : apply price r ≤ price := Nat.sub_le _ _

end Discount
`;

describe("parseLean", () => {
  it("reads the module doc and classifies documented declarations", () => {
    const parsed = parseLean(SPEC);
    assert.equal(parsed.moduleDoc, "割引の計算。");
    assert.deepEqual(
      parsed.declarations.map(({ kind, name, doc }) => ({ kind, name, doc })),
      [
        { kind: "definition", name: "Discount.Rate", doc: "割引率は 0 以上 100 以下のパーセント。" },
        { kind: "definition", name: "Discount.apply", doc: "割引後の価格は、元の価格から割引率分を\n切り捨てて引いた値。" },
        { kind: "constraint", name: "Discount.Positive", doc: "価格が正であること。" },
        { kind: "theorem", name: "Discount.apply_le", doc: "割引後の価格は元の価格を超えない。" },
      ],
    );
    assert.deepEqual(parsed.issues, []);
  });

  it("treats an inductive predicate as a constraint", () => {
    const parsed = parseLean("/-- 偶数である。 -/\ninductive Even : Nat → Prop where\n  | zero : Even 0\n");
    assert.deepEqual(parsed.declarations.map(({ kind, name }) => ({ kind, name })), [{ kind: "constraint", name: "Even" }]);
  });

  it("reports declarations without a doc comment, sorry, admit, and axiom", () => {
    const source = [
      "def total (n : Nat) : Nat := n",
      "/-- 常に成り立つ。 -/",
      "theorem t : 1 = 1 := by sorry",
      "/-- 前提。 -/",
      "axiom a : False",
      "/-- 証明を後回しにした。 -/",
      "theorem u : 2 = 2 := by admit",
    ].join("\n");
    assert.deepEqual(parseLean(source).issues, [
      { kind: "missing-doc", name: "total", line: 1 },
      { kind: "sorry", line: 3 },
      { kind: "axiom", name: "a", line: 5 },
      { kind: "sorry", line: 7 },
    ]);
  });

  it("ignores keywords inside comments and strings", () => {
    const source = '/- sorry -/\n-- axiom x : False\n/-- 名前。 -/\ndef name : String := "sorry"\n';
    assert.deepEqual(parseLean(source).issues, []);
  });

  it("skips nested block comments", () => {
    const source = "/- outer /- inner -/ still comment def hidden : Nat := 1 -/\n/-- 一。 -/\ndef one : Nat := 1\n";
    assert.deepEqual(parseLean(source).declarations.map(({ name }) => name), ["one"]);
  });
});

describe("renderDoc", () => {
  it("lists definitions, constraints, and theorems under the module doc", () => {
    assert.equal(
      renderDoc("src/pricing/discount.lean", parseLean(SPEC)),
      [
        "<!-- Generated from discount.lean by scripts/lean-spec.ts. Do not edit. -->",
        "",
        "# discount",
        "",
        "割引の計算。",
        "",
        "## 定義",
        "",
        "- `Discount.Rate`: 割引率は 0 以上 100 以下のパーセント。",
        "- `Discount.apply`: 割引後の価格は、元の価格から割引率分を",
        "  切り捨てて引いた値。",
        "",
        "## 制約",
        "",
        "- `Discount.Positive`: 価格が正であること。",
        "",
        "## 定理",
        "",
        "- `Discount.apply_le`: 割引後の価格は元の価格を超えない。",
        "",
      ].join("\n"),
    );
  });

  it("leaves out empty sections", () => {
    const rendered = renderDoc("a.lean", parseLean("/-- 一。 -/\ndef one : Nat := 1\n"));
    assert.equal(rendered.includes("## 制約"), false);
    assert.equal(rendered.includes("## 定理"), false);
  });
});

describe("docPath", () => {
  it("puts the doc next to the Lean file", () => {
    assert.equal(docPath("src/pricing/discount.lean"), "src/pricing/discount.lean.md");
  });
});

describe("planDocs", () => {
  it("writes a doc per Lean file and removes generated docs whose Lean file is gone", () => {
    const lean = { "src/a.lean": "/-- 一。 -/\ndef one : Nat := 1\n" };
    const docs = {
      "src/a.lean.md": "old",
      "src/gone.lean.md": renderDoc("src/gone.lean", parseLean("")),
      "src/hand.lean.md": "# 手書き\n",
    };
    assert.deepEqual(planDocs(lean, docs), {
      write: { "src/a.lean.md": renderDoc("src/a.lean", parseLean(lean["src/a.lean"])) },
      remove: ["src/gone.lean.md"],
    });
  });
});

describe("checkTree", () => {
  it("passes when every Lean file is documented and its doc is current", () => {
    const lean = { "src/a.lean": "/-- 一。 -/\ndef one : Nat := 1\n" };
    assert.deepEqual(checkTree(lean, planDocs(lean, {}).write), []);
  });

  it("reports source issues, missing and stale docs, and orphan docs", () => {
    const lean = {
      "src/a.lean": "def one : Nat := 1\n",
      "src/b.lean": "/-- 二。 -/\ndef two : Nat := 2\n",
      "src/c.lean": "/-- 三。 -/\ndef three : Nat := 3\n",
    };
    const docs = {
      "src/a.lean.md": renderDoc("src/a.lean", parseLean(lean["src/a.lean"])),
      "src/b.lean.md": "stale",
      "src/gone.lean.md": renderDoc("src/gone.lean", parseLean("")),
    };
    assert.deepEqual(checkTree(lean, docs), [
      { path: "src/a.lean", line: 1, message: "`one` has no doc comment" },
      { path: "src/b.lean.md", message: "out of date; run `node scripts/lean-spec.ts doc`" },
      { path: "src/c.lean.md", message: "missing; run `node scripts/lean-spec.ts doc`" },
      { path: "src/gone.lean.md", message: "its Lean file is gone; run `node scripts/lean-spec.ts doc`" },
    ]);
  });
});
