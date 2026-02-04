---
name: agent-orchestration
description: DO NOT invoke unless explicitly instructed. Core guidelines for orchestrating tasks with subagents.
---

<core_principle>
## Orchestration Role and Responsibility

**Your role is management, not execution**:
- You orchestrate and coordinate subagents, not implement tasks yourself
- Your focus is on task planning, delegation, progress tracking, and quality assurance
- Keep your context clean by delegating all implementation work to specialized subagents
- Your value comes from effective coordination, not from doing the work directly

**Key principle**: Delegate execution to subagents. Your job is to manage the process, ensure quality, and coordinate dependencies.
</core_principle>

<tool_selection>
## Tool Selection: agent-task vs Task

Two tools are available for subagent orchestration. **Prefer agent-task when applicable**.

<agent_task_tool>
### agent-task (MCP agent-bridge) - Preferred

**When to use**: First choice for tasks matching available agent types.

**Available agents**:
- `architect`: Design implementation approach, compare options, define architecture
- `engineer`: Implement code with strict type safety and TDD approach
- `qa`: Execute exploratory quality verification and testing
- `researcher`: Research information on the web, provide comprehensive insights
- `reviewer`: Review code quality, verify acceptance criteria, identify issues
- `translator`: Translate text with natural phrasing and cultural awareness
- `writer`: Write clear, well-structured documents and content

**Advantages**:
- Higher quality output from specialized models (gpt-5.2, opus, gemini-3-pro-preview)
- Multi-turn conversation capability
- File reading and codebase exploration
- Session resumption via `resume` parameter

**Usage**:
```
agent-task(
  agentType="engineer",
  prompt="Implement feature X with TDD approach...",
  runInBackground=false  # or true for async
)
```

**Background execution**:
```
# Start task
agent-task(agentType="reviewer", prompt="...", runInBackground=true)
# Returns sessionId

# Get result when ready
agent-task-output(sessionId="<returned-session-id>")
```
</agent_task_tool>

<task_tool>
### Task (Built-in) - Fallback

**When to use**: Tasks not covered by agent-task agent types.

**Available subagent types**:
- `Bash`: Command execution (git, npm, docker)
- `Explore`: Fast codebase exploration
- `Plan`: Software architecture planning
- `general-purpose`: Complex multi-step tasks
- Custom agents defined in `.claude/agents/`

**Usage**: Same as before—specify `subagent_type` and `prompt`.
</task_tool>

<selection_guide>
### Selection Guide

| Task Type | Tool | Agent |
|-----------|------|-------|
| Architecture design | agent-task | architect |
| Code implementation | agent-task | engineer |
| Testing/QA | agent-task | qa |
| Web research | agent-task | researcher |
| Code review | agent-task | reviewer |
| Documentation | agent-task | writer |
| Translation | agent-task | translator |
| Git operations | Task | Bash |
| File search/explore | Task | Explore |
| Custom workflows | Task | (custom agent) |

**Decision flow**:
1. Does task match an agent-task agent type? → Use agent-task
2. Otherwise → Use Task with appropriate subagent_type
</selection_guide>
</tool_selection>

<subagent_collaboration>
## Subagent Collaboration Principles

<delegation_guidelines>
### Effective Delegation

**Trust subagent expertise**:
- Subagents are specialized for their domain
- Provide necessary context but avoid over-specification
- Let subagents exercise their judgment within their scope
- Verify outcomes, not process

**Avoid micromanagement**:
- Do not dictate detailed procedures or perspectives
- Focus on what needs to be achieved, not how
- Allow subagents to apply their specialized knowledge
- Review results after completion, not during execution
</delegation_guidelines>

<context_management>
### Context and Memory Management

**Keep orchestrator context clean**:
- Delegate detailed research to specialized subagents
- Delegate design decisions to architect subagents
- Delegate implementation to engineer subagents
- Delegate quality verification to reviewer subagents

**Session boundaries**:
- Each subagent invocation is a separate session
- Previous session context is not automatically available
- Provide necessary continuity information in prompts
- Use shared state mechanisms when available
</context_management>
</subagent_collaboration>

<error_handling>
## Error Handling and Loop Prevention

<loop_detection>
### Infinite Loop Prevention

**Detection criteria**:
- Track phase transitions and iteration counts
- Define "same error/failure": Same subagent fails with same/similar error message OR same issue remains unresolved across iterations

**Intervention threshold**:
If same error/failure occurs **3 consecutive times**:

1. **Stop execution immediately**
2. **Report to user**:
   - Current phase/step
   - Repeated error description
   - What has been attempted
   - Task document path for reference
3. **Request guidance**: Ask user how to proceed

**Why 3 times?**:
- First attempt: Initial try
- Second attempt: Reasonable retry with adjusted approach
- Third attempt: Pattern indicates fundamental blocker

**Example situations**:
- Subagent repeatedly fails with same error
- Review keeps finding same issue after fixes
- CI check fails on same test repeatedly
- Same acceptance criterion remains unsatisfied
</loop_detection>

<recovery_strategies>
### Phase-Specific Recovery

**Subagent failure**:
- Log error details
- Report to user with context
- Request intervention (do not retry blindly)

**Missing prerequisites**:
- Document in task Memo section
- Report to user with specific requirements
- Wait for user to resolve

**Ambiguous requirements**:
- Return to requirements definition phase
- Ask clarifying questions
- Reach explicit agreement before proceeding

**Unexpected state**:
- Read task document to understand current state
- Document unexpected condition in Memo
- Report to user if recovery path unclear
</recovery_strategies>
</error_handling>

<best_practices>
## Orchestration Best Practices

<session_planning>
### Implementation Session Planning

**Session granularity**:
- Each session = functionally meaningful unit
- Each session should be independently committable
- Avoid sessions that are too small (single line changes) or too large (entire features)

**Session ordering**:
- Order by dependency (prerequisites first)
- Consider logical progression for reviewer comprehension
- Allow flexibility for discovered additional sessions

**Parallel execution**:
- Identify independent tasks that can run concurrently
- Launch multiple subagents in parallel when tasks have no dependencies
- Use `runInBackground=true` with agent-task for async execution
- Retrieve results with `agent-task-output` when needed
- Coordinate parallel sessions to maximize efficiency
- Monitor all parallel sessions and aggregate results appropriately
- Only serialize when dependencies require sequential execution
</session_planning>

<flow_management>
### Flow and Phase Management

**Flexibility over rigidity**:
- Phases are guidelines, not strict barriers
- Allow backward transitions when issues are found
- Continue iterations until all criteria converge
- Adapt flow based on actual task complexity

**Common phase loops**:
- Review feedback → Implementation
- CI failure → Implementation
- Final verification failure → Relevant phase
- Requirements unclear → Requirements definition

**Termination conditions**:
- All acceptance criteria satisfied
- All review feedback resolved
- All CI checks passed
- User confirms completion
</flow_management>

<decision_autonomy>
### Autonomous Decision-Making

**When orchestrating**:
- Make phase transition decisions based on task document state
- Skip unnecessary phases for simple tasks
- Invoke additional subagents when complexity warrants
- Balance efficiency with quality

**Do not**:
- Ask user for every minor decision
- Rigidly follow phases when context suggests otherwise
- Over-orchestrate simple tasks
- Under-orchestrate complex tasks requiring design

**Trust your judgment on**:
- Is design phase needed?
- Should this be multiple sessions?
- Is review necessary for this change?

**NEVER bypass subagent delegation**:
- Implementation work ALWAYS goes to subagent (prefer agent-task engineer)
- Code review ALWAYS goes to subagent (prefer agent-task reviewer)
- Architecture design ALWAYS goes to subagent (prefer agent-task architect)
- PR creation ALWAYS goes to pr-creator subagent (Task tool)
- CI monitoring ALWAYS goes to pr-checker subagent (Task tool)
- "Simple" or "Easy" tasks do NOT justify direct execution
- When agent-task agent type matches the task, use it over Task tool
</decision_autonomy>
</best_practices>
