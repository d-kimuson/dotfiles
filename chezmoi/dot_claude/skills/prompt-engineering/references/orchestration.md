# Orchestration Pattern Detailed Reference

Prompt design guide for orchestration workflows using subagents.

## Importance of Invocation Templates

**Critical Requirement: Orchestrators must always provide explicit invocation templates**

### Why Templates Are Essential
1. **Consistency**: Same invocation pattern every time, reduces variation
2. **Reproducibility**: Future maintainers can verify exact invocation structure
3. **Clarity**: Makes orchestration contracts explicit rather than implicit
4. **Maintainability**: Single source of truth for how to invoke subagents
5. **Discoverability**: New users can understand patterns immediately

### Good Template Example
```markdown
## Invoking the Implementation Agent

Use this template:

agent-task(
  agent="engineer",
  message="""
Please implement the following feature:
{feature_description}

Requirements:
{requirements}

Acceptance Criteria:
{acceptance_criteria}

Follow project conventions and include tests.
"""
)
```

## Responsibility Division Between Orchestrator and Subagent

**Design Principle**: Subagents are single-purpose but reusable across many tasks. Task-specific context goes in orchestrator templates; responsibility-specific practices go in subagents.

### Subagent Prompt (Responsibility-Specific, Reusable)
- Core practices always needed for this responsibility
- Domain-specific knowledge and constraints
- General workflow for this type of task
- Error handling patterns for this domain
- Quality standards for this responsibility

### Orchestrator Invocation Template (Task-Specific, Context-Dependent)
- Context and background for the current task
- Task-specific rules and constraints
- Specific focus areas or priorities for this task
- Integration requirements with other workflow steps
- Project-specific constraints that don't apply universally

## Concrete Example: Code Review Agent

### Subagent Prompt (`.claude/agents/reviewer.md`)
```markdown
Review code changes for quality and correctness.

Check for:
- Type safety and correctness
- Security vulnerabilities
- Performance issues
- Code style consistency
- Test coverage adequacy

Report format:
- Severity level (critical/moderate/minor)
- File path and line number
- Specific recommendations
- Priority order (critical first)
```

### Orchestrator Template
```markdown
agent-task(
  agent="reviewer",
  message="""
Please review the authentication feature implementation.

Context: Healthcare application handling PHI data under HIPAA.

Additional requirements for this review:
- HIPAA compliance is critical (report violations as critical)
- All database queries must use parameterized statements
- Session tokens must expire within 15 minutes
- Password hashing must use bcrypt with cost factor ≥12

Files to review: src/auth/*.ts

Focus on security and compliance issues.
"""
)
```

## Design Questions for Responsibility Division

### Should this go in the subagent prompt?
- Is this practice always needed for this type of task?
- Does this define the agent's core responsibility?
- Would the agent need this knowledge for any task it handles?
- Is this domain-specific expertise for this responsibility?

→ **If YES**: Include in subagent prompt

### Should this go in the orchestrator template?
- Is this specific to the current task or project?
- Does it depend on previous steps in the workflow?
- Is this a temporary constraint or priority?
- Does it require context from the orchestration flow?

→ **If YES**: Include in invocation template

### Examples
- ✅ Subagent: "Check for type errors and unused variables"
- ✅ Orchestrator: "Focus on the payment module we refactored in the previous step"
- ✅ Subagent: "Report security vulnerabilities with severity levels"
- ✅ Orchestrator: "This handles credit card data—PCI-DSS compliance is critical"

## Additional Considerations

### Failure Handling
- Orchestrators handle subagent failures gracefully
- Define retry strategies for critical tasks
- Clear error reporting from subagents

### Template Maintenance
- Keep invocation templates in one place for easy updates
- Review all orchestrator templates when subagent prompts change
- Document expected inputs and outputs for each subagent
