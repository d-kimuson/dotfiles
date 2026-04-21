# QA Guideline (API Application)

## Scope

Behavioral correctness of the API.
Type checking, linting, and other code quality checks are out of scope (handled by gatecheck).

## Dev Server

- Start command: `{e.g. pnpm dev}`
- Port: `{e.g. http://localhost:3000}`
- Health check: `{e.g. curl -s http://localhost:3000/health | jq .}`

## curl-Based Verification

### Verification Flow

```bash
# 1. Health check
curl -s http://localhost:{port}/health | jq .

# 2. Test individual endpoints
curl -s -X GET http://localhost:{port}/api/{resource} \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {token}' | jq .

# 3. Test mutations
curl -s -X POST http://localhost:{port}/api/{resource} \
  -H 'Content-Type: application/json' \
  -d '{"key": "value"}' | jq .

# 4. Verify response status codes
curl -s -o /dev/null -w '%{http_code}' http://localhost:{port}/api/{resource}

# 5. Test error cases
curl -s -X GET http://localhost:{port}/api/{nonexistent} | jq .    # 404
curl -s -X POST http://localhost:{port}/api/{resource} \
  -d 'invalid json' | jq .                                         # 400
```

### Verification Checklist

- [ ] All affected endpoints return expected status codes
- [ ] Response body matches expected schema
- [ ] Error responses include meaningful error messages
- [ ] Authentication/authorization works correctly (if applicable)

## Automated Test Coverage

1. Identify existing tests related to the target code
2. Review test case coverage — pay special attention to error cases, boundary values, and semi-normal scenarios
3. If gaps are found, implement additional tests
4. Run all relevant tests and confirm they pass

## Exploratory Testing Notes

- {Project-specific notes: state reset method, auth flow, async wait points, etc.}
