# workspace

## pnpm-workspace.yaml

```yaml
packages:
  - apps/*
  - packages/*
```

## turbo

```bash
pnpm add -D -w turbo
```

```json:turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_OPTIONS", "NODE_ENV"],
  "globalDependencies": [
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".node-version"
  ],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "outputs": ["dist/**", "out/**", ".next/**"]
    },
    "lint": {},
    "fix": {},
    "typecheck": {},
    "test": {}
  }
}
```
