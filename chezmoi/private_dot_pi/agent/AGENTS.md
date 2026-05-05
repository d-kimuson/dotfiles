# AGENTS.md (User Root)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve the existing language; do not translate them.

## Skills Guidelines

- AGENTS.md assumes progressive disclosure: it contains only the minimum information needed, while task-specific knowledge and guidelines live elsewhere.
- Select and load the necessary skills as needed for each task.

## Coding Style

- Maintain separation of concerns.
- Separate state from logic.
- Prioritize readability and maintainability.
- Follow t-wada-style TDD: implement while continuously verifying behavior with type checking and tests.
- Define contract layers (APIs/types) rigorously using ADTs, and keep implementation layers regenerable.
- Rules that can be checked statically should be expressed with the environment’s linter or ast-grep, not in prompts.

## Agent Delegation

- To keep context clean and preserve accuracy, speed, and cost efficiency, proactively delegate yak shaving and work outside the current focus to an appropriate model agent.
  - Good example: When asked to implement something, delegate design, review, or behavior verification to other agents.
  - Bad example: When encountering a deep-rooted error, trying to solve it yourself without launching a debugging agent.
- How to call an agent: `pi --models <model1>,<model2>,... -p '<instructions>'` (left-priority fallback)
  - When a delegated task needs a specific skill, specify it in the prompt: `pi --models <model1>,<model2>,... -p '/skill:<skill-name> <instructions>'`
- Model selection:
  - Difficulty: high
    - Models: `openai-codex/gpt-5.5,opencode-go/kimi2.6`
    - Use for highly abstract problems such as design, difficult deep troubleshooting, or code reviews that require careful reasoning and high confidence.
  - Difficulty: low
    - Models: `opencode-go/deepseek-v4-pro,openai-codex/gpt-5.4,openai-codex/gpt-5.3-codex-spark`
    - Use for low-difficulty or low-abstraction tasks, such as coding from an existing design.
- When calling an agent, clearly communicate the background, goal, expected output, and what not to do.

## Research

- Research tasks are not feasible with pi alone. Delegate research to Codex using this pattern:
  ```bash
  codex exec -s read-only -a never -m gpt-5.4 '<research instructions>' -o '/tmp/<topic>-report.txt' >/dev/null 2>&1 && cat /tmp/<topic>-report.txt
  ```

## Long-running Tasks and Development Servers

- Do not start long-running processes such as development servers, watchers, or daemons directly from the CLI; use **`pueue`** instead.
- Start them with `pueue add -- <command>`, and use `pueue status` / `pueue log` / `pueue follow` / `pueue kill` / `pueue remove` to check status or manage them.
