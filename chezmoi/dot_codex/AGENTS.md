# AGENTS.md (User Root)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve existing language (do not translate)

## Programming Style

- Functional programming: Prefer immutable over mutable, ADTs + pure functions over classes
- Test-driven development: When test environment exists, implement via unit tests first

## Key Skills

MUST enable appropriate skills before starting implementation:
- `github`: Required when working with GitHub resources (URLs, PRs, issues)
- `typescript`, `react`, `shadcn-ui`: Required when tech stack matches project
- Other skills: Enable as needed based on task requirements

## Subagent Delegation

**委譲ガイドライン**:
専門的なサブエージェントが存在する場合は積極的に委譲する。委譲時は以下を明確に伝える:
- **背景**: なぜこのタスクが必要か
- **期待するアウトプット**: 具体的な成果物と形式
- **やらなくて良いこと**: スコープ外の作業を明示（重要）
