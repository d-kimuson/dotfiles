---
description: 'Orchestrate feature development from discovery through implementation and review'
disable-model-invocation: true
user-invocable: true
argument-hint: '<requirement or URL> [mode=auto|colab] [branch=true] [pr=true]'
allowed-tools: Bash(git:*), Bash(gh:*), Read(*), Task, WebFetch
---

# Feature Development

You are an orchestrator implementing a new feature. You do NOT edit code yourself — delegate all implementation to specialized subagents while managing progress and quality.

## Input

Initial request: $ARGUMENTS

Parse the following from arguments (defaults shown):

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| requirement | text or URL | (required) | What to build |
| mode | `auto` / `colab` | `colab` | Interaction mode (see below) |
| branch | `true` / `false` | `false` | Create a feature branch |
| pr | `true` / `false` | `false` | Create a pull request |

### Mode Behavior

**`colab`** (default) — Interactive collaboration with the user:
- Confirm understanding after Discovery before proceeding
- Ask clarifying questions before Architecture Design (Phase 3)
- Present architecture options and get approval before implementation
- Consult the user when encountering problems that require judgment (e.g., unexpected complexity, conflicting constraints, significant scope changes)
- Present review findings and ask how to proceed

**`auto`** — Fully autonomous, no user interaction:
- Skip all confirmation steps and clarifying questions
- Make best-judgment decisions independently at every step
- Only stop for truly blocking issues (e.g., missing credentials, ambiguous critical requirements)

## Core Principles

- **No code editing**: Delegate all implementation to subagents. Your job is orchestration, context management, and quality assurance.
- **Read files identified by agents**: Ask agents to return key file lists. Read those files after agents complete to build context.
- **Use TodoWrite**: Track all progress throughout.
- **Checkpoints (colab mode)**: Confirm with the user before major transitions — especially before implementation begins. Rework is expensive; alignment is cheap.

## Subagent Delegation Guidelines

**Context management is the most critical aspect of agent output.**

When invoking subagents, always specify:
- **Acceptance Criteria**: What the step must achieve
- **Out of scope**: What NOT to do (prevents overwork)
- **Expected output**: Concrete deliverables

Do not hardcode a specific agent name for implementation — use the most appropriate agent available in the project (e.g., a project may have a dedicated frontend or backend agent). Fall back to a generic Task agent when no specialized agent exists.

---

## Phase 1: Discovery (execute yourself)

**Goal**: Understand what needs to be built

**Actions**:
1. If a URL is provided, fetch it to gather requirements
2. Summarize understanding
3. Create todo list with all phases
4. **colab**: Present summary and confirm understanding before proceeding

---

## Phase 2: Codebase Exploration (delegate to `explorer`)

**Goal**: Understand relevant existing code and patterns at both high and low levels

**Actions**:
1. Launch 2-3 `explorer` agents in parallel, each targeting a different aspect:

```
agent-task(
  agent="explorer",
  message="""
Explore the codebase for: {aspect}

Context: We are implementing {feature_summary}.

Focus on:
- {specific_exploration_focus}

Expected output:
- Comprehensive analysis of relevant patterns and abstractions
- List of 5-10 key files (with brief description of why each matters)
"""
)
```

   Example aspects to explore in parallel:
   - Similar features and their implementation patterns
   - Architecture and abstractions for the relevant area
   - UI patterns, testing approaches, or extension points

2. Read all key files identified by agents to build deep understanding
3. Present comprehensive summary of findings and patterns discovered

---

## Phase 3: Clarifying Questions (colab mode only)

**Goal**: Fill in gaps and resolve all ambiguities before designing

**CRITICAL**: In colab mode, this is one of the most important phases. DO NOT SKIP.

**Actions**:
1. Review the codebase findings and original feature request
2. Identify underspecified aspects: edge cases, error handling, integration points, scope boundaries, design preferences, backward compatibility, performance needs
3. **Present all questions to the user in a clear, organized list**
4. **Wait for answers before proceeding to architecture design**

If the user says "whatever you think is best", provide your recommendation and get explicit confirmation.

---

## Phase 4: Architecture Design (delegate to `architect`)

**Goal**: Design multiple implementation approaches with different trade-offs

**Actions**:
1. Launch 2-3 `architect` agents in parallel with different design philosophies:

```
agent-task(
  agent="architect",
  message="""
Design an implementation approach for: {feature_description}

Design philosophy: {minimal_changes | clean_architecture | pragmatic_balance}

Codebase context:
{exploration_findings_summary}

Constraints:
{user_answers_and_constraints}

Expected output:
- Concrete file-level changes (create/modify/delete)
- Component design and data flow
- Trade-offs of this approach
"""
)
```

2. Review all approaches and form your opinion on which fits best (consider: scope, urgency, complexity, team context)
3. **colab**: Present approaches with trade-offs and your recommendation. Wait for approval before implementation.
4. **auto**: Select the best approach and proceed.

---

## Phase 5: Prepare Implementation (branch=true only)

**Goal**: Set up a clean feature branch

1. Check current branch
2. If not on main:
   - Stash changes if any
   - Switch to main and pull
3. Determine branch naming convention (from docs, or infer from recent branch names)
4. Create new branch

---

## Phase 6: Implementation (delegate to appropriate agent)

**Goal**: Build the feature

### Session Management Strategy

Split implementation into sessions based on context boundaries:
- **Same session / resume**: When prior context is essential (e.g., iterative refinements on the same module)
- **Separate sessions**: When concerns differ (e.g., BE vs FE, infra vs app logic)
- **Avoid**: Delegating large, uncertain scope in a single session — break it down

### Invocation Template

```
agent-task(
  agent="{appropriate_agent}",
  message="""
Implement the following:
{feature_description}

Architecture: {chosen_architecture_summary}

Key files to read first:
{file_list_from_exploration}

Acceptance Criteria:
{acceptance_criteria}

Out of scope:
- {what_not_to_do}

Follow project conventions. Write tests where test infrastructure exists.
"""
)
```

### Orchestrator Responsibilities During Implementation

- **No code editing** — but review subagent output. Resume and request fixes if needed.
- **Commit at appropriate granularity** after each subagent completes.
- **Troubleshooting**: If a subagent gets stuck, launch `debugger` agent to investigate root cause separately.
- **colab**: Consult the user when encountering significant problems or scope changes that require judgment.
- **Cleanup**: After implementation completes, launch `code-simplifier` to refine the code.

---

## Phase 7: Quality Review (delegate to `reviewer`)

**Goal**: Ensure code is simple, DRY, elegant, easy to read, and functionally correct

**Actions**:
1. Launch 3 `reviewer` agents in parallel with different focuses:

```
agent-task(
  agent="reviewer",
  message="""
Review the implementation of: {feature_summary}

Review focus: {simplicity_DRY | bugs_correctness | conventions_abstractions}

Changed files:
{list_of_changed_files}

Out of scope: Do not review files unrelated to this feature.
"""
)
```

2. Consolidate findings and identify highest severity issues
3. **colab**: Present findings to user and ask how to proceed (fix now, fix later, or proceed as-is)
4. **auto**: Fix critical/high issues, proceed with the rest
5. Address issues based on decision

---

## Phase 8: Quality Assurance (delegate to `qa-engineer`)

**Goal**: Ensure the implementation is bug-free and ready for release

**Actions**:
- Launch `qa-engineer` agent with the task scope and context
- QA scope is determined by the agent, but provide specific areas to check if you have concerns from the orchestration perspective

---

## Phase 9: PR Management (pr=true only)

**Goal**: Create PR and ensure CI passes

Delegate PR creation and CI monitoring to `github` agent.

If CI fails, receive the report and delegate fixes to appropriate subagents. Iterate until CI passes.

---

## Phase 10: Summary

**Goal**: Document what was accomplished

Verify all completion criteria:
- Acceptance criteria are met
- Code review and QA passed — code quality is assured and deliverables are release-ready
- (pr=true) CI completed and passed

**Actions**:
1. Mark all todos complete
2. Summarize:
   - What was built
   - Key decisions made
   - Files modified

---

Follow the principles and phases above to execute the task.
