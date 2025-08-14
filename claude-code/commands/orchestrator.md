---
description: '複雑なタスクを独立したサブタスクに分割し、最小限のメモリ使用量で並列実行するオーケストレーターパターン'
---

Split complex tasks into independent subtasks and execute them in parallel with minimal memory usage.

## Process

1. **Analyze and Plan**

   - **Discover Available Commands**: Use Glob tool to list `**/*.md` files in `~/.claude/commands` and `./.claude/commands` directories
   - **Evaluate Command Suitability**: Read each command's front matter description to identify relevant commands for subtasks
   - **Task Decomposition**: Break the main task into 3-5 subtasks following these criteria:
     - Each subtask should be executable independently (no shared state dependencies)
     - Each subtask should take 5-15 minutes to complete
     - Subtasks should have clear, measurable outputs
     - Group related operations that share similar context requirements
   - **Context Minimization**: For each subtask, identify only the essential files, data, or parameters needed
   - **Success Criteria**: Define specific, verifiable success metrics (e.g., "find 3+ performance bottlenecks", "generate working test cases")
   - **Command Mapping**: Match available commands to subtasks based on functionality overlap

2. **Execute Subtasks**

   - **Task Tool Usage**: Spawn independent agents using Task tool with these guidelines:
     - Include relevant `/command-name` invocations in the prompt when applicable commands exist
     - Limit context to essential information only (avoid full file contents unless necessary)
     - Request structured output: "Return a concise summary (100-200 words) with actionable findings"
     - Specify expected deliverables clearly (e.g., "list of file paths", "error analysis report")
   - **Parallel Execution**: Execute independent subtasks simultaneously; for dependent subtasks, execute in logical sequence
   - **Error Handling**: If a subtask fails, capture the error and continue with remaining subtasks

3. **Aggregate Results**
   - Collect and validate outputs from all completed subtasks
   - Identify any failed subtasks and their impact on overall goal
   - Synthesize findings into cohesive final result
   - Report completion status with success/failure breakdown

## Example Usage

**Scenario**: "Optimize React application performance"

**Planning Phase:**

1. Use `Glob(pattern: "**/*.md", path: "~/.claude/commands")` to discover available commands
2. Find relevant commands (example): `/analyze-performance`, `/check-bundle-size`, `/audit-dependencies`

**Task Decomposition:**

- Subtask 1: Bundle analysis (independent, ~10 min, output: size breakdown with recommendations)
- Subtask 2: Component performance audit (independent, ~15 min, output: list of slow components)
- Subtask 3: Dependency optimization (independent, ~10 min, output: unused dependencies list)
- Subtask 4: Code splitting opportunities (depends on Subtask 1, ~10 min, output: splitting strategy)

**Task Tool Execution:**

```text
// Parallel execution (Subtasks 1-3)
Task(
  description: "Bundle size analysis",
  prompt: "/check-bundle-size src/ Return bundle analysis with top 10 largest files and optimization recommendations (150 words max)"
)

Task(
  description: "Component performance audit", 
  prompt: "/analyze-performance src/components/ Identify components with >100ms render time and memory leaks. Return prioritized list (150 words)"
)

// Sequential execution (Subtask 4 after Subtask 1)
Task(
  description: "Code splitting strategy",
  prompt: "Based on bundle analysis results, create code splitting plan for routes and large components. Return implementation steps (100 words)"
)
```

**Expected Outputs**: Structured findings that can be combined into actionable performance optimization plan.

## Key Benefits

- **Memory Efficiency**: Each subtask agent operates with minimal context, preventing memory overflow on large codebases
- **Parallel Processing**: Independent subtasks execute simultaneously, reducing total completion time by 50-70%
- **Clear Boundaries**: Well-defined subtask scope prevents scope creep and ensures focused execution
- **Progress Tracking**: Structured reporting enables monitoring of complex task completion status
- **Command Reuse**: Leverages existing command presets to avoid reinventing common workflows
- **Tool Optimization**: Strategic command discovery ensures maximum utilization of available automation
