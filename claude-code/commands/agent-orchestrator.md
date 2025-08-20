---
description: 'Advanced orchestration pattern using multiple specialized sub-agents for complex tasks'
allowed-tools: Task, LS, Glob, Grep
---

Execute complex tasks by orchestrating multiple specialized sub-agents for efficient parallel execution.

## Process

1. **Task Decomposition**

   Break main task into 3-6 specialized subtasks based on:
   - Agent specialization (general-purpose, context-collector, debugger, reviewer)
   - Clear input/output boundaries
   - Logical dependencies between subtasks
   - Opportunities for parallel execution

2. **Execute Subtasks with Specialized Agents**

   - **Sub-agent Orchestration**: Use Task tool with appropriate `subagent_type` for each subtask:
     - `general-purpose`: Complex research, multi-step implementation tasks
     - `context-collector`: Requirement analysis, documentation gathering
     - `debugger`: Error investigation, troubleshooting
     - `reviewer`: Code review, quality assessment
   - **Execution Strategy**: 
     - Execute independent subtasks in parallel
     - Sequential execution for dependent subtasks
     - Coordinate handoffs between specialized agents

3. **Aggregate and Finalize**

   - **Result Synthesis**: Combine all sub-agent outputs
   - **Quality Assurance**: Verify task completion against original requirements
   - **Final Report**: Provide concise summary of achievements and any outstanding items

## Implementation Example

**Scenario**: "Implement user authentication system with OAuth integration"

**Sub-agent Execution:**

```text
// Phase 1: Requirements and Architecture Analysis
Task(
  subagent_type: "context-collector",
  description: "Auth requirements analysis", 
  prompt: "Analyze requirements for authentication system implementation. Gather focused context including: target files to modify, existing code patterns to follow, coding standards, integration points with existing systems, and technical constraints. Prepare actionable guidance optimized for implementation."
)

// Phase 2: Core Authentication Implementation
Task(
  subagent_type: "general-purpose",
  description: "Core auth implementation",
  prompt: "Implement core authentication system including user models, auth endpoints, JWT utilities, and middleware. Follow patterns and standards identified in the requirements analysis phase."
)

// Phase 3: OAuth Integration
Task(
  subagent_type: "general-purpose",
  description: "OAuth integration",
  prompt: "Implement OAuth integration adding Google and GitHub OAuth providers, handle OAuth callbacks, and integrate with the existing auth system created in the previous phase."
)

// Phase 4: Code Review and Quality Assurance
Task(
  subagent_type: "reviewer",
  description: "Auth implementation review",
  prompt: "Conduct comprehensive code review of the complete authentication implementation. Review for: coding guidelines compliance, security vulnerabilities, functional requirements fulfillment, and quality standards. Categorize feedback as MUST (critical) or WANT (improvements)."
)
```

**Workflow**: Each specialized agent performs its task building upon previous work, with sequential execution for dependent tasks and potential parallel execution for independent components.

## Key Advantages

- **Agent Specialization**: Leverages specific sub-agent capabilities for optimal task execution
- **Parallel Efficiency**: Independent subtasks execute simultaneously while maintaining coordination
- **Quality Assurance**: Specialized reviewer agents ensure consistent quality standards
- **Scalable Coordination**: Framework scales from simple tasks to complex multi-agent workflows

## Best Practices

- **Agent Selection**: Choose appropriate sub-agent types based on task characteristics
- **Dependency Management**: Clearly define task dependencies and execution order
- **Error Handling**: Use debugger agents for systematic error investigation
- **Quality Control**: Always include reviewer agents for significant implementations
