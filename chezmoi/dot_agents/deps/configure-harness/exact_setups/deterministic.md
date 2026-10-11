# Setup: deterministic

Add deterministic means: checks whose result does not depend on judgment, where the harness now relies on review, QA, or prose rules. Each means is a proposal; only the Lean kit has templates, the others are set up with their own tools.

## Prerequisites

The core harness exists with `docs/guidelines/quality-assurance/index.md` and `REVIEW.md`. If it does not, tell the user to run `/configure-harness` first and stop.

## Observe

- The quality-matrix in `docs/guidelines/quality-assurance/index.md`: the rows without ◎, and the methods in use.
- Rules in `REVIEW.md` and the guidelines that a tool could check (a pattern in the code, a forbidden import, a naming rule).
- The means already in place: `.github/workflows/`, code scanning (`gh api repos/{owner}/{repo}/code-scanning/default-setup`), pre-commit hooks, secret scanning configs, PBT libraries in the manifest, `*.lean`, `*.qnt`.
- Whether the repository is public and who owns it (`gh repo view --json visibility,owner`): CodeQL on a private repository needs GitHub Code Security.
- Logic whose properties can be stated (calculations, conversions, state transitions, invariants) and concurrent or distributed protocols.

## Means

| Means | What it catches | Propose it when | How to add |
| --- | --- | --- | --- |
| CodeQL | Known vulnerability patterns in the code (injection, path traversal, unsafe deserialization) | The repository is on GitHub in a language CodeQL supports, and code scanning is off | Turn on default setup (`gh api -X PATCH repos/{owner}/{repo}/code-scanning/default-setup -f state=configured`). Use an advanced workflow (`.github/workflows/codeql.yml`) only when the build needs custom steps |
| gitleaks | Secrets committed to the history | The repository has a remote and no secret scanning | A CI job running the gitleaks CLI (`gitleaks git --redact` over the pushed commits). `gitleaks/gitleaks-action` needs a license key for organization accounts. Add a `.gitleaks.toml` allowlist only for findings confirmed as false positives |
| Lean kit | Errors in calculations, conversions, and invariants, by proving the spec and testing the implementation against it | Logic with stateable properties sits in quality-matrix rows without ◎, or the user wants specs proven | The templates (below) |
| Quint | Design errors in protocols and concurrent or distributed state machines (ordering, races, lost updates) | The product has a protocol or workflow with many interleavings | `.qnt` specs next to the design they model. Check with `quint typecheck` and `quint run --invariant=<name>` (random simulation) in the Feedback Loop; `quint verify` (Apalache, needs a JVM) for exhaustive checks |
| PBT | Boundary values and invariants of functions | Pure logic with invariants, and no PBT library yet | The library for the language (fast-check, Hypothesis, proptest, jqwik, rapid). Write properties for the invariants, and add how to rerun a failing seed to `failure-reproduction` |
| Lint rules | Rules now written in `REVIEW.md` or the guidelines that are visible in the syntax | Such rules exist | ast-grep rules (`sgconfig.yml`) or the existing linter's config and custom rules. Remove the rule from the prose in the same change |

## Plan page

Always show first, as one table: the quality-matrix rows and prose rules each proposed means covers, and what it costs (CI time, a paid plan, a tool to install, specs someone has to write).

Proving specs (Lean) and modeling designs (Quint) add a practice, so they are always shown proposals. CodeQL, gitleaks, PBT, and lint rules follow from the repository; show them only when a cost (a paid plan, CI time) or conflicting observations make them swing.

## Generate

Set up each agreed means as its row in the table says, then update the harness:

- Add the means as a column of the quality-matrix and mark the rows it catches.
- Rewrite `exploratory-focus` for the rows that now have ◎.
- Add its local commands to the Feedback Loop, and say whether CI runs them.
- Remove the prose rules the means now enforces from `REVIEW.md` and the guidelines.

### Lean kit

Generate the kit's units together: `lakefile.toml`, `lean-toolchain`, `scripts/lean-spec.ts`, `spec/Oracle.lean`, `docs/guidelines/quality-assurance/lean-spec.md`. The setup prepares the kit; writing the product's specs is development work after it (propose the first targets in the report).

- Write the latest stable Lean release into `lean-toolchain` (`leanprover/lean4:v<version>`). Add elan to `docs/guidelines/local-dev.md` the way it adds tools, with the note that elan fetches the version in `lean-toolchain` on the first `lake build`.
- Set `globs` in `lakefile.toml` to the directories `lean-spec-scope` names (`src/domain/` → `"src.domain.+"`). Pass the same directories to `lean-spec.ts`; never `spec/`, which holds the oracle, not specs.
- Add `.lake/` to `.gitignore`.
- Add to the Feedback Loop `lake build` (the proofs and `spec-oracle`) when a `*.lean` file changes or `.lake/` does not exist yet (a fresh clone), before the tests that run differential tests; and `node scripts/lean-spec.ts check <dir...>` when a `*.lean` file changes. `scripts/lean-spec.ts` needs Node.js 24.2 or later. If CI runs the tests, add `lake build` (`leanprover/lean-action`) before them in CI in the same change, since the differential tests fail without `spec-oracle`; otherwise propose running both in CI.
- Add the row 「Lean の仕様を書く・変える、差分テストを書く」 → `docs/guidelines/quality-assurance/lean-spec.md` to the AGENTS.md References table.
- For `lean-diff-test`, write the shared part that starts `spec-oracle` and exchanges lines with it, in the repository's language, and the example the guideline shows. `references/lean-diff-test.md` has a reference implementation in TypeScript; take the structure, not the code. Run the example in Verify before putting it in the guideline.

## Verify

Run each added command once and check that it passes. Verify the Lean kit with scratch files, not the product's specs: in a directory `lean-spec-scope` names, add a scratch `*.lean` with one documented definition and one theorem, an implementation of the definition, its case in `spec/Oracle.lean`, and the guideline's example diff test for it. Run `lake build`, `node scripts/lean-spec.ts doc <dir...>`, `check`, and the diff test; break the scratch implementation once and check that the diff test fails with the input and both results. Then remove the scratch files, the case, and the generated `.lean.md`, and run `lake build` and `check` again.
