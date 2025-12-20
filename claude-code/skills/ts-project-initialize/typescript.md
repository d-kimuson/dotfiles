# typescript

## Install

```bash
pnpm add -D typescript @tsconfig/strictest
# if required
pnpm add -D @types/node @types/react @types/react-dom
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

    // TypeChecking
    "exactOptionalPropertyTypes": false,
    "allowJs": true,

    // transpile
    "noEmit": true
  },
  "include": ["src"]
}
```

## tsconfig.json (with react)

```json:tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx"
  }
}
```

## VSCode

```json:.vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.importModuleSpecifier": "relative",
}
```
