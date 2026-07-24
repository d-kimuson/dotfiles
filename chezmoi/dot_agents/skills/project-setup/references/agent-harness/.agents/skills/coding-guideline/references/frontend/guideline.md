# Frontend Coding Guideline

## Architecture

Frontend code follows TanStack Start conventions and uses Container / Presentational Pattern for feature UI.

Directory outline:

```text
src/web/
  app/       # route-owned pages and colocated feature code
  apis/      # reusable concrete API query/mutation hooks by domain
  components/ui/
  lib/       # infrastructure such as API client, QueryClient, test helpers
  shared/    # cross-feature code with no owning page/route
```

Route files should be thin: compose page UI, read route params/search, and delegate behavior to colocated components/containers. Root-only layout/provider code belongs under `src/web/app/__root/**`. Code with no owning route, such as auth, may live under `shared/` when it is a real cross-cutting concern.

Component shape:

```text
PostList/
  index.tsx                 # presentation only
  useContainer.ts           # state, derived data, callbacks
  useContainer.test.ts
  services/
    formatPostDate.ts       # pure functions used by the container
    formatPostDate.test.ts
```

`index.tsx` maps container state/callbacks to JSX. Data decisions, event behavior, and state transitions belong in `useContainer.ts`. Pure transformations belong in `services/`.

## Libraries

Do not build local substitutes for solved problems. Prefer the installed library for each concern.

| Concern                     | Library / Pattern                              |
| --------------------------- | ---------------------------------------------- |
| Routing / app shell         | TanStack Start, TanStack Router                |
| API requests / server state | TanStack Query (`useSuspenseQuery` by default) |
| Global client state         | Jotai when shared client state is needed       |
| Collection/object utilities | es-toolkit                                     |
| Date handling               | date-fns                                       |
| Validation / parsing        | valibot                                        |
| Typed API client            | Hono client                                    |
| UI primitives               | shadcn/ui, Radix UI, Tailwind CSS              |
| Icons                       | lucide-react                                   |

API infrastructure belongs under `src/web/lib/api/`. Concrete hooks belong under `src/web/apis/<domain>/`, for example `postQueries.ts` and `postMutations.ts`. Component code should not call `fetch` or TanStack Query directly by default; expose domain hooks from `apis/**`.

## UI Implementation

- Use shadcn CLI to add UI primitives; do not hand-create files under `components/ui/`.
- Do not edit generated shadcn UI primitives unless the user explicitly requests component-level customization.
- Prefer usage-side composition, props, and `className` before changing shared UI primitives.
- Keep global styling in `src/web/styles.css`.
- Keep feature UI near its route until reuse is concrete.

## React Implementation

- Use function components with explicit `FC` typing where it matches project conventions.
- Minimize `useEffect`; use it only for synchronization with external systems.
- Keep derived values as render-time calculations or container-level derived state, not synced effect state.
- Keep event-driven logic in event handlers inside containers.
- Use Suspense-compatible query hooks for server state.
- Prefer ADT-style view states over multiple optional flags.

## Testing

- Do not write presentation/DOM tests for `index.tsx` by default.
- Test component logic in `useContainer.test.ts`.
- Test pure functions next to the service file as `<service>.test.ts`.
- `use*.test.{ts,tsx}` runs with happy-dom.
- Import `renderHook` from `src/web/lib/test/renderHook`, not from `@testing-library/react` directly.
- Do not mock TanStack Router hooks for location; use the shared `renderHook` helper with memory routing.
- The shared `renderHook` helper provides the common Router and provider tree.
- Keep provider trees minimal. Add providers to the helper only when they become common test infrastructure.
