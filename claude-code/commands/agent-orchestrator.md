---
description: 'Advanced orchestration pattern using sub-agents with shared context for complex tasks'
allowed-tools: Bash(uuidgen), Bash(mkdir:*), Write, Read, Task, LS, Glob, Grep
---

Execute complex tasks by orchestrating multiple specialized sub-agents with shared context management.

## Process

1. **Initialize Task Environment**
   
   - **Generate Task ID**: Use `uuidgen` to create unique task identifier
   - **Create Task Directory**: Make `.claude/tasks/<id>/` directory structure
   - **Initialize Shared Context**: Create `.claude/tasks/<id>/context.md` with task overview, requirements, and progress tracking
   - **Task Decomposition**: Break main task into 3-6 specialized subtasks based on:
     - Agent specialization (general-purpose, context-collector, debugger, reviewer)
     - Clear input/output boundaries
     - Logical dependencies between subtasks
     - Context sharing opportunities

2. **Execute Subtasks with Context Sharing**
   
   - **Sub-agent Orchestration**: Use Task tool with appropriate `subagent_type` for each subtask:
     - `general-purpose`: Complex research, multi-step implementation tasks
     - `context-collector`: Requirement analysis, documentation gathering
     - `debugger`: Error investigation, troubleshooting
     - `reviewer`: Code review, quality assessment
   - **Shared Context Protocol**: Every sub-agent receives:
     - Path to shared context file: `.claude/tasks/<id>/context.md`
     - Instructions to read existing context before starting
     - Permission to update context with findings and progress
     - Guidelines for structured context updates
   - **Execution Strategy**: 
     - Execute independent subtasks in parallel
     - Sequential execution for dependent subtasks
     - Monitor context updates between agents

3. **Context Management Guidelines**
   
   - **Context Structure**: Maintain consistent sections in context.md:
     - `## Task Overview`: Main objective and high-level requirements
     - `## Target Files`: Specific files to modify with brief purpose descriptions (populated by context-collector)
     - `## Reference Patterns`: Existing code patterns to follow (populated by context-collector)
     - `## Coding Standards`: Relevant rules and conventions (condensed) (populated by context-collector)
     - `## Integration Points`: How new code should connect with existing systems (populated by context-collector)
     - `## Implementation Constraints`: Technical limitations and requirements (populated by context-collector)
     - `## Findings`: Key discoveries and insights from all agents
     - `## Files Modified`: Tracking of changes made
     - `## Next Actions`: Dependencies and follow-up tasks
   - **Update Protocol**: Sub-agents should:
     - Read entire context before starting work
     - Add findings to appropriate sections
     - Signal task completion and handoffs

4. **Aggregate and Finalize**
   
   - **Result Synthesis**: Combine all sub-agent outputs from shared context
   - **Quality Assurance**: Verify task completion against original requirements
   - **Context Cleanup**: Archive or clean up task directory as appropriate
   - **Final Report**: Provide concise summary of achievements and any outstanding items

## Implementation Example

**Scenario**: "Implement user authentication system with OAuth integration"

**Initialization Phase:**

```bash
# Generate task ID
TASK_ID=$(uuidgen)
mkdir -p .claude/tasks/$TASK_ID
```

**Context File Setup:**

```markdown
# Authentication System Implementation - Task $TASK_ID

## Task Overview
Implement complete user authentication system with OAuth integration including:
- User registration/login endpoints
- OAuth provider integration (Google, GitHub)
- JWT token management
- Session handling
- Security middleware

## Target Files
<!-- context-collector will populate: Specific files to modify with brief purpose descriptions -->

## Reference Patterns
<!-- context-collector will populate: Existing code patterns to follow -->

## Coding Standards
<!-- context-collector will populate: Relevant rules and conventions (condensed) -->

## Integration Points
<!-- context-collector will populate: How new code should connect with existing systems -->

## Implementation Constraints
<!-- context-collector will populate: Technical limitations and requirements -->

## Findings
<!-- Sub-agents will populate this section -->

## Files Modified
<!-- Track all file changes here -->

## Next Actions
<!-- Dependencies and handoffs between agents -->
```

**Sub-agent Execution:**

```text
// Phase 1: Requirements and Architecture (context-collector)
Task(
  subagent_type: "context-collector",
  description: "Auth requirements analysis", 
  prompt: "Analyze requirements for authentication system. Read shared context at .claude/tasks/$TASK_ID/context.md and prepare focused implementation context. Populate the following sections: Target Files (specific files to modify), Reference Patterns (existing code patterns to follow), Coding Standards (condensed rules), Integration Points (how to connect with existing systems), and Implementation Constraints (technical limitations). Focus on actionable guidance optimized for implementation without context overload."
)

// Phase 2: Implementation (general-purpose)
Task(
  subagent_type: "general-purpose",
  description: "Core auth implementation",
  prompt: "Implement core authentication system based on context at .claude/tasks/$TASK_ID/context.md. Create user models, auth endpoints, JWT utilities, and middleware. Update context with implementation details and any issues discovered."
)

// Phase 3: OAuth Integration (general-purpose) 
Task(
  subagent_type: "general-purpose",
  description: "OAuth integration",
  prompt: "Implement OAuth integration using context from .claude/tasks/$TASK_ID/context.md. Add Google and GitHub OAuth providers, handle OAuth callbacks, and integrate with existing auth system. Update context with configuration requirements."
)

// Phase 4: Code Review (reviewer)
Task(
  subagent_type: "reviewer",
  description: "Auth implementation review",
  prompt: "Conduct comprehensive code review of authentication implementation. Read context from .claude/tasks/$TASK_ID/context.md to understand requirements and standards. Review for: coding guidelines compliance, security vulnerabilities, functional requirements fulfillment, and quality standards. Categorize feedback as MUST (critical) or WANT (improvements). Update context with review findings and Pass/Fail assessment."
)
```

**Context Evolution**: Each agent reads the shared context, performs its specialized task, and updates the context with findings. Later agents build upon earlier work, creating a collaborative workflow.

## Key Advantages

- **Agent Specialization**: Leverages specific sub-agent capabilities for optimal task execution
- **Shared Knowledge**: Context file enables information flow between specialized agents
- **Parallel Efficiency**: Independent subtasks execute simultaneously while maintaining coordination
- **Progress Transparency**: Shared context provides real-time visibility into task progression
- **Error Recovery**: Context preservation allows recovery and continuation from any point
- **Quality Assurance**: Specialized reviewer agents ensure consistent quality standards
- **Scalable Coordination**: Framework scales from simple tasks to complex multi-agent workflows

## Best Practices

- **Context Updates**: Ensure each agent contributes meaningful findings to shared context
- **Agent Selection**: Choose appropriate sub-agent types based on task characteristics
- **Dependency Management**: Clearly define task dependencies in context file
- **Error Handling**: Use shared context to communicate errors and resolution strategies
- **Resource Cleanup**: Archive task directories after completion to maintain organization