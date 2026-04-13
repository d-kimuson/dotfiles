# typescript

## Install

```bash
pnpm add -D typescript @tsconfig/strictest
# if required
pnpm add -D @types/node @types/react @types/react-dom
```

## package.json

型チェックには tsgo を使用する。

```json:package.json
{
  "scripts": {
    "typecheck": "tsgo -p . --noEmit"
  }
}
```

## tsconfig.json (base)

```json:tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/strictest/tsconfig.json",
  "compilerOptions": {
    // Ignore Linter
    "noImplicitReturns": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": false,

    // Module Resolution
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,

    // TypeChecking
    "exactOptionalPropertyTypes": false,
    "allowJs": true,

    // transpile
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "target": "es2024",
    "lib": ["dom", "dom.iterable", "esnext"],
  },
  "include": ["src"]
}
```

補足: コメントはそのまま残してほしい

## tsconfig.json (with react)

```json:tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve"
  }
}
```

## tsconfig.json (workspace 時対応)

パッケージごとに composite を有効にして配置

```json:/apps/frontend/tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/strictest/tsconfig.json",
  "composite": true,
  "compilerOptions": {
    // ...
  },
  "include": ["src"]
}

```

ワークスペースルートに project references を置く。linter 等が要求する tsconfig.json はこのファイルを参照させる。

```json:tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "references": [
    {
      "path": "./apps/frontend/tsconfig.json"
    },
    {
      "path": "./apps/backend/tsconfig.json"
    }
  ]
}
```

## VSCode

```json:.vscode/settings.json
{
  "js/ts.tsdk.path": "node_modules/typescript/lib",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true,
  "js/ts.experimental.useTsgo": true,
  "js/ts.preferences.importModuleSpecifier": "relative"
}
```

## Zed

Zed では vtsls を TypeScript の language server として使用する（typescript-language-server, tsgo は無効化）。

language_servers の設定は oxc.md の Zed セクションに統合されている。
