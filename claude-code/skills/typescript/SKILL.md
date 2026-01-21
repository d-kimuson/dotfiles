---
name: typescript
description: Must always be enabled when writing/reviewing TypeScript code.
---

<philosophy>
## Core Philosophy: Type-Level Verification

LLM-generated code faces inherent challenges with E2E testing and runtime verification. Compensate by maximizing compile-time verification through:

- Algebraic data types (discriminated unions, exhaustive pattern matching)
- Strict type constraints that make invalid states unrepresentable
- Type-level proofs over runtime assertions

**Goal**: If it type-checks, it works. Shift as many bugs as possible from runtime to compile-time.
</philosophy>

<type_assertions>
## Type Assertions and User-Defined Type Guards: Banned by Default

### Rule: `as` Type Assertions are Prohibited

**Rationale**: Type assertions bypass TypeScript's type system and introduce type unsoundness. They are frequently misused to silence legitimate type errors.

**Policy**:
- ❌ **Never use** `as` to resolve type errors
- ❌ **Never use** `as any` or `as unknown as X`
- ⚠️ **Rare exceptions**: Compiler limitations (e.g., specific generic inference bugs)
  - If you encounter such cases, **leave the type error unresolved**
  - Escalate to user with explanation: "Type error at `path/to/file.ts:123` - requires manual review for potential `as` usage"

### Rule: `is` User-Defined Type Guards are Prohibited

**Rationale**: User-defined type guards (`x is T`) are essentially type assertions in disguise. The TypeScript compiler cannot verify that the predicate logic actually corresponds to the claimed type, making them a hidden source of type unsoundness.

**Policy**:
- ❌ **Never create** functions with `is` return type (e.g., `(x: unknown): x is User`)
- ❌ **Never use** user-defined type guards to narrow types
- ⚠️ **Rare exceptions**: When matching existing codebase patterns or interfacing with libraries that require them
  - If you encounter such cases, **escalate to user for approval**

**Example of the problem**:
```typescript
// ❌ Dangerous: Compiler trusts this blindly
const isUser = (x: unknown): x is User => {
  return typeof x === 'object' && x !== null && 'name' in x
  // Missing: 'email' check, but compiler believes it's a User
}
```

### Why you cannot judge appropriately

As an LLM, you lack the contextual understanding to determine if a type assertion (`as`) or user-defined type guard (`is`) is truly necessary vs. masking a real type error. When in doubt, preserve type safety.

### Alternative: Fix the Root Cause

Instead of `as` or `is`, address the underlying type issue:
- Refine function signatures
- Use built-in type guards (`if (typeof x === 'string')`, `if ('key' in obj)`)
- Employ discriminated unions with literal type checks
- Add generic constraints
- Use schema validation libraries (valibot, zod) that provide type-safe parsing
</type_assertions>

<strict_typing>
## Strict Typing Patterns

### Prefer `as const satisfies` Over Loose Annotations

**Problem with loose typing**:
```typescript
const config: Config = {
  mode: 'development',  // Type widened to string
  port: 3000
}
// config.mode is string, not 'development' | 'production'
```

**Solution - strict typing with `as const satisfies`**:
```typescript
const config = {
  mode: 'development',
  port: 3000
} as const satisfies Config
// config.mode is exactly 'development' (literal type preserved)
```

**Benefits**:
- Preserves literal types
- Catches typos at definition site
- Enables exhaustive checking in consumers
- No type widening

**Application**:
- Configuration objects
- Constant lookup tables
- Route definitions
- Action type constants

### Avoid Explicit Type Annotations When Inference Suffices

```typescript
// ❌ Redundant annotation
const result: number = calculateTotal(items)

// ✅ Let TypeScript infer
const result = calculateTotal(items)
```

Use annotations when:
- Constraining function parameters
- Enforcing strict object shapes (`as const satisfies`)
- Documenting public API boundaries
</strict_typing>

<external_data>
## External Data: Never Trust, Always Validate

### Rule: No `any` for External Data

**Sources requiring validation**:
- API responses (fetch, axios, etc.)
- `JSON.parse()` results
- LocalStorage/SessionStorage reads
- FormData / user input
- Environment variables
- File system reads

### Strategy 1: Type-Safe API Clients (Preferred)

**Check for generated type definitions first**:
- **Hono**: `hono/client` with type inference
- **orval**: OpenAPI-generated types and hooks
- **tRPC**: End-to-end type safety
- **GraphQL Code Generator**: Typed queries

**Example (Hono client)**:
```typescript
import { hc } from 'hono/client'
import type { AppType } from './server'

const client = hc<AppType>('/api')
const response = await client.users.$get()
// response is fully typed from server definition
```

**Action**: Review existing codebase for established patterns. Most projects already have type-safe API layers.

### Strategy 2: Runtime Validation Libraries

When type generation is unavailable, use schema validation:

**Preference order**:
1. **Existing project dependency** (check `package.json`)
2. **valibot** (lightweight, install if needed: `pnpm add valibot`)
3. **zod** (popular, larger bundle)

**Example (valibot)**:
```typescript
import * as v from 'valibot'

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  role: v.union([v.literal('admin'), v.literal('user')])
})

// Parse and validate
const response = await fetch('/api/user')
const data = await response.json()
const user = v.parse(UserSchema, data)  // Throws if invalid
// user is now typed as { id: number, name: string, role: 'admin' | 'user' }
```

**Example (JSON.parse)**:
```typescript
// ❌ Unsafe
const data = JSON.parse(localStorage.getItem('config')!)

// ✅ Validated
const raw = localStorage.getItem('config')
if (raw) {
  const data = v.parse(ConfigSchema, JSON.parse(raw))
}
```

### Never Skip Validation

Even if "you know" the shape, external data can change:
- API contracts evolve
- Users manipulate localStorage
- Third-party services have bugs

**Type safety = static types + runtime validation**
</external_data>

<best_practices>
## General Best Practices

### Prefer Arrow Functions Over Function Declarations

**Rule**: Use arrow functions (`=>`) instead of `function` keyword for consistency and lexical scoping benefits.

**Rationale**:
- Consistent lexical `this` binding (no context confusion)
- More concise syntax
- Better integration with modern TypeScript patterns
- Prevents accidental hoisting-related bugs

```typescript
// ❌ Function declaration
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ✅ Arrow function
const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ✅ Concise form (single expression)
const calculateTotal = (items: Item[]): number =>
  items.reduce((sum, item) => sum + item.price, 0)
```

**Exception**: When hoisting is genuinely required (rare), document the reason.

### Discriminated Unions for State

```typescript
type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

const render = (state: LoadingState<User>) => {
  switch (state.status) {
    case 'idle':
      return 'Not started'
    case 'loading':
      return 'Loading...'
    case 'success':
      return state.data.name  // data is available
    case 'error':
      return state.error.message  // error is available
  }
}
```

**Benefits**: Impossible to access `data` when status is `'error'`.

### Exhaustiveness Checking

```typescript
const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${x}`)
}

switch (state.status) {
  case 'idle':
  case 'loading':
  case 'success':
  case 'error':
    return
  default:
    assertNever(state)  // Compile error if cases are missing
}
```

### Avoid Optional Properties for State

```typescript
// ❌ Ambiguous state
type User = {
  data?: UserData
  error?: Error
}
// What if both are defined? Neither?

// ✅ Explicit state
type User =
  | { status: 'success'; data: UserData }
  | { status: 'error'; error: Error }
```

### Use `unknown` Over `any` for Truly Unknown Types

```typescript
// ❌ Disables all type checking
const process = (data: any) => {
  return data.foo.bar  // No errors, runtime explosion
}

// ✅ Forces validation
const process = (data: unknown) => {
  if (typeof data === 'object' && data !== null && 'foo' in data) {
    // Narrow the type before use
  }
}
```

### Readonly by Default

```typescript
// Prevent accidental mutations
type Config = {
  readonly apiUrl: string
  readonly timeout: number
}

// For arrays
const items = ['a', 'b'] as const
```

### Avoid Type-Level Gymnastics

If type definitions become incomprehensible, simplify the design:
- Complex conditional types often indicate over-abstraction
- Prefer explicit discriminated unions over heavily generic types
- Maintainability > cleverness
</best_practices>

<error_handling>
## When Type Errors Cannot Be Resolved

If you encounter legitimate type errors you cannot fix without `as`:

1. **Leave the error in place**
2. **Document the issue**:
   ```typescript
   // TODO: Type error at line X - potential TypeScript limitation
   // Requires manual review before using type assertion
   const result = someComplexOperation()  // Type error here
   ```
3. **Notify the user**: "Type error remains at `src/module.ts:45` - escalated for review"

**Do not**:
- Silently add `as` assertions
- Use `any` to bypass the error
- Restructure correct code to satisfy incorrect types
</error_handling>
