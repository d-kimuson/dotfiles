---
name: browser-ops
description: Operate websites with the agent-browser CLI. Use for browser navigation, interaction, screenshots, and authenticated web workflows, including user-assisted login and headed fallback when headless is blocked.
---

# Browser operations

Use the `agent-browser` CLI directly for every step. Load `agent-browser skills get core` for the installed version's command guide; use command-specific `--help` when needed.

## Choose the browser

Pick one of two modes before the first command, and keep it for the task.

- **Ephemeral (default).** For anything that needs no login: local pages, public sites, screenshots, QA of an app under development. Omit `--profile`, so the browser uses a throwaway profile, and use a session name of your own, such as `browser-ops-qa-7f3a` (a purpose plus a few random characters). Agents running in parallel each get their own session and never collide.
- **Shared login profile.** Only when the task needs a site login. Use `--session browser-ops --profile "$HOME/.config/agent-browser/profiles/shared"` on every command. This profile holds the logins the user completed earlier, and only one browser can hold it at a time.

Write the session name and flags literally in each command. Do not put the command in a shell variable (`AB="agent-browser ..."; $AB open`): zsh does not split it into words.

Never use the user's personal Chrome profile, copy it, or use auto-connect to an arbitrary browser. Do not export or import state files as the normal login workflow.

## Launch

Use headless by default. Use headed only for interactive user login or when an observed headless limitation prevents the requested operation. A generic timeout or login redirect alone is not proof of bot blocking.

```sh
agent-browser --session browser-ops-qa-7f3a --headed false open '<url>'
```

With the shared profile, create its directory first and pass it:

```sh
install -d -m 700 "$HOME/.config/agent-browser/profiles/shared"
agent-browser --session browser-ops \
  --profile "$HOME/.config/agent-browser/profiles/shared" \
  --headed false open '<url>'
```

`open` starts the session daemon when needed and returns once the page loads; the browser stays running for later commands in the same session. Confirm the result from its output (or `get url`) before issuing browser actions, and use bounded tool timeouts. `--headed false` selects headless; there is no `--headless` flag. Do not wrap the CLI in a task queue or shell backgrounding.

Flags do not change the mode of a browser already running. To switch between headless and headed, `close` the session, then launch again with the same session and profile.

If a command fails with an unwritable socket directory (`~/.agent-browser`) or another unexpected launch error, run `agent-browser doctor`. A sandboxed shell may need to run agent-browser outside the sandbox.

## When the browser does not respond

- **The shared profile is in use.** A launch that fails with `SingletonLock: File exists` or `Chrome exited early (exit code: 21)` means another agent or the user holds the shared profile. Do not retry in a loop, delete `SingletonLock`, kill Chrome processes, or copy the profile. If the task can be done without login, switch to an ephemeral session. Otherwise, stop and tell the user which task holds it.
- **The daemon stops answering.** Errors such as `Resource temporarily unavailable (os error 35)`, `EOF while parsing`, or a command that runs past 30 seconds mean the session's daemon is stuck. Run `close` for the session once and reopen the page; do not repeat the stuck command. If it gets stuck again on the same page, report it instead of cycling.

## Login and fallback

These steps use the shared login profile.

1. Open the requested site headlessly and inspect the result. If already authenticated, continue.
2. If login is required, close the session and reopen the login page headed with the same profile. Ask the user to confirm the window is visible and complete login, including passwords, passkeys, and MFA, directly in the browser.
3. Return control and wait for the user's completion message. Do not ask for credentials in chat, inspect password fields, or take snapshots/screenshots during credential entry. If the window is not visible, resolve that handoff with the user rather than claiming login is ready.
4. After the user confirms completion, verify authentication using a minimal signal such as a logout control or authenticated navigation; avoid collecting unrelated account/financial data. Do not log out: closing the browser preserves the profile.
5. Close and reopen headlessly with the same profile, then verify authentication again.
6. If headless receives a denial such as `Forbidden` or an automation challenge, reopen headed with the same profile to check whether the operation works there. Continue headed only when this resolves the limitation. Report that fallback; do not keep cycling modes on the same blocked site during the task.
7. If headed also fails, report the blocker or request user intervention; do not attribute every denial to headless or attempt to bypass access controls.

Keep the shared profile outside Git and chezmoi source state, with directory permissions `700`. It contains credentials equivalent to login tokens. Do not read or print its cookies, databases, or storage contents.

## Interaction

```sh
agent-browser --session browser-ops-qa-7f3a snapshot -i
agent-browser --session browser-ops-qa-7f3a click @e2
agent-browser --session browser-ops-qa-7f3a set viewport 1280 800
agent-browser --session browser-ops-qa-7f3a eval '(() => { const title = document.title; return title; })()'
```

- Use refs from a current snapshot, not the example ref. Take a new snapshot after navigation or any page change; an old ref fails with `Unknown ref`.
- `eval` runs in the page's global scope, so a top-level `const` stays declared for the next `eval`. Wrap the code in an IIFE as above.
- Browser settings such as the viewport go under `set` (`set viewport <w> <h>`); there is no `viewport` or `resize` command. Check `--help` before using a command you have not used in this session.
- Inspect only the content needed for the task; do not dump a financial dashboard to prove login. Check the file exists before claiming a screenshot or download succeeded.

## Cleanup

On completion, `close` your session, unless explicitly handing the open browser to the user. Keep the shared profile for future tasks. Never use `close --all` or clear the profile as routine cleanup.
