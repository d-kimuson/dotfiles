# Coding Process

## Recommended Coding Process

This project is designed with the philosophy of achieving both rapid feedback and code quality maintenance (passing checks = nearly guaranteed runtime correctness) by leveraging:

- Strict typing with ADT
- Constraints for maintaining code quality configured in Lint as much as possible
- Dependency injection and effective testing

For development, implement with TDD development style.

For checks, run `pnpm gatecheck check` to execute all checks against the diff at once, then proceed with implementation in a loop of problem detection and fixing with gatecheck.

## Definition of Done

On task completion, verify ALL of the following pass in addition to task-specific ACs.

```bash
pnpm gatecheck check
```

{If there are checks not covered by gatecheck, list them here:}
{- Manual verification steps}
{- Integration/E2E checks}

## Notable Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build for production |
| `pnpm generate` | Run code generation |

{Add project-specific commands, deployment steps, and workflows as needed.}
