# AGENTS.md (User Root)

## Guidelines

### Use gemini CLI for Web Research

For web research, using gemini CLI is recommended. Only fall back to WebSearch tool when unavailable in the environment.

```bash
$ npx https://github.com/google-gemini/gemini-cli -p '/web-research Tell me about shadcn-ui.'
shadcn-ui is a collection of reusable UI components. It is designed to be used with modern technology stacks such as React, Next.js, and Tailwind CSS.
...

$ npx https://github.com/google-gemini/gemini-cli -p '/web-research TypeScript type check error "error TS2305: ...". Search for issues or cases with the same or similar problems. If there are cases that have been fixed, include their solutions.'
The TypeScript `error TS2305: Module has no exported member '...'` error occurs when the module you are trying to import does not export the specified member.
```

### Access GitHub Resources with GitHub CLI

- Do not use WebFetch for GitHub URLs provided by users, as they often require authentication.
- Use gh and git commands instead:
  - Check file contents:
    - `curl "$(gh api 'repos/<owner>/<repo>/contents/path/to/file.txt?ref=<ref>' | jq -r '.download_url')"`
  - Check PR contents:
    - `gh pr view <pr_number> --json title,body,headRefName,commits`
  - Check commit diff:
    - `git fetch && git show <commit_hash>`

### Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve existing language (do not translate)
