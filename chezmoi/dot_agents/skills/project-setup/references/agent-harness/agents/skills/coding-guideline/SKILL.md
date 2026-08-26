---
name: coding-guideline
description: Use when writing, reviewing, or refactoring application code in this project.
disable-model-invocation: false
user-invocable: true
---

## Core Strategy

The project optimizes for confidence through type checking, testability, and low-fake tests.

- Model domain and UI states with ADTs, discriminated unions, and exhaustive handling.
- Prefer functional, pure logic at the center and stateful I/O at boundaries.
- Keep invalid states unrepresentable whenever practical.
- Test pure rules without I/O and orchestration with the narrowest realistic dependency.
- Avoid mocks when a fast real boundary is available. Use memory routers, in-memory DBs, and typed clients before mocking framework hooks or persistence.
- Prefer high-quality libraries over local framework code or one-off utilities.
- Avoid generic architecture patterns unless they solve a concrete project problem.

## Troubleshooting Boundaries

Do not weaken project checks as a troubleshooting shortcut.

- `tsconfig.json`: Do not change type-checking options unless explicitly instructed. Adding `include`/`exclude` entries is allowed when new files require it.
- `oxlint.config.ts`: Do not change lint rules to silence errors unless explicitly instructed. Prefer the smallest local `oxlint-disable` / `oxlint-ignore` comment when a rule must be bypassed intentionally.

## Required References

Read the relevant reference before editing code in that area:

- Backend/server code: `references/backend/guideline.md`
- Frontend/web code: `references/frontend/guideline.md`

If a change crosses both areas, read both references.
