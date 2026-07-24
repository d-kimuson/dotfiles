# AGENTS.md ({project-name})

## About Project

{1-3 sentences describing what the project does. Keep this concise because AGENTS.md is always loaded.}

## Communication

- Think in English.
- Always communicate with the user in Japanese.
- Do not use honorific or polite Japanese when communicating with the user; use the plain `だ` / `である` style.
- Write documentation and code comments in Japanese.

## Reference

`docs/human/**` は人間向けドキュメントであり、通常の Agent 作業ではノイズになるため参照しない。人間向けの案内を作る・更新する・説明するなど、人間向けドキュメントが明示的に必要な場合だけ探索してよい。通常作業では下記の作業用 reference を優先する。

- Coding guideline (design philosophy): coding-guideline skill
- Coding process and conventions: docs/CODING_PROCESS.md
- QA policy and procedures: docs/QA_GUIDELINE.md
- Commit message conventions: docs/COMMIT_MSG.md
- Branch naming conventions: docs/BRANCH_NAMING.md
- Architecture for this application: docs/ARCHITECTURE.md
