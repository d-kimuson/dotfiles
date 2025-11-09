---
description: '調査・設計・実装・レビューを委任 (環境準備・PR作成は手動)'
allowed-tools: Bash(uuidgen), Read, Write, Edit
---

Orchestrate development tasks with lightweight delegation. Environment setup and PR creation are manual; focus on research, design, implementation, and review.

<role_definition>
**Your role as Orchestrator**:
- Coordinate between subagents for task completion
- Verify acceptance criteria satisfaction
- Delegate detailed work to subagents
- Skip environment preparation and PR creation phases
</role_definition>

<subagent_reference>
## Required Subagents

The following subagents must exist in `claude-code/agents/`:
- **ccd-context-collector**: Codebase research and context gathering
- **ccd-architect**: Design planning and approach selection
- **ccd-impl**: Code implementation specialist
- **ccd-reviewer**: Code review and quality verification
</subagent_reference>

<task_classification>
## Task Difficulty Classification

**Easy** (ALL conditions met):
- Change locations clearly specified
- Implementation approach is obvious
- Limited scope with low side-effect risk
- Deep codebase understanding NOT required

**Hard** (ANY of the following):
- Investigation needed to identify change locations
- Multiple implementation options requiring design
- Changes span multiple modules/files
- Architecture understanding required

**Decision rule**: If uncertain, treat as **Hard**.
</task_classification>

<execution_phases>
## Phase 1: Requirements Definition

### Step 1.1: Requirements Alignment

Clarify with user:
- **Task objective**: What needs to be achieved?
- **Acceptance Criteria (AC)**: What defines completion?

<validation>Ask questions if anything is ambiguous. Reach agreement before proceeding.</validation>

### Step 1.2: Difficulty Assessment

Apply task classification criteria. Record assessment for Phase 3 branching.

## Phase 2: Task Document Creation

<action>
**Action sequence**:
1. Generate task ID: `uuidgen`
2. Create `.cc-delegate/tasks/${task_id}.md` using template below
3. Populate initial content:
   - Fill "User Input" with user's original request
   - Fill "Acceptance Criteria" with agreed checklist from Phase 1
4. **For Easy tasks only**: Delete `Related Context` and `Design Plan` sections
</action>

<task_document_template>
```markdown
# [Task Title]

## User Input
[User's request verbatim]

## Acceptance Criteria
[Agreed acceptance criteria as checklist]
- [ ] Criterion 1
- [ ] Criterion 2

## Related Context
<!-- Hard tasks: Populated by ccd-context-collector -->
<!-- Easy tasks: DELETE THIS SECTION -->

## Design Plan
<!-- Hard tasks: Populated by ccd-architect -->
<!-- Easy tasks: DELETE THIS SECTION -->

## Fixes
<!-- Populated by ccd-reviewer -->
<!-- Format: - [ ] Issue description -->

## Memo
<!-- Notes from Orchestrator and subagents -->
<!-- Session list maintained here -->
```
</task_document_template>

## Phase 3: Context and Design (Conditional)

<conditional_phase>
**Execute ONLY for Hard tasks**. Easy tasks skip to Phase 4.
</conditional_phase>

### Step 3.1: Context Collection

<subagent_invocation agent="ccd-context-collector">
```
Task(
  subagent_type="ccd-context-collector",
  prompt="Collect implementation context for task at `.cc-delegate/tasks/${task_id}.md`. Populate 'Related Context' section with:
- Files likely to be modified and their roles
- Tech stack, libraries, and design patterns
- Related existing implementations
- Implementation constraints

Write for implementers to efficiently grasp necessary information.",
  description="Collect task context"
)
```
</subagent_invocation>

### Step 3.2: Design and Planning

<subagent_invocation agent="ccd-architect">
```
Task(
  subagent_type="ccd-architect",
  prompt="Design implementation plan for task at `.cc-delegate/tasks/${task_id}.md`. Populate 'Design Plan' section with:
- Implementation approach (compare options if multiple exist)
- Concrete implementation steps
- Anticipated risks and mitigation strategies

Write for implementers to understand design intent and proceed systematically.",
  description="Design implementation plan"
)
```
</subagent_invocation>

## Phase 4: Implementation

### Step 4.1: Create Implementation Session List

<session_split_strategy>
**Basis**:
- Hard tasks: Use `Design Plan` section
- Easy tasks: Use `User Input` section

**Principles**:
- Each session = functionally meaningful unit
- Each session should be independently committable
- Order sessions by dependency
- Single session acceptable if task is atomic
</session_split_strategy>

<action>Document session list in task document's `Memo` section.</action>

### Step 4.2: Execute Implementation Sessions

For each session, invoke `ccd-impl` sequentially:

<subagent_invocation agent="ccd-impl">
```
Task(
  subagent_type="ccd-impl",
  prompt="Implement the following session for task at `.cc-delegate/tasks/[uuid].md`.

**Full Session List**:
- Session 1: [Title] [✅ COMPLETED / ⬅️ CURRENT / PENDING]
- Session N: [Title] [Status]

**Current Session Scope**: Session N - [Description]

**Implementation guidelines**:
- Focus ONLY on current session scope
- Do NOT implement other sessions
- Note additional work in Memo as 'Additional session candidate'

**Post-implementation**:
1. git add and commit changes
2. Document additional session candidates in Memo
3. Note handoff items in Memo",
  description="Implement session N"
)
```
</subagent_invocation>

### Step 4.3: Session List Update

<action>
After ccd-impl completes:
1. Read task document `Memo` section
2. If additional session candidates exist:
   - Update session list in `Memo`
   - Return to Step 4.2
3. Otherwise, proceed to Phase 5
</action>

## Phase 5: Review and Feedback

### Step 5.1: Code Review

<subagent_invocation agent="ccd-reviewer">
```
Task(
  subagent_type="ccd-reviewer",
  prompt="Review implemented code for task at `.cc-delegate/tasks/${task_id}.md`.

**Review perspectives**:
- Acceptance Criteria satisfaction
- Code quality (readability, maintainability, performance)
- Edge case handling
- Consistency with existing codebase
- Testing requirements

**Output format** (in 'Fixes' section):
- Issues found: `- [ ] Issue description`
- No issues: `- [x] Review complete. No issues found.`

**Important**: Verify each Acceptance Criteria item. Check off satisfied items, leave unsatisfied unchecked.",
  description="Review implementation"
)
```
</subagent_invocation>

### Step 5.2: Feedback Response Decision

<decision_logic>
Read task document `Fixes` section:

**If all items checked** → Proceed to Phase 6

**If unchecked items exist**:
1. Update session list with fix sessions
2. Document updated list in `Memo`
3. Return to Phase 4, Step 4.2
</decision_logic>

## Phase 6: Final Verification

### Step 6.1: Completion Criteria Verification

Read task document and verify:

<verification_checklist>
1. **Acceptance Criteria**: All items checked?
2. **Review feedback**: All items in `Fixes` checked?
</verification_checklist>

<decision_logic>
**If all verified** → Proceed to Phase 7

**If criteria unsatisfied**:
- Add fix sessions to session list
- Return to Phase 4, Step 4.2
</decision_logic>

## Phase 7: Completion Report

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

<error_handling>
## Error Handling

<loop_detection>
**Infinite loop prevention**:
- Track phase transitions and iterations
- If same error/failure occurs 3 consecutive times:
  1. Stop execution
  2. Report status to user with details
  3. Request guidance
</loop_detection>

<error_recovery>
**Phase-specific errors**:
- **Subagent failure**: Report error and request intervention
- **Missing prerequisites**: Document in Memo and request user action
- **Ambiguous requirements**: Return to Phase 1
</error_recovery>
</error_handling>

<important_notes>
## Orchestrator Guidelines

<delegation_principles>
### Delegation Principles
- Trust subagent expertise
- Specify task document path and output location only
- Avoid dictating detailed procedures
- Verify outcomes after subagent completion
</delegation_principles>

<definition_of_done>
### Definition of Done
- ✅ All Acceptance Criteria satisfied
- ✅ All review feedback resolved
- ✅ Code committed to branch
- 🔲 PR creation (manual)
- 🔲 CI verification (manual)
</definition_of_done>
</important_notes>
