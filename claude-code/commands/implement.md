---
description: 'Plan, design, and delegate implementation to subagents with QA/review'
allowed-tools: Bash(git, gh), Read, Write, Edit
---

Plan and implement features by designing the overall structure and delegating detailed implementation to specialized agents. Execute QA and review before completion.

<setup>
## Initial Setup

**Load core guidelines**:
```
Skill(command: "github")
```

**Load project coding guidelines**:
```
Read(".kimuson/guidelines/coding-guideline.md")
```

If the guideline document doesn't exist, inform the user to create it first using `/setup-project-guidelines`.
</setup>

<role>
Design implementation approach, delegate detailed work to subagents, coordinate QA and review.
</role>

<orchestration_principle>
## Why Delegate to Subagents

**Your responsibility**: Strategic planning and coordination, not detailed implementation.

**Focus on high-level concerns**:
- Overall architecture and module boundaries
- Interface design and contracts
- Integration points and data flow
- Progress coordination and quality assurance

**Delegate detailed implementation** to subagents:
- Subagents specialize in focused execution
- Keeps your context clean for strategic oversight
- Allows you to manage multiple work streams efficiently
- Provides natural checkpoints for review and verification

**Key principle**: You draw the blueprint and set the direction. Subagents build the details. This separation allows you to maintain the big picture while ensuring quality implementation.
</orchestration_principle>

<workflow>
## Phase 1: Context Collection (Conditional)

<decision>
Determine if context collection is needed:

**Required when**:
- Need to understand existing codebase structure
- Modifying existing features (need to see patterns)
- Large feature spanning multiple files/modules

**Skip when**:
- Trivial changes to known locations
- Working on new isolated feature
- Task is clearly scoped with known files

**If needed** → Invoke context-collector:
```
Task(
  subagent_type="context-collector",
  prompt="Collect context for: [task description]

Gather information about:
- [Specific area/module to understand]
- [Related files/patterns]
- [Existing conventions]",
  description="Collect context"
)
```
</decision>

## Phase 2: Design and Planning

### Step 2.1: Design Overall Approach

<design_principles>
Design the high-level architecture and interfaces:

**What to design yourself**:
- Overall structure and module boundaries
- Public interfaces and contracts between components
- Data flow and dependencies
- Integration points
- High-level error handling strategy

**What NOT to design** (delegate to subagents):
- Detailed implementation logic
- Internal function implementations
- Specific algorithms
- Test implementations

**Design artifacts to create**:
- Interface definitions (types, function signatures)
- Component structure outline
- Data models and schemas
- API contracts
- File structure if creating new modules

**Think harder** about edge cases, potential issues, and maintainability implications.
</design_principles>

### Step 2.2: Create Implementation Plan

<planning>
Break down the work into logical units for delegation:

**Planning principles**:
- Each unit should be independently implementable
- Define clear interfaces between units
- Identify dependencies and order
- Consider TDD approach if tests exist

**Plan format**:
1. **Unit 1**: [Description]
   - Interface: [What it exposes]
   - Dependencies: [What it needs]
   - Delegation strategy: [Subagent approach]

2. **Unit 2**: [Description]
   - Interface: [What it exposes]
   - Dependencies: [What it needs]
   - Delegation strategy: [Subagent approach]

3. **Unit 3**: [Description]
   - ...

**Document plan** in working notes or task document if exists.
</planning>

### Step 2.3: Implement Interfaces and Structure

<interface_implementation>
Implement the interfaces and high-level structure yourself:

**What to implement**:
- Type definitions and interfaces
- Function signatures with placeholder bodies
- File structure and exports
- Integration glue code structure

**What to leave for subagents**:
- Function body implementations
- Complex logic
- Detailed error handling
- Test implementations

**Example approach**:
```typescript
export const getUser = async (userId: string): Promise<User> => {
  // TODO: Delegate to engineer - implement user retrieval logic
  throw new Error('Not implemented yet');
};
```

**TDD approach** (if tests exist):
- Write or outline test cases first
- Define expected behavior through tests
- Leave implementation to subagent with test guidance
</interface_implementation>

## Phase 3: Delegated Implementation

<delegation>
For each implementation unit, delegate to engineer subagent:

**Invocation template**:
```
Task(
  subagent_type="engineer",
  prompt="Implement [unit description].

Context:
[Relevant context from Phase 1 if collected]

Requirements:
- Implement the following interfaces/functions: [list]
- Follow the existing patterns in [related files]
- Ensure type safety and error handling
- [Specific requirements for this unit]

Files to modify:
- [file1]: [what to implement]
- [file2]: [what to implement]

[If TDD]: Tests are in [test file]. Make them pass.
[If no tests]: Add tests for the implementation.

DO NOT modify:
- [files/interfaces you've defined]

Focus on the implementation details while maintaining the defined interfaces.",
  description="Implement [unit name]"
)
```

**Sequential delegation**:
- Delegate units in dependency order
- Wait for dependencies to complete before starting dependent units
- Review interfaces after each unit if needed

**Parallel delegation** (if units are independent):
- Invoke multiple engineer agents simultaneously
- Ensure clear separation of responsibility
- Be careful of potential merge conflicts
</delegation>

## Phase 4: Quality Assurance

After all implementation units complete, verify quality:

### Step 4.1: Code Review

```
Task(
  subagent_type="reviewer",
  prompt="Review the implementation of: [task description]

Focus on:
- Interface contract adherence
- Type safety and error handling
- Code quality and maintainability
- Consistency with existing codebase patterns
- Test coverage

Changed files:
[List files modified in this task]",
  description="Code review"
)
```

### Step 4.2: QA Verification

```
Task(
  subagent_type="qa",
  prompt="Execute QA verification for: [task description]

Verify:
- All tests pass
- Functionality meets requirements
- Error cases are handled
- Integration points work correctly

Test scenarios:
[List key scenarios to verify]",
  description="QA verification"
)
```

### Step 4.3: Handle Feedback

<feedback_handling>
After review and QA:

1. **Read feedback** from both agents
2. **If issues found**:
   - Prioritize critical issues
   - Delegate fixes to engineer:
   ```
   Task(
     subagent_type="engineer",
     prompt="Fix issues identified in review/QA:

   Issues:
   - [Issue 1 with location and description]
   - [Issue 2 with location and description]

   Address each issue while maintaining existing functionality.",
     description="Fix review/QA issues"
   )
   ```
   - After fixes, repeat review/QA if significant changes
3. **If no issues or minor issues resolved**: Proceed to completion
</feedback_handling>

## Phase 5: Completion Verification

<verification>
Verify the implementation is complete:

**Checklist**:
- [ ] All planned units are implemented
- [ ] Tests pass (run test command to verify)
- [ ] Review feedback addressed
- [ ] QA verification passed
- [ ] No TODO comments left in critical paths
- [ ] Documentation updated if needed

**If checklist passes** → Report completion
**If issues remain** → Address specific gaps
</verification>

## Phase 6: Completion Report

Report to user:

```
✅ Implementation complete

**Summary**: [Brief description of what was implemented]

**Structure**:
- [Key files/components created or modified]

**Testing**: [Test results summary]

**Review**: No critical issues ✅
**QA**: All verifications passed ✅

Next steps:
[Suggest commit/PR creation if not done, or other relevant next steps]
```
</workflow>

<guidelines>
## Key Principles

**Interface-driven development**:
- Design interfaces first
- Implement structure before details
- Delegate detailed implementation

**Smart delegation**:
- Delegate units with clear boundaries
- Provide context and requirements
- Let subagents handle implementation details

**TDD when possible**:
- Write or use existing tests as specifications
- Let tests guide implementation
- Ensure test coverage through delegation instructions

**Iterative refinement**:
- Review and QA provide feedback loops
- Address issues through targeted fixes
- Don't skip quality verification

**Error handling**:
- If subagent fails: Review error, provide additional context, retry
- If tests fail: Analyze failures, provide specific fix instructions
- If unclear requirements: Ask user for clarification before proceeding
</guidelines>

<authorization>
## Workflow Authorization

This command implies authorization for:
- Code implementation through subagents
- Git operations (commits) by engineer subagents during implementation
- Running tests and verification

PR creation and branch management are user's responsibility.
</authorization>
