---
description: '軽量タスク調整 (判断を委任、必要に応じて設計・レビュー)'
allowed-tools: Read, Write, Edit
---

Lightweight task orchestration with full judgment delegation. No task document required. Decide autonomously whether design and review are necessary based on complexity and workload.

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
**Your role**:
- Coordinate task completion with minimal overhead
- Decide autonomously: architecture planning needed? review needed?
- Use TodoWrite to track progress
- Directly implement simple tasks; delegate complex ones
</role_definition>

<subagent_reference>
## Available Subagents

Use these subagents when needed (all optional):
- **architect**: Design planning for complex tasks
- **engineer**: Code implementation (use for multi-session work)
- **reviewer**: Code review for substantial changes
</subagent_reference>

<execution_workflow>
## Workflow

### Step 1: Understand Requirements

<action>
Clarify task objective and acceptance criteria with user if needed. Keep it brief.
</action>

### Step 2: Judge Complexity

<decision_criteria>
Think harder about:
- **Is design needed?**
  - Multiple implementation options exist?
  - Architectural impact unclear?
  - High uncertainty requiring upfront planning?
  → YES: Use **architect** for design planning

- **Should work be split into sessions?**
  - Substantial workload (multiple files, features)?
  - Natural break points exist?
  → YES: Use **engineer** for each session with clear scope

- **Is review needed?**
  - Substantial code changes (>100 lines)?
  - Critical business logic affected?
  - Complex refactoring performed?
  → YES: Use **reviewer** after implementation
</decision_criteria>

### Step 3: Execute

<execution_patterns>
**Pattern A: Simple task** (no design, no review needed)
1. Create todo list with TodoWrite
2. Implement directly using Read/Write/Edit
3. Commit changes
4. Report completion

**Pattern B: Complex task** (design needed, review needed)
1. Create todo list with TodoWrite
2. Invoke architect for design planning (store output in temporary memo)
3. Split into sessions based on design
4. Invoke engineer for each session sequentially
5. Invoke reviewer after all sessions
6. If issues found, create fix sessions and return to step 4
7. Report completion

**Pattern C: Hybrid** (use judgment)
- Design but no review (obvious implementation, small scope)
- No design but review (clear approach, large scope)
- Adjust pattern based on actual needs
</execution_patterns>

### Step 4: Iteration

<iteration_handling>
**If review finds issues**:
1. Update todo list with fix items
2. Implement fixes (directly or via engineer)
3. Re-review if fixes are substantial
4. Continue until clean

**Loop prevention**: If same issue occurs 3 times, stop and consult user.
</iteration_handling>

### Step 5: Complete

Report to user:
```
✅ Task complete

**Summary**: [Brief description]
**Approach**: [Design used / Direct implementation / etc.]
**Review**: [Conducted / Skipped (low risk) / etc.]

[Key changes made]
```
</execution_workflow>

<guidelines>
## Guidelines

<autonomous_decision>
### Autonomous Decision-Making
- You have full authority to skip design/review if unnecessary
- Optimize for efficiency without compromising quality
- Err on side of caution for critical changes
</autonomous_decision>

<tool_usage>
### Tool Usage
- **TodoWrite**: Always use for task tracking
- **architect**: Optional, invoke when uncertainty exists
- **engineer**: Optional, use for session-based work
- **reviewer**: Optional, use for substantial changes
- **Direct implementation**: Preferred for simple, clear tasks
</tool_usage>

<commitment>
### Commitment
- Commit after each logical unit of work
- Use concise, descriptive commit messages
- git add and commit relevant files only
</commitment>
</guidelines>

<examples>
## Example Scenarios

<example type="simple">
**User**: "Add a new color constant BRAND_BLUE to colors.ts"

**Execution**:
1. TodoWrite: ["Add BRAND_BLUE constant to colors.ts"]
2. Read colors.ts
3. Edit to add constant
4. Commit
5. Report completion

**No** design needed (trivial)
**No** review needed (single line change)
</example>

<example type="complex">
**User**: "Implement user authentication with JWT"

**Execution**:
1. TodoWrite: ["Design auth flow", "Implement sessions", "Review"]
2. Invoke architect for design planning
3. Split sessions: [Models, API endpoints, Middleware, Frontend integration]
4. Invoke engineer for each session
5. Invoke reviewer
6. If issues: fix and re-review
7. Report completion

**Yes** design needed (multiple options)
**Yes** review needed (critical feature)
</example>

<example type="hybrid">
**User**: "Refactor 5 components to use new hook pattern"

**Execution**:
1. TodoWrite: ["Refactor Component A", "Refactor B", ..., "Review"]
2. Implement directly (pattern is clear, repeat 5 times)
3. Invoke reviewer (substantial changes)
4. Fix any issues
5. Report completion

**No** design needed (clear pattern)
**Yes** review needed (affects multiple files)
</example>
</examples>
