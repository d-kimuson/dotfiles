# Configure providers

このマシンで使える provider を確かめ、`state/providers.json` に書く playbook。`models list` はこのファイルで候補を絞る。

## 設計メモ

- `state/providers.json` はマシンごとに違うローカルファイルで、コミットしない (`.agents/state/` を `.gitignore` 済み)。`agent-core verify` は必須にしないが、あれば書式を検証する
- provider は `claude-code | opencode-go | openai-codex | command-code | antigravity`。候補の provider は `agent-core/providers.ts` の `providerOfCandidate` が決める (runtime が `claude-code` / `command-code` / `antigravity` ならそのまま、`pi` なら model の接頭辞 `opencode-go/` → `opencode-go`、`openai-codex/` → `openai-codex`)
- provider 名は pi の接頭辞に合わせた `openai-codex`。将来 OpenAI を API 直利用する provider を足すときに区別できるよう、`openai` は使わない
- 使えるかの判定は、各 CLI のログイン状態を読み取りだけで見る。`claude auth status` と、`~/.pi/agent/auth.json`、`~/.commandcode/auth.json` のキーの有無と OAuth の期限。agy は読める認証ファイルが見つからなかったため、推論を呼ばない `agy models` が一覧を返すかで見る (sandbox 内では localhost を listen できず失敗する)。実際に推論を呼んで確かめることはしない (課金と時間がかかる)
- pi は sandbox 内だと起動時に `~/.pi/agent` へ書こうとして EPERM になるため、`pi` コマンドではなく `auth.json` を読む
- 判定が不確かなときはユーザーに聞く。誤って使えない provider を書くと、SubAgent の起動に失敗する

本文: [PLAYBOOK.md](./PLAYBOOK.md)
