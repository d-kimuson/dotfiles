# Coding Process

## Recommended Coding Process

This project is designed with the philosophy of achieving both rapid feedback and code quality maintenance (passing checks = nearly guaranteed runtime correctness) by leveraging:

- Strict typing with ADT
- Constraints for maintaining code quality configured in Lint as much as possible
- Explicit data flow and effective testing

For development, implement with TDD development style.

For checks, run `pnpm gatecheck check` to execute all checks against the diff at once, then proceed with implementation in a loop of problem detection and fixing with gatecheck.

## Definition of Done

On task completion, verify ALL of the following pass in addition to task-specific ACs.

```bash
pnpm gatecheck check
```

Gatecheck should cover: typecheck, lint, build, related tests, and format checks. If the project has checks not covered by gatecheck, list and run them explicitly.

## Notable Commands

| Command | Purpose |
|---------|---------|
| `pnpm typecheck` | Type check |
| `pnpm lint` | Lint and format check |
| `pnpm test` | Unit / integration tests |
| `pnpm build` | Production build |
| `pnpm gatecheck check` | Diff-aware quality gate |

{Customize: add project-specific generation, migration, deploy, and E2E commands.}
