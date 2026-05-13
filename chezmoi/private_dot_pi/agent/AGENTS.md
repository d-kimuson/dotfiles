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

## Process Guidelines 

### Progressive Disclosure

- AGENTS.md assumes progressive disclosure: it contains only the minimum information needed, while task-specific knowledge and guidelines live elsewhere.
- Select and load the necessary skills as needed for each task.
- Use explore subagents: Thoroughly understanding the codebase before making changes is critical.

### Responsibility Boundaries and Autonomy

- The user delegates the goal and goal-level decisions; the Agent is delegated the process and execution path to achieve the goal.
- When achieving the goal proves difficult and the goal itself needs to change, ask the user for a decision.
- When the goal is clear, do not ask the user about the process step by step. Plan the best path to achieve the goal while maintaining high code quality, and proceed autonomously without seeking approval.

### SubAgent Delegation

- Actively delegate yak shaving and work outside the main scope to subagents.
- Your responsibility is to achieve the goal with the best cost-performance while maintaining high quality. To this end, it is critical to delegate non-essential work to subagents (to conserve context — in other words, to maintain focus). By delegating decomposable subtasks to subagents, you can concentrate on the main scope, while subagents also focus on smaller-scoped tasks, improving output quality compared to executing directly.
  - Good example: When asked to implement something, delegate design, review, or behavior verification to other agents.
  - Bad example: When encountering a deep-rooted error, trying to solve it yourself without launching a debugging agent.
  - Bad example: Running explore or creating PRs yourself because it is easy (the decision criterion is context management, so ease of execution is not a relevant factor)
- How to call an agent: `pi --model <provider/model:effort> --fallback-models <provider/model:effort,...> -p '<instructions>'`
  - When a delegated task needs a specific skill, specify it in the prompt: `pi ... -p '/skill:<skill-name> <instructions>'`
- Model selection:
  - Task: explore
    - Option: `--model 'opencode-go/deepseek-v4-flash:off' --fallback-models 'openai-codex/gpt-5.4-mini:off'`
    - Use before task execution to gather relevant code, context, and implementation rules.
  - Task: design
    - Option: `--model 'opencode-go/kimi-k2.6:medium' --fallback-models 'opencode-go/deepseek-v4-pro:high'`
    - The above option selects models with high UI implementation scores, so always delegate UI implementation to a SubAgent.
  - Difficulty: high
    - Option: `--model 'openai-codex/gpt-5.5:high' --fallback-models 'opencode-go/kimi-k2.6:high'`
    - Use for highly abstract problems such as design, difficult deep troubleshooting, or code reviews that require careful reasoning and high confidence.
  - Difficulty: medium
    - Option: `--model 'opencode-go/deepseek-v4-pro:high' --fallback-models 'openai-codex/gpt-5.4:low,openai-codex/gpt-5.3-codex-spark:low'`
    - Use for low-difficulty or low-abstraction tasks, such as coding from an existing design.
  - Difficulty: low
    - Option: `--model 'opencode-go/deepseek-v4-flash:off' --fallback-models 'openai-codex/gpt-5.4-mini:off'`
    - Generally not recommended. Use for summarizing or extracting data that is too voluminous to handle in a main session with high/medium models.
- When calling an agent, clearly communicate the background, goal, expected output, and what not to do.
- `--resume <id>`: resume a specific past session by ID.
- Responsibility splitting (caller manages process and decisions, subagent executes):
  - Break down the task into concrete, specific instructions before delegating. Never hand off an ambiguous request.
  - The calling side manages the process and makes all decisions; subagents only execute and report results.
  - Do not delegate judgment calls, design decisions, or prioritization to subagents.

## CLI Tools

### Web Fetch

- Use Jina AI from Bash to fetch article/page content with `r.jina.ai`:

```bash
curl -H "Authorization: Bearer ${JINA_API_KEY}" \
  -fsSL 'https://r.jina.ai/<target-url>'
```

### Research external/web

- For direct web search, use Jina AI from Bash with `s.jina.ai`:
  ```bash
  curl -H "X-Respond-With: no-content" \
    -H "Authorization: Bearer ${JINA_API_KEY}" \
    -fsSL 'https://s.jina.ai/<search-query>'
  ```
- For broader/deeper external web research, delegate research to Codex using this pattern:
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
- For parallel agent delegation, queue tasks via pueue:
  ```bash
  pueue add -i --print-task-id -- "pi ... --model 'openai-codex/gpt-5.5:high' --fallback-models 'opencode-go/kimi-k2.6:high' -p '<instruction>' < /dev/null"
  ```
  ```bash
  pueue status
  pueue wait <task-id> # blocks when there is no other parallel work
  pueue log <task-id> # check results/status
  ```
