---
description: '複雑なタスクを独立したサブタスクに分割し、最小限のメモリ使用量で並列実行するオーケストレーターパターン'
---

Split complex tasks into independent subtasks and execute them in parallel with minimal memory usage.

## Process

1. **Analyze and Plan**

   - Break down the main task into 3-5 independent subtasks
   - Identify minimal context needed for each subtask
   - Define clear success criteria for each

2. **Execute Subtasks**

   - Use Task tool to spawn independent agents
   - Provide only essential context to each agent
   - Request concise summary (100-200 words) as output
   - Execute multiple tasks in parallel when possible

3. **Aggregate Results**
   - Collect summaries from all subtasks
   - Synthesize final result based on subtask outputs
   - Report overall progress and completion status

## Example Usage

When given a complex refactoring task:

- Subtask 1: Analyze current code structure (summary only)
- Subtask 2: Identify refactoring targets (list only)
- Subtask 3: Check test coverage (percentage and critical paths)
- Subtask 4: Validate dependencies (compatibility matrix)

Each agent returns only essential findings, preventing memory overflow while maintaining task completeness.

## Key Benefits

- Prevents memory exhaustion on long-running tasks
- Enables parallel execution for faster completion
- Maintains clear task boundaries and responsibilities
- Provides structured progress tracking
