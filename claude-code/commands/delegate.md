---
description: 'Orchestrate development tasks with delegation to specialized agents'
allowed-tools: Bash(uuidgen, git, gh), Read, Write, Edit
---

Orchestrate development tasks through structured delegation. Manage task state via `.kimuson/tasks/<task-id>.md` and coordinate subagents.

<setup>
## Initial Setup

**1. Load core guidelines**:
```
Skill(command: "agent-orchestration")
Skill(command: "github")
```

**2. Verify prerequisites**:

Required guideline documents must exist under `.kimuson/guidelines/`:
- `coding-guideline.md`
- `qa-guideline.md`
- `branch-rule.md`

**If any are missing**: Inform the user that these guideline documents must exist before proceeding. Use `/setup-project-guidelines` command to create them.

**If all exist**: Proceed with task orchestration.
</setup>

<role>
Manage workflow, coordinate subagents, design implementation strategy, verify acceptance criteria.
</role>

<execution_phases>
## Phase 1: Requirements Analysis

### Step 1.1: Define Acceptance Criteria

<action>
From user's request, define acceptance criteria as checklist:
- **If request is clear** → Generate AC directly without asking
- **If ambiguous** → Ask clarifying questions only for unclear aspects

**Default**: Infer AC from request. Minimize user interaction.
</action>

### Step 1.2: Create Task Document

<action>
1. Generate task ID: `uuidgen`
2. Create `.kimuson/tasks/${task_id}/TASK.md` using template below
3. Fill "User Input" and "Acceptance Criteria" from Step 1.1
</action>

<task_document_template>
```markdown
# [Task Title]

## User Input
[Request verbatim]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Related Context
<!-- context-collector output if needed -->

## Design Plan
<!-- architect output if needed -->

## Implementation Plan
<!-- Orchestrator's session design -->

## Review Notes
<!-- Final review results -->

## QA Notes
<!-- Final QA results -->

## Memo
<!-- Coordination notes, PR URL, etc. -->
```
</task_document_template>

## Phase 2: Workflow Design

Design which steps are needed and how to execute implementation sessions.

### Step 2.1: Determine Required Preparation Steps

<preparation_steps>
**Environment setup** (prepare-env agent):
- **Always required** for new tasks
- Creates branch, installs dependencies

**Context collection** (context-collector agent):
- **Required when**: Need to understand existing codebase structure
- **Skip when**: Trivial changes to known locations (e.g., "add console.log to main.ts line 10")
- **Purpose**: Gather implementation-relevant files, patterns, conventions

**Architecture design** (architect agent):
- **Required when**:
  - Multiple implementation approaches exist
  - Changes span multiple modules/layers
  - Complex refactoring with dependencies
  - Need to consider trade-offs or side effects
- **Skip when**:
  - Straightforward single-file changes
  - Implementation approach is obvious
  - Simple bug fixes with clear solution
- **Purpose**: Design approach before implementation

**Decision process**:
- Evaluate task complexity and scope
- Document decision in `Memo` section
- When in doubt, include the step (better safe than sorry)
</preparation_steps>

### Step 2.2: Design Implementation Sessions

<session_design>
**Input**: Use Design Plan (if architect ran) or User Input directly

**Design principles**:
- **Session granularity**: Each session = independently committable unit
- **Parallelization**: Identify sessions that can run in parallel (no dependencies)
- **Sequencing**: Order dependent sessions appropriately
- **Commit strategy**: Plan commit points for reviewability

**Parallelization patterns**:

**Pattern 1: Independent modules**
```
Session 1 (parallel): Implement module A
Session 2 (parallel): Implement module B
Session 3 (sequential): Integrate A and B
```

**Pattern 2: Layer-based**
```
Session 1: Database schema changes
Session 2 (parallel): API layer
Session 3 (parallel): Frontend components
Session 4 (sequential): E2E integration
```

**Pattern 3: Feature slices**
```
Session 1 (parallel): User feature slice (API + UI)
Session 2 (parallel): Admin feature slice (API + UI)
Session 3 (sequential): Shared utilities
```

**Documentation**:
Write session plan in `Implementation Plan` section:
```markdown
## Implementation Plan

### Session Design
- Session 1: [Description] - Can run in parallel with Session 2
- Session 2: [Description] - Can run in parallel with Session 1
- Session 3: [Description] - Depends on Sessions 1 & 2
- Session 4: [Description] - Sequential after Session 3

### Commit Strategy
- Session 1: One commit for module A implementation
- Session 2: One commit for module B implementation
- Session 3: One commit for integration
- Session 4: One commit for tests
```
</session_design>

### Step 2.3: Execute Preparation Steps

Execute preparation steps determined in Step 2.1.

**Environment setup**:
```
Task(
  subagent_type="prepare-env",
  prompt="Prepare environment for task at `.kimuson/tasks/${task_id}/TASK.md`",
  description="Prepare environment"
)
```

**Context collection** (if needed):
```
Task(
  subagent_type="context-collector",
  prompt="Collect context and guidelines for task at `.kimuson/tasks/${task_id}/TASK.md`",
  description="Collect context"
)
```

**Architecture design** (if needed):
```
Task(
  subagent_type="architect",
  prompt="Design implementation for task at `.kimuson/tasks/${task_id}/TASK.md`",
  description="Design plan"
)
```

## Phase 3: Implementation

**CRITICAL**: The orchestrator NEVER implements code directly. ALL implementation work MUST be delegated to the `engineer` subagent via Task tool.

### Step 3.1: Execute Implementation Sessions

<execution_strategy>
**Follow session design** from Phase 2:
- Execute parallel sessions simultaneously (multiple Task calls in one response)
- Execute sequential sessions in order
- Wait for dependencies to complete before starting dependent sessions

**Invocation template**:
```
Task(
  subagent_type="engineer",
  prompt="Implement [session description] for task at `.kimuson/tasks/${task_id}/TASK.md`. This is an orchestrated workflow - commit upon completion.",
  description="Implement [session name]"
)
```

**Parallel execution example**:
```
# Sessions 1 and 2 can run in parallel
Task(
  subagent_type="engineer",
  prompt="Implement module A for task at `.kimuson/tasks/${task_id}/TASK.md`. This is an orchestrated workflow - commit upon completion.",
  description="Implement module A"
)
Task(
  subagent_type="engineer",
  prompt="Implement module B for task at `.kimuson/tasks/${task_id}/TASK.md`. This is an orchestrated workflow - commit upon completion.",
  description="Implement module B"
)

# Wait for both to complete, then proceed to Session 3
Task(
  subagent_type="engineer",
  prompt="Integrate modules A and B for task at `.kimuson/tasks/${task_id}/TASK.md`. This is an orchestrated workflow - commit upon completion.",
  description="Integrate modules"
)
```
</execution_strategy>

## Phase 4: Quality Assurance

After ALL implementation sessions complete, run review and QA once.

### Step 4.1: Code Review

```
Task(
  subagent_type="reviewer",
  prompt="Review all changes for task at `.kimuson/tasks/${task_id}/TASK.md`",
  description="Code review"
)
```

### Step 4.2: QA Verification

```
Task(
  subagent_type="qa",
  prompt="Execute QA verification for task at `.kimuson/tasks/${task_id}/TASK.md`",
  description="QA verification"
)
```

### Step 4.3: Handle Feedback

<action>
After review and QA complete:
1. Read `Review Notes` and `QA Notes`
2. **If issues found** (unchecked items):
   - Define fix sessions in `Implementation Plan` (append to session list)
   - Return to Phase 3 to implement fixes
   - After fixes, repeat Phase 4 (review + QA)
3. **If no issues**: Proceed to Phase 5
</action>

## Phase 5: PR Creation and CI Verification

### Step 5.1: Create Draft PR

```
Task(
  subagent_type="pr-creator",
  prompt="Create Draft PR for task at `.kimuson/tasks/${task_id}/TASK.md`. This is an orchestrated workflow.",
  description="Create PR"
)
```

### Step 5.2: Monitor CI

<ci_monitoring>
After PR creation, monitor CI checks using github skill's script.

**Action**:
1. Extract PR number from pr-creator output or task Memo
2. Run CI monitoring script:
```bash
~/.claude/skills/github/scripts/wait-pr-checks-and-report.sh <pr-number>
```
Skill(command: "github")
```
3. Run CI monitoring script: wait-pr-checks-and-report.sh

**Script behavior**:
- Waits for all CI checks to complete (polls every 30 seconds)
- Timeout: 15 minutes
- Returns exit code 0 if all passed, 1 if any failed
- Outputs detailed failure information to stdout

**Capture output** and analyze results.
</ci_monitoring>

### Step 5.3: Handle CI Failures

<action>
**If CI failures exist**:
1. Parse failure details from script output
2. Define fix sessions in `Implementation Plan` with CI failure context
3. Return to Phase 3 to implement fixes
4. After fixes, push changes and repeat Step 5.2

**If all passed** → Proceed to Phase 6
</action>

## Phase 6: Final Verification

Read task document and verify:
1. **Acceptance Criteria**: All checked?
2. **Review Notes**: No unresolved issues?
3. **QA Notes**: All verifications passed?
4. **CI Status**: All checks passed?

<decision>
**If all verified** → Proceed to Phase 7

**If any unsatisfied**:
1. Identify unsatisfied criteria/checks
2. Define fix sessions in `Implementation Plan`
3. Return to Phase 3
</decision>

## Phase 7: Completion Report

Report to user:

```
✅ Task complete

**Task ID**: ${task_id}
**PR URL**: [From Memo]
**Implementation**: [Brief summary]

**Acceptance Criteria**: All satisfied ✅
**Review Status**: No issues ✅
**QA Status**: All passed ✅
**CI Status**: All passed ✅

Task document: `.kimuson/tasks/${task_id}/TASK.md`
```
</execution_phases>

<workflow_permissions>
## Authorization Note

By invoking `/delegate`, the user explicitly delegates the entire development workflow including commits and PR creation. Subagents (`engineer`, `pr-creator`) have authorization sections in their prompts that recognize orchestrated workflow context.

Git operations (commits, pushes, PR creation) are expected deliverables of this workflow.
</workflow_permissions>

<important_notes>
## Guidelines

**Iterative workflow**: Phases can loop back based on feedback (review/QA/CI issues → Phase 3). Continue until Phase 6 verification succeeds.

**Parallel efficiency**: Maximize parallel execution when sessions are independent. This reduces total orchestration time.

**Preparation judgment**: Use judgment to determine necessary preparation steps. Avoid unnecessary context collection or architecture design for trivial tasks.

**Error Handling**:
- **If subagent fails**: Review error output, determine if recoverable, document in `Memo`, report to user with context
- **If git operations fail**: Document in `Memo`, ask user to resolve or provide guidance
- **If task document structure is invalid**: Report specific validation errors to user
</important_notes>
