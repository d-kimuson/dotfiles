# AGENTS.md (User Root)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve the existing language; do not translate them.

## Coding Style

- Maintain separation of concerns.
- Separate state from logic.
- Prioritize readability and maintainability.
- Follow t-wada-style TDD: implement while continuously verifying behavior with type checking and tests.
- Define contract layers (APIs/types) rigorously using ADTs, and keep implementation layers regenerable.
- Rules that can be checked statically should be expressed with the environment’s linter or ast-grep, not in prompts.
- Avoid "Not Invented Here" syndrome; use appropriate libraries.

## Responsibility Boundaries and Autonomy

- The user defines the goal; the Agent owns the process and execution path to achieve it. This boundary is non-negotiable.
- When achieving the goal proves difficult and the goal itself needs to change, ask the user for a decision.
- When the goal is clear, do not ask the user about the process step by step. Plan the best path to achieve the goal while maintaining high code quality, and proceed autonomously without seeking approval.
- **Process Guidelines compliance**: The process is delegated to the Agent, but the "Process Guidelines" below encode proven practices that consistently produce effective output. Maximize adherence to these guidelines — treat them as the default playbook. Within that compliance envelope, choose whatever approach works best. The guidelines are a means to high-quality results, not a constraint.

## Process Guidelines 

### Progressive Disclosure

- AGENTS.md assumes progressive disclosure: it contains only the minimum information needed, while task-specific knowledge and guidelines live elsewhere.
- Select and load the necessary skills as needed for each task.
- Use `scout` subagents: Thoroughly understanding the codebase before making changes is critical.

### SubAgent Delegation

- Actively delegate yak shaving and work outside the main scope to subagents.
- Your responsibility is to achieve the goal with the best cost-performance while maintaining high quality. To this end, it is critical to delegate non-essential work to subagents (to conserve context — in other words, to maintain focus). By delegating decomposable subtasks to subagents, you can concentrate on the main scope, while subagents also focus on smaller-scoped tasks, improving output quality compared to executing directly.
  - Good example: When asked to implement something, delegate design, review, or behavior verification to other agents.
  - Bad example: When encountering a deep-rooted error, trying to solve it yourself without launching a debugging agent.
  - Bad example: Running scout yourself because it is easy (the decision criterion is context management, so ease of execution is not a relevant factor)

## CLI Tools

### Delegate Research to codex

For broader/deeper external web research, delegate research to Codex using this pattern:

```bash
codex -a never exec \
  -s read-only \
  -m gpt-5.4-mini \
  '<research instructions>' \
  -o '/tmp/<topic>-report.txt' \
  < /dev/null \
  >/dev/null 2>&1 && cat '/tmp/<topic>-report.txt'
```

### pueue: Long-running Tasks and Development Servers

- Do not start long-running processes such as development servers, watchers, or daemons directly from the CLI; use **`pueue`** instead.
- Start them with `pueue add -- <command>`, and use `pueue status` / `pueue log` / `pueue follow` / `pueue kill` / `pueue remove` to check status or manage them.
