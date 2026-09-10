---
name: browser-ops
description: Operate websites with the agent-browser CLI using one shared agent-only persistent profile. Use for browser navigation, interaction, screenshots, and authenticated web workflows, including user-assisted login and headed fallback when headless is blocked.
---

# Browser operations

## Browser and profile contract

- Use the `agent-browser` CLI, not the removed `pi-agent-browser-native` wrapper or Playwright CLI. Load `agent-browser skills get core` for the installed version's command guide; use command-specific `--help` when needed.
- Always launch with the same persistent directory: `$HOME/.config/agent-browser/profiles/shared`. Use `--session browser-ops` on every browser command. A session name identifies the daemon; it does not replace `--profile` persistence.
- Never use the user's personal Chrome profile, copy it, create per-site profiles, or use auto-connect to an arbitrary browser. Do not export/import state files as the normal login workflow.
- One agent owns this shared browser at a time. Coordinate with other agents before using it; do not navigate, close, or change modes while another agent or the user is operating it. Different session names do not make concurrent use of one profile safe.
- Keep the profile outside Git and chezmoi source state, with directory permissions `700`. It contains credentials equivalent to login tokens. Do not read or print its cookies, databases, or storage contents.

## Launch and mode selection

Use headless by default. Use headed only for interactive user login or when an observed headless limitation prevents the requested operation. A generic timeout or login redirect alone is not proof of bot blocking.

Queue browser launches through `pueue` (no shell backgrounding). Replace `<url>` with the requested URL:

```sh
install -d -m 700 "$HOME/.config/agent-browser/profiles/shared"
pueue add -- agent-browser --session browser-ops \
  --profile "$HOME/.config/agent-browser/profiles/shared" \
  --headed false open '<url>'
```

Check the returned task ID with `pueue status` and `pueue log <task-id>` before issuing browser actions. Use bounded tool timeouts. Queue acceptance is not launch success. `--headed false` explicitly selects headless; there is no `--headless` flag.

Before switching modes, close the owned session with `agent-browser --session browser-ops close`, then queue a new launch with the **same profile and session**. Use `--headed` instead of `--headed false` for a visible window. Flags do not change the mode of a browser already running.

Closing a window may leave Chrome running. If a profile lock remains, inspect the owning session/process and coordinate its shutdown. Never delete `SingletonLock`, kill unrelated Chrome processes, or copy a live profile to work around a lock.

## Login and fallback

1. Open the requested site headlessly and inspect the result. If already authenticated, continue.
2. If login is required, close the owned session and reopen the login page headed with the same profile. Ask the user to confirm the window is visible and complete login, including passwords, passkeys, and MFA, directly in the browser.
3. Return control and wait for the user's completion message. Do not ask for credentials in chat, inspect password fields, or take snapshots/screenshots during credential entry. If the window is not visible, resolve that handoff with the user rather than claiming login is ready.
4. After the user confirms completion, verify authentication using a minimal signal such as a logout control or authenticated navigation; avoid collecting unrelated account/financial data. Do not log out: closing the browser preserves the profile.
5. Close and reopen headlessly with the same profile, then verify authentication again. If the user already closed the window, still ensure the owning browser process has exited before relaunching.
6. If headless receives a denial such as `Forbidden` or an automation challenge, reopen headed with the same profile to check whether the operation works there. Continue headed only when this resolves the limitation. Report that fallback; do not keep cycling modes on the same blocked site during the task.
7. If headed also fails, report the blocker or request user intervention; do not attribute every denial to headless or attempt to bypass access controls.

A headed-only site does not change the default for the next independent task. No additional login should be needed while the profile's session remains valid; sites can expire or revoke it.

## Interaction and cleanup

```sh
agent-browser --session browser-ops snapshot -i
agent-browser --session browser-ops click @e2
agent-browser --session browser-ops get url
agent-browser --session browser-ops screenshot /tmp/browser-ops.png
```

Use refs from a current snapshot, not the example ref. Refresh after navigation or page changes. Inspect only the content needed for the task; do not dump a financial dashboard to prove login. Check artifact existence before claiming a screenshot/download succeeded.

On completion, close the owned session with `agent-browser --session browser-ops close`, unless explicitly handing the open browser to the user. Keep the shared profile for future tasks. Never use `close --all` or clear the profile as routine cleanup.
