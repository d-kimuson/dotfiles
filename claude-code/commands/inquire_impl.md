---
description: 'Orchestrate development tasks with delegation to specialized agents'
allowed-tools: Bash(uuidgen), Read, Write, Edit
---

Orchestrate development tasks through structured delegation. Manage task state via `.cc-delegate/tasks/<task-id>.md` and coordinate subagents.

<setup>
## Initial Setup

**1. Load core guidelines**:
```
Skill(command: "agent-orchestration")
```

**2. Verify prerequisites**:

Required guideline documents:
- `.cc-delegate/coding-guideline.md`
- `.cc-delegate/review-guideline.md`
- `.cc-delegate/qa-guideline.md`
- `.cc-delegate/branch-rule.md`

**If any are missing**: Inform the user that these guideline documents must exist before proceeding. Ask if they'd like help creating them.

**If all exist**: Proceed with task orchestration.
</setup>

<role>
Manage flow, coordinate subagents, verify acceptance criteria, make phase decisions.
</role>

<task_classification>
## Task Difficulty

**Easy** (ALL conditions met):
- Change locations clearly specified
- Implementation approach obvious
- Limited scope, low side-effect risk
- No deep codebase understanding needed

**Hard** (ANY condition):
- Investigation needed to find change locations
- Multiple implementation options exist
- Changes span multiple modules
- Architecture understanding required

**Decision**:
- If ANY Hard condition is met → Hard
- If ALL Easy conditions are met → Easy
- When in doubt → Default to Hard
</task_classification>

<execution_phases>
## Phase 1: Requirements Analysis

### Step 1.1: Define Acceptance Criteria

<action>
From user's request, define acceptance criteria as checklist:
- **If request is clear** → Generate AC directly without asking
- **If ambiguous** → Ask clarifying questions only for unclear aspects

**Default**: Infer AC from request. Minimize user interaction.
</action>

### Step 1.2: Assess Difficulty

Apply classification criteria. Record for Phase 3 branching.


## Phase 2: Task Environment Setup

### Step 2.1: Create Task Document

<action>
1. Generate task ID: `uuidgen`
2. Create `.cc-delegate/tasks/${task_id}/TASK.md` using template below
3. Fill "User Input" and "Acceptance Criteria" from Phase 1
4. **Easy tasks**: Delete `Related Context` and `Design Plan` sections
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
<!-- Hard tasks only: context-collector output -->

## Design Plan
<!-- Hard tasks only: architect output -->

## Review Notes
<!-- Per-session review: Session N: - [ ] Issue / - [x] No issues -->

## QA Notes
<!-- Per-session QA: Session N: - [ ] Issue / - [x] All passed -->

## Memo
<!-- Session list and coordination notes -->
```
</task_document_template>

### Step 2.2: Prepare Environment

```
Task(
  subagent_type="prepare-env",
  prompt="Prepare environment for task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="Prepare environment"
)
```

## Phase 3: Context and Design (Conditional)

**Execute ONLY for Hard tasks**. Easy tasks skip to Phase 4.

### Step 3.1: Collect Context and Guidelines

```
Task(
  subagent_type="context-collector",
  prompt="Collect context and guidelines for task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="Collect context"
)
```

### Step 3.2: Design Plan

```
Task(
  subagent_type="architect",
  prompt="Design implementation for task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="Design plan"
)
```

## Phase 4: Implementation with Incremental Review

### Step 4.1: Create Session List

<session_split>
**Basis**: Use `Design Plan` (Hard) or `User Input` (Easy)

**Principles**:
- Each session = independently committable unit
- Order by dependency
- Single session acceptable if atomic

Document session list in `Memo` section.
</session_split>

### Step 4.2: Execute Sessions with Parallel Review

<workflow>
For each session N in the list:

**1. Implement session N**:
```
Task(
  subagent_type="engineer",
  prompt="Implement session N for task at `.cc-delegate/tasks/${task_id}/TASK.md`. This is an orchestrated workflow - commit upon completion.",
  description="Implement session N"
)
```

**2. After engineer commits**:

**Sequential order**:
1. Invoke `reviewer` for session N
2. After reviewer completes → Invoke `qa` for session N
3. **In parallel** with qa (N):
   - **If NOT final session**: Start `engineer` for session N+1
   - **If final session**: Wait for qa to complete

**Example flow**:
```
Session 1 → engineer(1) commits
         → reviewer(1) completes
         → qa(1) + engineer(2) run in parallel
         → reviewer(2) completes (waits for engineer(2))
         → qa(2) + engineer(3) run in parallel
         → reviewer(3) completes (waits for engineer(3))
         → qa(3) completes
```

**Important**: If qa or reviewer finds issues, proceed to Step 4.3 even if next engineer session is running.

**Reviewer invocation**:
```
Task(
  subagent_type="reviewer",
  prompt="Review session N for task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="Review session N"
)
```

**QA invocation** (after reviewer completes):
```
Task(
  subagent_type="qa",
  prompt="Execute QA verification for session N in task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="QA verification"
)
```
</workflow>

### Step 4.3: Handle Review and QA Feedback

<action>
After each session's QA verification completes:
1. Read `Review Notes` and `QA Notes` for that session
2. **If issues found** (unchecked items in either section):
   - Define a fix session in `Memo` section titled "Fix session N: [issue summary]"
   - Insert as the **next** session in the list (even if a future session is already running)
   - Wait for any in-progress engineer sessions to complete
   - Continue workflow from Step 4.2 to implement the fix
3. **If no issues**: Continue to next pending session or Phase 5
</action>

## Phase 5: PR Creation and CI Verification

### Step 5.1: Create Draft PR

```
Task(
  subagent_type="pr-creator",
  prompt="Create Draft PR for task at `.cc-delegate/tasks/${task_id}/TASK.md`. This is an orchestrated workflow.",
  description="Create PR"
)
```

### Step 5.2: Monitor CI

```
Task(
  subagent_type="pr-checker",
  prompt="Monitor CI for PR in task at `.cc-delegate/tasks/${task_id}/TASK.md`",
  description="Check CI"
)
```

### Step 5.3: Handle CI Failures

<action>
**If CI failures exist**:
1. Define a new fix session in `Memo` section titled "Fix CI: [failure summary]"
2. Append this session to the session list
3. Return to Phase 4, Step 4.2 to implement the fix session

**If all passed** → Proceed to Phase 6
</action>

## Phase 6: Final Verification

Read task document and verify:
1. **Acceptance Criteria**: All checked?
2. **Review Notes**: All sessions/CI checks resolved?
3. **QA Notes**: All sessions passed?

<decision>
**If all verified** → Proceed to Phase 7

**If any unsatisfied**:
1. Identify unsatisfied criteria/checks
2. Define fix sessions in `Memo` section
3. Append to session list
4. Return to Phase 4, Step 4.2
</decision>

## Phase 7: Completion Report

Report to user:

```
✅ Task complete

**Task ID**: ${task_id}
**PR URL**: [From Memo]
**Implementation**: [Brief summary]

**Acceptance Criteria**: All satisfied ✅
**QA Status**: All passed ✅
**CI Status**: All passed ✅

Task document: `.cc-delegate/tasks/${task_id}/TASK.md`
```
</execution_phases>

<workflow_permissions>
## Authorization Note

By invoking `/inquire_impl`, the user explicitly delegates the entire development workflow including commits and PR creation. Subagents (`engineer`, `pr-creator`) have authorization sections in their prompts that recognize orchestrated workflow context.

Git operations (commits, pushes, PR creation) are expected deliverables of this workflow.
</workflow_permissions>

<important_notes>
## Guidelines

**Flow**: Phases loop back as needed (review/CI feedback → Phase 4). Continue until Phase 6 verification succeeds.

**Error Handling**:
- **If subagent fails**: Review error output, determine if recoverable, document in `Memo`, report to user with context
- **If git operations fail**: Document in `Memo`, ask user to resolve or provide guidance
- **If task document structure is invalid**: Report specific validation errors to user
</important_notes>
