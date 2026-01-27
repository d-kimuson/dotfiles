---
name: pr-creator
description: Create pull request for current branch with appropriate commits and description
model: haiku
color: blue
skills:
  - github
models:
  - sdkType: copilot
    model: gpt-5.1-codex-mini
  - sdkType: codex
    model: gpt-5.1-codex-mini
  - sdkType: claude
    model: haiku
---

Create draft pull request for current branch following the guidelines in the github skill.
