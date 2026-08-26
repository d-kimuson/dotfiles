# AGENTS.md (User Root)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve the existing language; do not translate them.

## Coding Style

- Maintain separation of concerns.
- Separate state from logic.
- Prioritize readability and maintainability.
- Follow t-wada-style TDD: implement while continuously verifying behavior with type checking and tests.
- Define contract layers (APIs/types) rigorously using ADTs, and keep implementation layers regenerable.
- Rules that can be checked statically should be expressed with the environment’s linter or ast-grep, not in prompts.
- Avoid "Not Invented Here" syndrome; use appropriate libraries.

## Responsibility Boundaries and Autonomy

- The user defines the goal; the Agent owns the process and execution path to achieve it. This boundary is non-negotiable.
- When achieving the goal proves difficult and the goal itself needs to change, ask the user for a decision.
- When the goal is clear, do not ask the user about the process step by step. Plan the best path to achieve the goal while maintaining high code quality, and proceed autonomously without seeking approval.
- **Process Guidelines compliance**: The process is delegated to the Agent, but the "Process Guidelines" below encode proven practices that consistently produce effective output. Maximize adherence to these guidelines — treat them as the default playbook. Within that compliance envelope, choose whatever approach works best. The guidelines are a means to high-quality results, not a constraint.

## Process Guidelines 

### Progressive Disclosure

- AGENTS.md assumes progressive disclosure: it contains only the minimum information needed, while task-specific knowledge and guidelines live elsewhere.
- Select and load the necessary skills as needed for each task.

### SubAgent Delegation

- Use SubAgents to stay focused on the essential task. The Agent’s (your) context is a finite resource, so it is important to balance delegation and direct execution effectively.
- Delegate to SubAgents:
  - Yak-shaving work that is necessary to complete the task but falls outside the core request.
  - Work that benefits from an independent perspective, such as review or advice.
- Keep with the Agent; do not delegate:
  - The core substance of the request. Delegating work beyond ancillary tasks leaks context that the Agent must retain, so it is equally important not to delegate critical work.
  - Management and coordination of the overall task.
- In short, delegate ancillary work appropriately while remaining focused on the main line of work. You are responsible for producing an output that satisfies the requested scope.
- Anti-patterns:
  - Performing ancillary work yourself rather than delegating it.
  - Delegating core work for reasons outside these criteria, such as because it seems easy.
  - Stopping work while the task remains incomplete.

## CLI Tools

### pueue: Long-running Tasks and Development Servers

- Do not start long-running processes such as development servers, watchers, or daemons directly from the CLI; use **`pueue`** instead.
- Start them with `pueue add -- <command>`, and use `pueue status` / `pueue log` / `pueue follow` / `pueue kill` / `pueue remove` to check status or manage them.

### Timeout Discipline for Long-running Commands

- Whenever you run a command that may take a while (including `pueue wait` / `pueue follow`), estimate how long it should take and **always pass an explicit `timeout` (in seconds) to the bash tool with margin**. Example: a lint that normally finishes in ~1 minute → `timeout: 90`.
- For very long tasks, do not settle into a long wait up front: wait ~1 minute, check progress (`pueue status` / `pueue log`), confirm the task is actually advancing, and only then start a longer wait with an explicit timeout.
- Never wait 5+ minutes without an intermediate status check.

### agent-browser: Browsing and Login Policy

1. **Use headless by default.** `{ "args": ["open", "<url>"] }`. Do not automate public search-engine forms (CAPTCHA); prefer `web_search` / `agent_browser_web_search` or direct URLs.
2. **Login-required sites: use the saved-state workflow.** The state file is always `~/.config/pi-agent-browser-native/agent-default-state.json` (explicit fixed path; `~/.agent-browser/` is blocked by policy, and the file contains auth cookies → keep `chmod 600`).
   - Launch with existing state: `{ "args": ["--state", "~/.config/pi-agent-browser-native/agent-default-state.json", "open", "<url>"], "sessionMode": "fresh" }`, or `{ "args": ["state", "load", "~/.config/pi-agent-browser-native/agent-default-state.json"] }` on an open session. Save state with `{ "args": ["state", "save", "~/.config/pi-agent-browser-native/agent-default-state.json"] }`.
   - If the target service's login has expired (redirect to a login page), log in interactively and re-save: `{ "args": ["--headed", "open", "<login-url>"], "sessionMode": "fresh" }` → user logs in manually (incl. 2FA) → `state save ~/.config/pi-agent-browser-native/agent-default-state.json`.
   - **Known limitation:** Google/Gmail rejects sessions in CDP-launched browsers — both interactive login ("this browser or app may not be secure") and restored-cookie sessions (account chooser shows logged-out → signin/rejected), even with `--executable-path` real Chrome or `--args --disable-blink-features=AutomationControlled`. The saved-state workflow works for other sites.
3. **Last resort: manually-launched browser + CDP attach** (works for Google; use when state-based login cannot complete).
   - Launch real Chrome from bash **without automation flags** (quote the path; use `pueue`): `exec '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --remote-debugging-port=9223 --user-data-dir=/tmp/chrome-state-profile --no-first-run --no-default-browser-check`.
   - Wait for CDP with a bounded timeout (poll `curl http://127.0.0.1:9223/json/version`), then connect: `{ "args": ["connect", "9223"] }` → verify with `get url` → interact.
   - **Keep the attached browser alive during work** — `close` terminates it and the login session is not restored on relaunch (device-bound session).
