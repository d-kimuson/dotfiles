---
description: 'Analyze recent session logs and iteratively improve Claude Code configurations, commands, and workflows through retrospective analysis'
allowed-tools: Bash, LS, Read, Glob, Grep, Edit, MultiEdit, Write, Task
---

Analyze recent Claude Code session logs to identify usage patterns, pain points, and improvement opportunities. Based on findings, update CLAUDE.md, existing commands, and create new commands to enhance productivity.

## Process

### 1. **Log Collection and Analysis**

- **Identify Recent Sessions**: List recent `.jsonl` files in `~/.claude/projects/<current-project>/` sorted by modification time
- **Extract User Patterns**: Analyze user message patterns to understand:
  - Most frequently requested tasks
  - Repeated pain points or workflow gaps  
  - Command usage effectiveness
  - Tool usage patterns and inefficiencies
- **Extract Assistant Patterns**: Analyze assistant responses to identify:
  - Common tool usage sequences
  - Frequent error patterns or retries
  - Context management issues
  - Memory/performance bottlenecks

### 2. **Pattern Identification**

Use jq/grep to extract structured insights:

```bash
# Extract user command usage patterns
jq -r 'select(.message.role == "user") | select(.message.content | tostring | test("command-name|/")) | .timestamp + " " + (.message.content | tostring | .[0:100])' ~/.claude/projects/<project>/*.jsonl

# Extract tool usage patterns  
jq -r 'select(.type == "assistant") | select(.message.content) | .timestamp + " Tools: " + (if .message.content | type == "array" then ([.message.content[] | select(.type == "tool_use") | .name] | join(",")) else "none" end)' ~/.claude/projects/<project>/*.jsonl

# Extract error patterns
grep -h "error\|Error\|fail\|Fail" ~/.claude/projects/<project>/*.jsonl | head -20
```

### 3. **Insights Synthesis**

Generate actionable insights in these categories:

#### **A. Command Effectiveness Analysis**
- Which commands are frequently used vs. underutilized
- Command success rates and common failure patterns
- Missing commands that could address repeated manual workflows
- Command parameter/interface improvement opportunities

#### **B. Workflow Optimization**
- Repetitive tool usage patterns that could be automated
- Context switching inefficiencies
- Memory/performance issues in complex tasks
- Sub-agent utilization patterns and improvements

#### **C. Configuration Gaps**
- CLAUDE.md guidelines that need updates based on observed issues
- Missing tool combinations or workflow patterns
- Yak shaving scenarios that need better session separation strategies

### 4. **Implementation Planning**

For each insight, determine update strategy:

#### **High-Impact Updates**
- CLAUDE.md guideline additions/modifications
- New command creation for frequent workflows  
- Existing command enhancement for better usability

#### **Incremental Improvements**  
- Command parameter optimization
- Tool usage pattern refinements
- Error handling improvements

### 5. **Automated Updates**

Execute prioritized improvements:

- **CLAUDE.md Updates**: Add new guidelines, refine existing patterns
- **Command Updates**: Modify existing commands based on usage insights
- **New Command Creation**: Build commands for identified workflow gaps
- **Validation**: Test updated commands with representative scenarios

### 6. **Research Enhancement**

When external information is needed:

```bash
# Use gemini CLI for web research (per CLAUDE.md guidelines)
gemini -p '/web-research <topic> について最新のベストプラクティスを調査'
```

## Output Requirements

Provide structured retrospective report:

1. **Executive Summary** (100 words)
   - Key insights discovered
   - Priority improvements identified
   - Implementation completion status

2. **Detailed Findings** (300-500 words)
   - Command usage analytics with specific metrics
   - Workflow pain points with examples from logs
   - Tool usage optimization opportunities
   - Missing automation opportunities

3. **Implementation Results** (200 words)
   - Specific files updated with change summaries
   - New commands created with descriptions
   - Configuration improvements applied
   - Validation results and next steps

## Key Benefits

- **Data-Driven Improvement**: Uses actual usage patterns rather than assumptions
- **Continuous Evolution**: Regular retrospectives enable incremental optimization
- **Pain Point Resolution**: Identifies and addresses real workflow bottlenecks
- **Automation Discovery**: Finds repetitive patterns suitable for command creation
- **Context Optimization**: Improves memory and context management strategies
- **Knowledge Retention**: Preserves insights for future session optimization