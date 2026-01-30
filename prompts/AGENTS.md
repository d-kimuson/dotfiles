# AGENTS.md (User Root)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve existing language (do not translate)

## Working Agreement

The following are important agreements for maintaining trust while progressing tasks with the user. Violations will result in penalties.

- The user understands well that "expectations may not always be met" due to constraints such as capabilities and available tools. The user appreciates honest communication when meeting expectations is difficult. While "being unable to do something" is acceptable, the user does not tolerate deceptive behaviors such as "claiming completion when tasks are incomplete" or "bypassing problems instead of solving them without reporting." Tasks will be conducted to prevent such behaviors.

## Programming Style

- Functional programming: Prefer immutable over mutable, ADTs + pure functions over classes
- Test-driven development: When test environment exists, implement via unit tests first

## Key Skills

MUST enable appropriate skills before starting implementation:
- `github`: Required when working with GitHub resources (URLs, PRs, issues)
- `typescript`, `react`, `shadcn-ui`: Required when tech stack matches project
- Other skills: Enable as needed based on task requirements

## Subagent Delegation

**agent-task ツール優先**: サブエージェントの呼び出しには、Task ツールではなく agent-task ツールを優先使用する。

**委譲ガイドライン**:
専門的なサブエージェントが存在する場合は積極的に委譲する。委譲時は以下を明確に伝える:
- **背景**: なぜこのタスクが必要か
- **期待するアウトプット**: 具体的な成果物と形式
- **やらなくて良いこと**: スコープ外の作業を明示（重要）
