---
name: configure-providers
description: `agent-core models list` が providers.json がないと失敗したとき、またはこのマシンで使えるモデル提供元が変わったときに使う
---

# Configure providers

このマシンで実際に使える provider を確かめ、`~/.agents/providers.json` に書く。書いた provider の候補だけが `models list` に出る。

provider は次の 5 つ。

| provider | 使える条件 |
| --- | --- |
| `claude-code` | `claude` がログイン済み |
| `command-code` | `command-code` (`cmd`) がログイン済み |
| `opencode-go` | `pi` が opencode-go にログイン済み |
| `openai-codex` | `pi` が openai-codex (ChatGPT) にログイン済み |
| `antigravity` | `agy` (Antigravity CLI) がログイン済み |

## 手順

1. Claude Code on the web (`CLAUDE_CODE_REMOTE=true`) なら `claude-code` だけを書き、3 へ進む。他の CLI は使えない。
2. 次を sandbox の外で実行して、使える provider を確かめる。読み取りだけで、秘密の値は表示しない。表示した 5 行の判定が根拠になる。

   ```bash
   claude auth status | grep loggedIn
   command-code whoami >/dev/null 2>&1 && echo "command-code ログイン済み" || echo "command-code 未ログイン"
   agy models 2>/dev/null | grep -q "^gemini-" && echo "antigravity ログイン済み" || echo "antigravity 未ログイン"
   node -e '
   const { readFileSync } = require("node:fs"), { homedir } = require("node:os"), { join } = require("node:path")
   const read = (p) => { try { return JSON.parse(readFileSync(join(homedir(), p), "utf8")) } catch { return {} } }
   const pi = read(".pi/agent/auth.json")
   for (const [provider, key] of [["opencode-go", "opencode-go"], ["openai-codex", "openai-codex"]]) {
     const entry = pi[key]
     console.log(provider, !entry ? "未ログイン" : entry.expires && entry.expires < Date.now() ? "期限切れ" : "ログイン済み")
   }
   '
   ```

   - `claude` は `loggedIn: true` なら使える。`command-code` は `whoami` が成功すれば使える (`~/.commandcode/auth.json` に `apiKey` があっても、`cmd status` が OK でも、認証が切れていることがある)。`antigravity` は `agy models` がモデルの一覧を返せば使える。`opencode-go` と `openai-codex` は pi の `auth.json` にエントリがあり、OAuth の期限が切れていなければ使える。
   - 期限切れ、CLI が見つからない、判定の出力が想定と違うなど、確かではないものは推測で決めず、ユーザーに使えるか聞く。
   - `auth.json` や `models-store.json` の中身を表示しない。キーの有無や期限だけを見る。
3. 使える provider を書く。

   ```bash
   cat > ~/.agents/providers.json <<'JSON'
   { "providers": ["claude-code", "openai-codex"] }
   JSON
   ```

   `providers.json` はマシン固有なのでコミットしない。
4. `~/.agents/scripts/agent-core.ts models list` を実行し、成功して、使える provider の候補だけが出ることを確かめる。候補がすべて外れた種類は「候補なし」と出る。それは正常で、その種類は親と同じモデルの SubAgent で動かす。
