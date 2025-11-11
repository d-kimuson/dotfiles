---
description: 'Orchestrate development tasks with delegation to specialized agents'
allowed-tools: Bash(uuidgen), Read, Write, Edit
---

Orchestrate development tasks through structured delegation to specialized subagents. Manage task state via document (`.cc-delegate/tasks/<task-id>.md`) and coordinate phase transitions.

<skill_usage>
**IMPORTANT**: You MUST invoke the `agent-orchestration` skill to apply core orchestration guidelines. This skill provides:
- Session separation principles for yak shaving tasks
- Subagent collaboration best practices
- Error handling and loop prevention strategies

Invoke with:
```
Skill(command: "agent-orchestration")
```
</skill_usage>

<role_definition>
**Your role as Orchestrator**:
- Manage overall flow and coordinate between subagents
- Verify final acceptance criteria satisfaction
- Delegate detailed work to subagents without over-specifying procedures
- Make phase transition decisions based on task document state
</role_definition>

<task_classification>
## Task Difficulty Classification

Classify tasks as **Easy** or **Hard** to determine execution path:

**Easy** (ALL conditions must be met):
- Change locations clearly specified (file paths or function names provided)
- Implementation approach is concrete and obvious
- Impact scope is limited with low side-effect risk
- Deep codebase understanding NOT required

**Hard** (ANY of the following):
- Investigation needed to identify change locations
- Multiple implementation options requiring design decisions
- Changes span multiple modules or files
- Understanding of existing architecture required
- High uncertainty requiring trial and error

**Decision rule**: If classification is uncertain, treat as **Hard**.
</task_classification>

<execution_phases>
## Phase 1: Requirements Definition

<phase_1_step_1 name="requirements_alignment">
### Step 1.1: Requirements Alignment

Clarify with user:
- **Task objective**: What needs to be achieved?
- **Acceptance Criteria (AC)**: What defines completion?

<validation>Ask questions if anything is ambiguous. Reach agreement before proceeding.</validation>
</phase_1_step_1>

<phase_1_step_2 name="difficulty_assessment">
### Step 1.2: Difficulty Assessment

Apply task classification criteria above. Record assessment result for Phase 3 branching.
</phase_1_step_2>

## Phase 2: Task Environment Setup

<phase_2_step_1 name="task_initialization">
### Step 2.1: Task Document Creation

<action>
**Action sequence**:
1. Generate task ID: `uuidgen`
2. Create `.cc-delegate/tasks/${task_id}.md` using template below
3. Populate initial content:
   - Fill "User Input" section with user's original request
   - Fill "Acceptance Criteria" section with agreed checklist from Phase 1
   - Replace `${task_id}` placeholder with the actual generated UUID
4. **For Easy tasks only**: Delete `Related Context` and `Design Plan` sections entirely
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
<!-- Hard tasks: Populated by context-collector -->
<!-- Easy tasks: DELETE THIS SECTION -->

## Design Plan
<!-- Hard tasks: Populated by architect -->
<!-- Easy tasks: DELETE THIS SECTION -->

## Fixes
<!-- Populated by reviewer or pr-checker -->
<!-- Format: - [ ] Issue description -->
<!-- When returning from Phase 5: Check off completed items, keep unchecked items -->
<!-- When CI adds failures: Append without removing previous items -->

## Memo
<!-- Notes from Orchestrator and subagents -->
<!-- Session list maintained here -->
```
</task_document_template>
</phase_2_step_1>

<phase_2_step_2 name="environment_preparation">
### Step 2.2: Environment Preparation

<subagent_invocation agent="prepare-env">
**Invocation**:
```
Task(
  subagent_type="prepare-env",
  prompt="Prepare environment for task documented at `.cc-delegate/tasks/${task_id}.md`",
  description="Prepare task environment"
)
```

**Expected outcome**: Environment ready for implementation (dependencies installed, branch created, etc.)
</subagent_invocation>
</phase_2_step_2>

## Phase 3: Context and Design (Conditional)

<conditional_phase>
**Branch condition**: Execute ONLY for **Hard** tasks. Easy tasks skip to Phase 4.
</conditional_phase>

<phase_3_step_1 name="context_collection">
### Step 3.1: Context Collection

<subagent_invocation agent="context-collector">
**Invocation**:
```
Task(
  subagent_type="context-collector",
  prompt="Collect implementation context for task at `.cc-delegate/tasks/${task_id}.md`. Populate the 'Related Context' section with:
- Files likely to be modified and their roles
- Tech stack, libraries, and design patterns in use
- Related existing implementations
- Implementation constraints and considerations

Write for implementers to efficiently grasp necessary information.",
  description="Collect task context"
)
```

**Expected outcome**: `Related Context` section populated with implementation-relevant information.
</subagent_invocation>
</phase_3_step_1>

<phase_3_step_2 name="design_planning">
### Step 3.2: Design and Planning

<subagent_invocation agent="architect">
**Invocation**:
```
Task(
  subagent_type="architect",
  prompt="Design implementation plan for task at `.cc-delegate/tasks/${task_id}.md`. Populate the 'Design Plan' section with:
- Implementation approach (compare options if multiple exist)
- Concrete implementation steps
- Anticipated risks and mitigation strategies

Write for implementers to understand design intent and proceed systematically.",
  description="Design implementation plan"
)
```

**Expected outcome**: `Design Plan` section populated with structured implementation approach.
</subagent_invocation>
</phase_3_step_2>

## Phase 4: Implementation

<phase_4_step_1 name="session_planning">
### Step 4.1: Create Implementation Session List

<session_split_strategy>
**Basis**:
- Hard tasks: Use `Design Plan` section
- Easy tasks: Use `User Input` section

**Principles**:
- Each session = functionally meaningful unit (e.g., "Add data model", "Implement API endpoint")
- Each session should be independently committable
- Order sessions by dependency (prerequisite sessions first)
- Single session is acceptable if task is atomic

**Example split**:
```
Session 1: Add database schema and models
Session 2: Implement backend API endpoints
Session 3: Build frontend UI components
```
</session_split_strategy>

<action>Document session list in task document's `Memo` section. Update as needed during execution.</action>
</phase_4_step_1>

<phase_4_step_2 name="execute_sessions">
### Step 4.2: Execute Implementation Sessions

<sequential_execution>
For each session in the session list, invoke `engineer` sequentially:

<subagent_invocation agent="engineer">
**Invocation template** (replace `${task_id}` with actual UUID, `N` with session number):
```
Task(
  subagent_type="engineer",
  prompt="Implement the following session for task at `.cc-delegate/tasks/[actual-uuid].md`.

**Full Session List**:
- Session 1: [Title] [✅ COMPLETED if done, ⬅️ CURRENT if this one, PENDING if future]
- Session 2: [Title] [Status indicator]
- Session N: [Title] [Status indicator]

**Current Session Scope**: Session N - [Title/description]

**Implementation guidelines**:
- Focus ONLY on current session scope
- Do NOT implement content planned for other sessions
- If additional work is discovered, note it in Memo as 'Additional session candidate' without implementing

**Post-implementation**:
1. git add and commit changes (concise commit message describing changes)
2. Document any additional session candidates in Memo section
3. Note handoff items in Memo section",
  description="Implement session N"
)
```

<important>When invoking, replace `${task_id}` with the actual generated UUID from Phase 2.</important>
</subagent_invocation>
</sequential_execution>
</phase_4_step_2>

<phase_4_step_3 name="update_session_list">
### Step 4.3: Session List Update

<action>
After engineer completes and before invoking the next session:
1. Read task document `Memo` section
2. If additional session candidates exist:
   - Update session list (append new sessions or reorder as needed)
   - Document the updated full session list in `Memo` (replaces previous list)
   - Return to Step 4.2 for new sessions
3. If no updates, proceed to Phase 5
</action>
</phase_4_step_3>

## Phase 5: Review and Feedback

<phase_5_step_1 name="code_review">
### Step 5.1: Code Review

<subagent_invocation agent="reviewer">
**Invocation**:
```
Task(
  subagent_type="reviewer",
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

**Important**: After review, verify each Acceptance Criteria item in the AC section. Check off (change `- [ ]` to `- [x]`) any AC items that are satisfied by the implementation. Leave unsatisfied items unchecked.",
  description="Review implementation"
)
```

**Expected outcome**:
- `Fixes` section populated with review feedback in checkbox format
- Acceptance Criteria items checked off if satisfied
</subagent_invocation>
</phase_5_step_1>

<phase_5_step_2 name="feedback_response">
### Step 5.2: Feedback Response Decision

<decision_logic>
Read task document `Fixes` section:

**If all items checked** → Proceed to Phase 6

**If unchecked items exist**:
1. Update session list with fix sessions as needed
2. Document updated session list in `Memo`
3. Return to Phase 4, Step 4.2 to execute fix sessions
</decision_logic>
</phase_5_step_2>

## Phase 6: PR Creation and CI Verification

<phase_6_step_1 name="create_pr">
### Step 6.1: Create Draft PR

<subagent_invocation agent="pr-creator">
**Invocation**:
```
Task(
  subagent_type="pr-creator",
  prompt="Create Draft Pull Request for task at `.cc-delegate/tasks/${task_id}.md`. Document the PR URL in the 'Memo' section.",
  description="Create draft PR"
)
```

**Expected outcome**: PR created and URL documented in `Memo` section.
</subagent_invocation>
</phase_6_step_1>

<phase_6_step_2 name="ci_check">
### Step 6.2: CI Verification

<subagent_invocation agent="pr-checker">
**Invocation**:
```
Task(
  subagent_type="pr-checker",
  prompt="Monitor CI for PR documented in `.cc-delegate/tasks/${task_id}.md` Memo section.

**CI result handling**:
- All passed: Report completion
- Failures exist: Document each failure in 'Fixes' section as checkbox
  - Format: `- [ ] CI: [Test/Check name] - [Failure description]`",
  description="Check CI status"
)
```

**Expected outcome**: CI results confirmed or failures documented in `Fixes` section.
</subagent_invocation>
</phase_6_step_2>

<phase_6_step_3 name="handle_ci_failures">
### Step 6.3: CI Failure Response

<decision_logic>
**If CI failures exist**:
1. Read `Fixes` section for failure details
2. Update session list with CI fix sessions
3. Return to Phase 4, Step 4.2 to execute fixes

**If all CI checks passed** → Proceed to Phase 7
</decision_logic>
</phase_6_step_3>

## Phase 7: Final Verification

<phase_7_verification>
### Step 7.1: Completion Criteria Verification

Read task document `.cc-delegate/tasks/${task_id}.md` and verify:

<verification_checklist>
1. **Acceptance Criteria**: All items in `Acceptance Criteria` section checked?
2. **Review feedback**: All items in `Fixes` section checked?
3. **CI status**: All CI checks passed?
</verification_checklist>

<decision_logic>
**If all verified** → Proceed to Phase 8

**If any criteria unsatisfied**, return to phase based on failure type:
- **Acceptance Criteria has unchecked items**:
  - Review requirements with user (Phase 1) if AC itself needs revision
  - Otherwise, add fix sessions and return to Phase 4 (Step 4.2)
- **Fixes section has unchecked items**:
  - Add fix sessions to session list
  - Return to Phase 4 (Step 4.2) to execute fixes
- **CI checks failed**:
  - Should have been caught by Phase 6.3
  - If discovered here, return to Phase 6 (Step 6.2)
</decision_logic>
</phase_7_verification>

## Phase 8: Completion Report

<phase_8_report>
### Step 8.1: User Report

Report to user with this structure:

```
✅ Task complete

**Task ID**: ${task_id}
**PR URL**: [Retrieved from Memo section]
**Implementation**: [Brief summary from User Input section]

**Acceptance Criteria**: All satisfied ✅
**CI Status**: All passed ✅

Task document: `.cc-delegate/tasks/${task_id}.md`
```
</phase_8_report>
</execution_phases>

<important_notes>
## Orchestrator Guidelines

<flow_flexibility>
### Flow Flexibility
Phases can loop back as needed:
- Review feedback → Phase 4 (Implementation)
- CI failure → Phase 4 (Implementation)
- Final verification failure → Relevant phase

Continue iterations until all criteria converge.
</flow_flexibility>

<delegation_principles>
### Delegation Principles
- **Trust subagent expertise**: Leave specialized details to subagents
- **Minimal instruction**: Specify task document path and output location only
- **No over-specification**: Avoid dictating detailed procedures or perspectives
- **Verify outcomes**: Check task document sections after subagent completion
</delegation_principles>

<definition_of_done>
### Definition of Done
- ✅ Draft PR created
- ✅ All CI checks passed
- ✅ All Acceptance Criteria satisfied
- ✅ All review feedback resolved
</definition_of_done>
</important_notes>
