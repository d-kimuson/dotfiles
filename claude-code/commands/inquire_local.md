---
description: '調査・設計・実装・レビューを委任 (環境準備・PR作成は手動)'
allowed-tools: Bash(uuidgen), Read, Write, Edit
---

Orchestrate development tasks with lightweight delegation. Environment setup and PR creation are manual.

<skill_usage>
Invoke `agent-orchestration` skill for core guidelines:
```
Skill(command: "agent-orchestration")
```
</skill_usage>

<role>
Coordinate subagents, verify acceptance criteria, skip environment preparation and PR creation.
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

**Decision**: If uncertain, treat as **Hard**.
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

## Phase 2: Task Document Creation

<action>
1. Generate task ID: `uuidgen`
2. Create `.cc-delegate/tasks/${task_id}.md` using template below
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

## Memo
<!-- Session list and orchestrator notes -->
```
</task_document_template>

## Phase 3: Context and Design (Conditional)

**Execute ONLY for Hard tasks**. Easy tasks skip to Phase 4.

### Step 3.1: Collect Context

```
Task(
  subagent_type="context-collector",
  prompt="Collect context for task at `.cc-delegate/tasks/${task_id}.md`. Populate 'Related Context' section.

**Focus on**:
- Files to modify and their roles
- Task-specific libraries/patterns/implementations
- Technical constraints specific to this task

**Exclude**:
- General project info (already in system context)
- CLAUDE.md content (tech stack, conventions, architecture)
- Generic patterns not specific to this task

Write concisely for implementers.",
  description="Collect context"
)
```

### Step 3.2: Design Plan

```
Task(
  subagent_type="architect",
  prompt="Design implementation for task at `.cc-delegate/tasks/${task_id}.md`. Populate 'Design Plan' section.

**Include**:
- Implementation approach (compare if multiple options)
- Key implementation steps
- Risk mitigation

Write concisely.",
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
  prompt="Implement session N for task at `.cc-delegate/tasks/${task_id}.md`.

**Session List**:
- Session 1: [Title] [✅/⬅️/PENDING]
- Session N: [Title] ⬅️ CURRENT

**Scope**: Focus ONLY on session N. Note additional work in Memo without implementing.

**Post-implementation**: git add & commit with concise message.",
  description="Implement session N"
)
```

**2. After engineer commits**:
- **If final session**: Invoke `reviewer` only
- **If NOT final**: Invoke `reviewer` AND `engineer` (session N+1) **in parallel**

**Example flow**:
```
Session 1 → engineer implements & commits
         → reviewer (session 1) & engineer (session 2) in parallel
         → reviewer (session 2) & engineer (session 3) in parallel
         → reviewer (session 3) only
```

**Reviewer invocation**:
```
Task(
  subagent_type="reviewer",
  prompt="Review session N for task at `.cc-delegate/tasks/${task_id}.md`.

**Review scope**: Changes in most recent commit only.

**Output in 'Review Notes' section**:
Session N: - [ ] Issue description
OR
Session N: - [x] No issues found

Verify relevant AC items. Check off satisfied items in 'Acceptance Criteria' section.",
  description="Review session N"
)
```
</workflow>

### Step 4.3: Handle Review Feedback

<action>
After each reviewer completes:
1. Read `Review Notes` for session N
2. **If issues found** (unchecked items):
   - Create fix session for session N issues
   - Insert into session list (as next session)
   - Continue workflow from Step 4.2
3. **If no issues**: Continue to next session or Phase 5
</action>

## Phase 5: Final Verification

Read task document and verify:
1. **Acceptance Criteria**: All checked?
2. **Review Notes**: All sessions resolved?

<decision>
**If all verified** → Proceed to Phase 6

**If unsatisfied**:
- Add fix sessions to session list
- Return to Phase 4, Step 4.2
</decision>

## Phase 6: Completion Report

Report to user:

```
✅ Task complete

**Task ID**: ${task_id}
**Implementation**: [Brief summary]

**Acceptance Criteria**: All satisfied ✅
**Review Status**: All issues resolved ✅

Task document: `.cc-delegate/tasks/${task_id}.md`

**Next steps**: Create PR and verify CI manually.
```
</execution_phases>

<important_notes>
## Guidelines

**Flow**: Phases loop back as needed (review feedback → Phase 4). Continue until all criteria satisfied.

**Delegation**: Trust subagents. Specify task document path only. Avoid over-specification. Verify outcomes.

**Definition of Done**:
- ✅ All Acceptance Criteria satisfied
- ✅ All review feedback resolved
- ✅ Code committed to branch
- 🔲 PR creation (manual)
- 🔲 CI verification (manual)
</important_notes>
