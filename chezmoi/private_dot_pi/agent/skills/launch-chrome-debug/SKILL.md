---
name: launch-chrome-debug
description: Launch Chrome with remote debugging port and connect agent_browser with --auto-connect. Use when you need to reuse the user's existing browser profile (cookies, logins, extensions) for authenticated browsing automation.
disable-model-invocation: false
user-invocable: true
---

Launch a real Chrome instance with the user's profile and remote debugging enabled, then connect agent_browser to it via `--auto-connect`. This bypasses bot detection on sites that block headless/automated browsers, and preserves existing login sessions.

## When to Use

- Authenticated browsing: accessing sites where the user is already logged in (e.g., financial tools, dashboards, email)
- Bot-detection bypass: sites that return 403/Forbidden or blank pages with headless automation
- Extension-dependent workflows: sites that require the user's Chrome extensions

**Not needed** for public pages without auth or anti-bot protection — use plain `agent_browser open <url>` instead.

## Architecture

```
agent_browser --auto-connect → Chrome (--remote-debugging-port=N)
                                   │
                                   ├── user-data-dir (copied to temp, non-default location)
                                   │     └── Default/ (user's profile)
                                   │
                                   └── DISPLAY (Xvfb if headless Linux)
```

## Prerequisites Check

Run this detection script **before** launching:

```bash
# 1. Detect OS
case "$(uname -s)" in
  Linux)   OS=linux ;;
  Darwin)  OS=macos ;;
  *)       echo "Unsupported OS"; exit 1 ;;
esac

# 2. Find Chrome binary
for bin in google-chrome-stable google-chrome chromium chromium-browser \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  if command -v "$bin" >/dev/null 2>&1 || [ -x "$bin" ]; then
    CHROME="$bin"
    break
  fi
done
[ -z "$CHROME" ] && echo "Chrome not found" && exit 1

# 3. User data directory (OS-specific)
if [ "$OS" = linux ]; then
  USER_DATA_DIR="$HOME/.config/google-chrome"
elif [ "$OS" = macos ]; then
  USER_DATA_DIR="$HOME/Library/Application Support/Google/Chrome"
fi

# 4. Check display availability
if [ "$OS" = linux ] && [ -z "$DISPLAY" ]; then
  NEED_XVFB=true
  command -v Xvfb >/dev/null 2>&1 || { echo "Xvfb required but not found"; exit 1; }
else
  NEED_XVFB=false
fi
```

## Step 1: Prepare Temp Profile Directory

Chrome **refuses** `--remote-debugging-port` when `--user-data-dir` points to the default location (security measure). Copy the profile to a temp directory:

```bash
TEMP_PROFILE="/tmp/chrome-debug-profile"
rm -rf "$TEMP_PROFILE"
mkdir -p "$TEMP_PROFILE"
cp -r "$USER_DATA_DIR/Default" "$TEMP_PROFILE/Default"
```

> On macOS, `USER_DATA_DIR` includes spaces — use quotes.

## Step 2: Start Xvfb (headless Linux only)

Skip this step if `$DISPLAY` is set or on macOS.

```bash
Xvfb :99 -screen 0 1920x1080x24 &
XVFB_PID=$!
sleep 1
export DISPLAY=:99
```

## Step 3: Launch Chrome with Remote Debugging

```bash
"$CHROME" \
  --remote-debugging-port=9222 \
  --user-data-dir="$TEMP_PROFILE" \
  --profile-directory=Default \
  --no-first-run \
  --no-default-browser-check \
  > /tmp/chrome-debug.log 2>&1 &
CHROME_PID=$!
```

Wait for the debug port to become available:

```bash
for i in $(seq 1 10); do
  if curl -s http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo "Chrome debug port ready"
    break
  fi
  sleep 1
done
```

## Step 4: Connect agent_browser

Use `--auto-connect` with `sessionMode: "fresh"`:

```json
{
  "args": ["--auto-connect", "open", "<target-url>"],
  "sessionMode": "fresh"
}
```

> **Important**: `--auto-connect` must be on the **first** `agent_browser` call for this session. All subsequent calls in the same session automatically follow the connected browser.

## Step 5: Teardown (when done)

```bash
kill "$CHROME_PID" 2>/dev/null
[ -n "$XVFB_PID" ] && kill "$XVFB_PID" 2>/dev/null
rm -rf "$TEMP_PROFILE"
```

Do NOT skip teardown — leaving Chrome running on port 9222 blocks future launches.

## All-in-One Script

For convenience, the agent may run this combined script:

```bash
#!/bin/bash
set -euo pipefail

# --- detect ---
case "$(uname -s)" in
  Linux)   OS=linux ;;
  Darwin)  OS=macos ;;
  *)       echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

for bin in google-chrome-stable google-chrome chromium chromium-browser \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  if command -v "$bin" >/dev/null 2>&1 || [ -x "$bin" ]; then
    CHROME="$bin"; break
  fi
done

if [ "$OS" = linux ]; then
  USER_DATA_DIR="$HOME/.config/google-chrome"
elif [ "$OS" = macos ]; then
  USER_DATA_DIR="$HOME/Library/Application Support/Google/Chrome"
fi

# --- prepare profile ---
TEMP_PROFILE="/tmp/chrome-debug-profile"
rm -rf "$TEMP_PROFILE"
mkdir -p "$TEMP_PROFILE"
cp -r "$USER_DATA_DIR/Default" "$TEMP_PROFILE/Default"

# --- Xvfb if headless linux ---
if [ "$OS" = linux ] && [ -z "${DISPLAY:-}" ]; then
  Xvfb :99 -screen 0 1920x1080x24 &
  XVFB_PID=$!
  sleep 1
  export DISPLAY=:99
fi

# --- launch Chrome ---
"$CHROME" \
  --remote-debugging-port=9222 \
  --user-data-dir="$TEMP_PROFILE" \
  --profile-directory=Default \
  --no-first-run \
  --no-default-browser-check \
  > /tmp/chrome-debug.log 2>&1 &
CHROME_PID=$!

# --- wait for ready ---
for i in $(seq 1 10); do
  if curl -s http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo "READY port=9222 chrome_pid=$CHROME_PID"
    exit 0
  fi
  sleep 1
done

echo "TIMEOUT" >&2
exit 1
```

Save as `/tmp/launch-chrome-debug.sh`, run with `bash /tmp/launch-chrome-debug.sh`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Missing X server or $DISPLAY" | Headless Linux without Xvfb | Start Xvfb (Step 2) |
| "requires a non-default data directory" | `--user-data-dir` points to default location | Copy profile to temp (Step 1) |
| `--auto-connect` fails to connect | Chrome not listening or wrong port | Check `curl http://127.0.0.1:9222/json/version` |
| "Forbidden" or blank page after connect | Site blocks headless detection | Already solved — this is real Chrome, not headless |
| Port 9222 already in use | Previous Chrome session not cleaned up | `pkill -f google-chrome` and retry |
| Chrome dies immediately | Profile corrupted or disk full | Check `/tmp/chrome-debug.log` |
