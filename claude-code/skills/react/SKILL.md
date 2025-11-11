---
name: react
description: React implementation guidelines - minimize useEffect, use FC types, prefer query clients over fetch
---

<role>
You are implementing React components following modern best practices. Your goal is to write clean, performant React code that avoids unnecessary Effects and follows established patterns.
</role>

<core_principles>
## Core Principles

### 1. Minimize useEffect Usage
**Think harder before adding useEffect.** Most scenarios have better alternatives:

<when_not_to_use_effect>
#### When NOT to Use useEffect

**Data transformation for rendering**:
- ❌ Don't: Use Effect to compute derived state
- ✅ Do: Calculate during render at top level
```tsx
// ❌ Bad: Cascading updates
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => {
  setFilteredItems(items.filter(item => item.active));
}, [items]);

// ✅ Good: Direct computation
const filteredItems = items.filter(item => item.active);
```

**Handling user events**:
- ❌ Don't: Use Effect to respond to user actions
- ✅ Do: Handle logic in event handlers
```tsx
// ❌ Bad: Lost interaction context
useEffect(() => {
  if (buttonClicked) {
    submitForm();
  }
}, [buttonClicked]);

// ✅ Good: Explicit intent
const handleSubmit = () => {
  submitForm();
};
```

**Caching expensive computations**:
- ❌ Don't: Store computed results in state via Effects
- ✅ Do: Use useMemo
```tsx
// ❌ Bad: Manual memoization
const [expensiveResult, setExpensiveResult] = useState<Result | null>(null);
useEffect(() => {
  setExpensiveResult(computeExpensiveValue(data));
}, [data]);

// ✅ Good: useMemo
const expensiveResult = useMemo(() => computeExpensiveValue(data), [data]);
```

**Resetting state on prop changes**:
- ❌ Don't: Use Effect to reset state
- ✅ Do: Use key prop to force remount
```tsx
// ❌ Bad: Manual synchronization
useEffect(() => {
  setLocalState(defaultValue);
}, [userId]);

// ✅ Good: Key-based reset
<Profile key={userId} userId={userId} />
```
</when_not_to_use_effect>

<legitimate_use_cases>
#### Legitimate useEffect Use Cases

**Only use Effects for**:
1. Synchronizing with external systems (browser APIs, third-party widgets)
2. Data fetching with proper cleanup (avoid race conditions)
3. Subscriptions (prefer useSyncExternalStore when possible)

**Pattern for data fetching** (if not using query client):
```tsx
useEffect(() => {
  let ignore = false;

  async function fetchData() {
    const result = await api.getData();
    if (!ignore) {
      setData(result);
    }
  }

  fetchData();
  return () => { ignore = true; }; // Cleanup to prevent race conditions
}, [dependency]);
```
</legitimate_use_cases>
</core_principles>

<component_definition>
### 2. Component Definition Style

**Always use FC type annotation**:

```tsx
import { FC, PropsWithChildren } from 'react';

// For components without children
type ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

// For components that accept children
type CardProps {
  title: string;
}

const Card: FC<PropsWithChildren<CardProps>> = ({ title, children }) => {
  return (
    <div>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
};
```

**Never use function declaration syntax**:
```tsx
// ❌ Bad: Avoid this style
function MyComponent(props: Props) {
  return <div />;
}
```
</component_definition>

<api_requests>
### 3. API Request Handling

**Never use fetch directly in components.** Always use the project's query client.

<detection_workflow>
#### Detection Workflow

1. **Check project dependencies** in package.json:
   - `@apollo/client` → Use Apollo Client hooks
   - `@tanstack/react-query` → Use Tanstack Query hooks
   - `swr` → Use SWR hooks

2. **Search for existing usage patterns**:
   - Look for `useQuery`, `useMutation`, `useSWR`, `useApolloClient` in codebase
   - Follow established patterns for consistency

3. **Apply appropriate client**:

<apollo_client>
**Apollo Client (GraphQL)**:
```tsx
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

const UserProfile: FC<{ userId: string }> = ({ userId }) => {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{data.user.name}</div>;
};

// Mutations
const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) {
      id
      name
    }
  }
`;

const EditForm: FC = () => {
  const [updateUser, { loading }] = useMutation(UPDATE_USER);

  const handleSubmit = async (values: FormValues) => {
    await updateUser({ variables: { id: values.id, name: values.name } });
  };

  return <form onSubmit={handleSubmit}>...</form>;
};
```
</apollo_client>

<tanstack_query>
**Tanstack Query (REST)**:
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const UserProfile: FC<{ userId: string }> = ({ userId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{data.name}</div>;
};

// Mutations with cache invalidation
const EditForm: FC = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.updateUser(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const handleSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return <form onSubmit={handleSubmit}>...</form>;
};
```
</tanstack_query>

<swr>
**SWR**:
```tsx
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

const UserProfile: FC<{ userId: string }> = ({ userId }) => {
  const { data, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher
  );

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{data.name}</div>;
};

// Mutations
const EditForm: FC = () => {
  const { trigger, isMutating } = useSWRMutation(
    '/api/users',
    updateUser
  );

  const handleSubmit = async (values: FormValues) => {
    await trigger(values);
  };

  return <form onSubmit={handleSubmit}>...</form>;
};
```
</swr>
</detection_workflow>

**Benefits of query clients**:
- Automatic caching and deduplication
- Loading/error state management
- Race condition handling
- Cache invalidation and refetching
- Optimistic updates support
</api_requests>
</core_principles>

<workflow>
## Implementation Workflow

1. **Before writing component**:
   - Identify data dependencies and state requirements
   - Think harder: Can state be derived instead of stored?
   - Plan event handlers before considering Effects

2. **During implementation**:
   - Define component with FC type annotation
   - Calculate derived values at top level
   - Use useMemo only for expensive computations
   - Handle user interactions in event handlers
   - Use query client hooks for API requests

3. **Effect review checklist**:
   - [ ] Is this synchronizing with an external system?
   - [ ] Could this be a calculated value instead?
   - [ ] Should this be in an event handler?
   - [ ] Am I using the right hook (useMemo, key prop)?
   - [ ] If data fetching, is query client available?

4. **If Effect is necessary**:
   - Document why Effect is required
   - Implement proper cleanup to prevent memory leaks
   - Handle race conditions for async operations
</workflow>

<anti_patterns>
## Anti-Patterns to Avoid

❌ **Chaining Effects**:
```tsx
// Bad: Effects triggering each other
useEffect(() => setB(a), [a]);
useEffect(() => setC(b), [b]);

// Good: Direct computation or single event handler
const b = computeB(a);
const c = computeC(b);
```

❌ **Effect-based initialization**:
```tsx
// Bad: One-time initialization in Effect
useEffect(() => {
  setData(expensiveInit());
}, []);

// Good: useState with initializer
const [data] = useState(() => expensiveInit());
```

❌ **Direct fetch calls**:
```tsx
// Bad: Manual fetch in component
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(setData);
}, []);

// Good: Use query client
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
```
</anti_patterns>
