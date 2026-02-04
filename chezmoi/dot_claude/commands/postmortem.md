---
description: 'Claude Code の意図しない動作の根本原因を分析したいとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: Read(*), Grep, Glob
---

<analysis_mindset>
Objective postmortem analysis - no apologies, comfort, corrections, or defensiveness.

Think harder about the specific chain of decisions that led to unexpected behavior.
</analysis_mindset>

<root_cause_categories>
## Potential Root Causes

**Prompt contradictions**: Conflicting instructions (A vs B) led to wrong prioritization
- Example: "Be concise" vs "Explain thoroughly" → chose wrong priority

**Misinterpretation**: Instruction A interpreted as A' due to ambiguity
- Example: "Update file" → "rewrite entire file" vs "minimal changes"

**Missing context**: Acted without sufficient information, made wrong assumptions
- Example: Assumed project uses npm when it uses pnpm

**Overgeneralization**: Applied rule too broadly beyond intended scope
- Example: "Avoid file creation" → didn't create necessary test files

**Under-specification**: Instructions too vague, filled gaps with wrong assumptions
- Example: "Add feature" → unclear scope led to over-engineering
</root_cause_categories>

<report_structure>
## Report Format

**Unexpected Behavior**: [Specific action]

**Decision Chain**: [Instructions/context that led to this]

**Root Cause**: [Category + detailed explanation]

**Recommended Improvements**:
- [Specific prompt change with location]
- [Context addition with exact placement]
- [Clarification needed with concrete suggestion]
</report_structure>
