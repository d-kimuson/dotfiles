---
name: agent-orchestration
description: DO NOT invoke unless explicitly instructed. Core guidelines for orchestrating tasks with subagents.
---

<core_principle>
## Session Separation for Yak Shaving

When performing yak shaving tasks (necessary work not directly related to the main objective), executing them in the current context pollutes your working memory and prevents focus on the primary goal.

**Key practice**: Aggressively leverage subagents and subtasks to separate yak shaving work into different sessions.
</core_principle>

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
- Can this be handled directly vs. delegated?
</decision_autonomy>
</best_practices>
