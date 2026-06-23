# Backend Coding Guideline

## Architecture Goals

The backend is optimized for type verification, explicit data flow, and low ceremony.

- Use ADTs and functional-programming-friendly design to maximize compile-time verification.
- Prefer transaction scripts over excessive layers.
- Keep service functions pure.
- Use repositories and immutable models only when they add real value.
- Use Drizzle models directly by default.

## Directory Shape

```text
src/server/
  app.ts
  routes.ts
  middlewares/
  db/
  domain/
    <domain>/
      routes.ts
      workflows/
      services/
      repositories/
      models/
```

- `app.ts`: Hono app/context contracts.
- `routes.ts`: top-level route composition.
- `middlewares/`: request boundary concerns such as environment/DB context setup.
- `db/`: Drizzle schema, DB factories, and DB type contracts.

## Request Flow

Default flow:

```text
routes -> workflows -> services -> optional repositories/models -> drizzle
```

- `routes`: HTTP boundary adapters. Parse/validate inputs, read Hono context, call one workflow, and map workflow results to HTTP responses.
- `workflows`: transaction scripts. Orchestrate DB reads/writes, coordinate pure services, and return ADT-style results.
- `services`: pure business rules. No DB, network, clock, random, or environment access.
- `repositories`: optional persistence helpers. Use only when reuse or query complexity justifies a named abstraction.
- `models`: optional domain/API conversion contracts. Use when conversion, validation, or immutable domain shape is valuable.

Do not create layers just to satisfy a diagram. A straightforward workflow may call Drizzle directly.

## Data and Result Contracts

- Drizzle schema is the DB contract.
- API responses must be serializable plain data.
- Use explicit conversion functions at boundaries, especially in `models/`.
- Prefer `readonly` and narrow union types for domain data.
- Use ADT-style results for expected outcomes instead of exceptions.

Example:

```ts
type UpdateUserResult = { status: 'updated'; user: UserResponse } | { status: 'not_found' };
```

Routes should map these results exhaustively to responses.

## Testing

- Pure services/models should be tested without DB setup.
- Workflow and repository tests are DB-required by directory convention:
  - `src/server/**/workflows/**/*.test.{ts,tsx}`
  - `src/server/**/repositories/**/*.test.{ts,tsx}`
- Do not use `.db.test.ts` naming.
- DB-required tests use setup under `configs/vitest/`.
- DB-required tests should use `:memory:` node:sqlite instances so tests remain fast and realistic.
- Keep `test.isolate: false` unless a specific test proves it needs isolation.

## Dependency Strategy

Do not use a generic DI helper/framework in server code.

Preferred patterns:

- Pure functions imported directly.
- Workflows accepting explicit inputs such as `{ db, user }`.
- Small factories such as `createUserRepository(db)` when useful.

Avoid global mutable request state. Request-scoped values should come from Hono context or explicit function parameters.
