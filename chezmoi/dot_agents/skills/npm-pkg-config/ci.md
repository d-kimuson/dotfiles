# CI (GitHub Actions)

## .github/actions/setup-node/action.yml

```yaml:.github/actions/setup-node/action.yml
name: "Setup Node & pnpm"
description: "Install pnpm and setup Node.js with pnpm cache (fixed versions)"
runs:
  using: "composite"
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@8f152de45cc393bb48ce5d89d36b731f54556e65 # v4.0.0
      with:
        node-version-file: '.node-version'

    - name: Setup pnpm
      shell: bash
      run: npm install -g pnpm

    - name: Install Dependencies
      shell: bash
      run: pnpm i --frozen-lockfile --ignore-scripts
```

## .github/workflows/ci.yml

```yaml:.github/workflows/ci.yml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}-ci
  cancel-in-progress: true

jobs:
  check:
    name: check
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@1af3b93b6815bc44a9784bd300feb67ff0d1eeb3 # v6.0.0

      - name: Setup Node & pnpm
        uses: ./.github/actions/setup-node

      - name: Run linting
        run: pnpm lint

      - name: Run type checking
        run: pnpm typecheck

      - name: Run tests
        run: pnpm test
```
