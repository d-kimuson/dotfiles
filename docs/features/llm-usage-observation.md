# LLM subscription usage observation

## 目的

OpenCode Go、Codex、Z.ai GLM Coding Plan、Grok の subscription quota を定点観測し、Pi が記録する token usage とモデル単価から **API retail equivalent** と **quota equivalent** を比較する。

非公開の quota 枠を直接「契約枠」と断定しない。複数の同一 reset window 内で、quota 使用率差分と `quotaEquivalentCostUsd` を突合して得る値を *effective quota budget* と呼ぶ。

## ディレクトリと Git 方針

```text
observe/llm-usage/
├── state/                         # Git 管理外
│   ├── machine-id                 # このマシン専用 UUID
│   ├── quota-config.json          # provider -> accountAlias のローカル対応
│   └── quota/YYYY-MM-DD.jsonl     # extension が追記する生観測値
├── aggregate/<machine-id>/YYYY/MM.json  # Git 管理する日次集計
└── master/pricing.json            # Git 管理する単価・係数マスタ
```

`state/` は `observe/llm-usage/.gitignore` で除外する。prompt、cwd、token、認証情報、API response 全体は保存しない。

## 収集と集計

[`chezmoi/private_dot_pi/private_agent/extensions/usage-status.ts`](../../chezmoi/private_dot_pi/private_agent/extensions/usage-status.ts) は次のタイミングで quota API を再取得する。

- Pi session 開始時
- agent が settle した後
- Pi 起動中の 10 分間隔

取得成功時、provider ごとに `quota_observation` を `state/quota/YYYY-MM-DD.jsonl` へ追記する。保存する percentage は UI 表示用に丸める**前**の値である。

Pi の assistant message は `~/.pi/agent/sessions/**/*.jsonl` に immutable に保存される。集計コマンドはそれを後追いで読み、`input`、`output`、`cacheRead`、`cacheWrite` を日次・model 別に合算する。fork/clone に複製される entry は entry ID・時刻・provider/model・token 内訳の hash で重複排除する。末尾に書込み途中の JSONL 行があれば、その行だけを無視する。

```bash
node internal/src/cli.ts llm-usage init
node internal/src/cli.ts llm-usage aggregate
```

Node package 管理は pnpm である。検証は以下を使う。

```bash
pnpm --dir internal test
pnpm --dir internal typecheck
```

## 価格マスタ

`master/pricing.json` は `modelIdentifier + applyFrom` を一意にし、usage event の UTC 日付以下で最新の revision を選ぶ。

- 通常の単価: input / output / cacheRead / cacheWrite の USD per 1M tokens
- `tiers`: `input + cacheRead + cacheWrite` が閾値を超えた request の単価
- `conditions`: UTC の曜日・時刻条件による単価 override
- `quotaMultiplier`: API 定価から subscription quota 消費の実効額へ変換する倍率

集計の意味は次のとおり。

```text
retailCostUsd = Σ tokenKind × API price / 1_000_000
quotaEquivalentCostUsd = Σ retailCostUsd × quotaMultiplier
```

`quotaMultiplier` は cacheRead を通常 input 単価へ置き換えるための仕組みではない。cacheRead は常に provider の cacheRead 単価で評価する。倍率は、特定モデルの Go 枠が標準枠と異なる、または promotion により usage coefficient が変わる場合だけに使う。

初期 master の一部は Pi session に永続化されていた `usage.cost` から復元した。`applyFrom` が「公式の改定日」ではなく最初の観測日に過ぎる entry は、公式な開始・終了日が判明したら差し替える。

## 既知の時間帯ルール

### OpenCode Go / DeepSeek V4 Flash

DeepSeek V4 Flash の Peak は月〜金 UTC `01:00–04:00` および `06:00–10:00`、それ以外は Off-Peak。

| 期間 | Off-Peak API price (in/out/cacheRead) | Peak | quotaMultiplier | 根拠 |
| --- | --- | --- | --- | --- |
| 2026-08-01〜17 | `$0.14 / $0.28 / $0.0028` | 2x | `0.5` | 正式 release 後、2x Usage promotion |
| 2026-08-17〜18 | `$0.22 / $0.66 / $0.007` | 2x | `4` | 枠が $15 |
| 2026-08-18〜現在 | `$0.22 / $0.66 / $0.007` | `0.44 / 1.32 / 0.014` | `2` | 枠が $30（通常 $60 の半分） |

OpenCode Go 公式 docs は現行の Off-Peak/Peak 単価、時間帯、および Flash の $30 usage を記載している: <https://dev.opencode.ai/docs/go/>。

### Z.ai / GLM-5.3

Z.ai の現在の quota rule では GLM-5.3/GLM-5-Turbo は月〜金 Singapore Time `14:00–18:00` に 3x coefficient、それ以外は 1x coefficient。UTC では月〜金 `06:00–10:00` である。

`zai/glm-5.3` の master は API 単価 `$1.4 / $4.4 / $0.26` を維持し、該当 UTC window のみ `quotaMultiplier: 3` を設定する。

出典: Z.ai Plan Update Announcement, “Usage Reference for Legacy Plans”: <https://docs.z.ai/devpack/notice/usage-revision>。

この rule はプラン移行状況に依存するため、Z.ai account が該当する quota rule を使用していることを quota API の plan/limit response と合わせて継続確認する。

## 他マシンの導入・集計

各マシンで以下をそのまま実行する。`init` は machine ID が未作成のときだけ生成するため、繰り返してよい。Pi をすでに起動している場合は、最後に `/reload` して extension を読み直す。

```bash
cd ~/.local/share/chezmoi

git pull --ff-only origin main
chezmoi apply
chezmoi verify ~/.pi/agent/extensions/usage-status.ts

node internal/src/cli.ts llm-usage init
node internal/src/cli.ts llm-usage aggregate

git add observe/llm-usage/aggregate
git commit -m "chore: aggregate LLM usage"
git pull --rebase origin main
git push origin HEAD:main
```

`state/` は add しない。machine ID ごとに `aggregate/<machine-id>/` が分かれるため、同じ account を使う複数マシンも file conflict なしに集約できる。push 前に他マシンの commit が入った場合だけ `git pull --rebase` が必要になる。

## 現在の不足・次の作業

- quota 生観測は extension を `/reload` した後から蓄積される。過去 token usage はあっても、過去 quota percentage が無ければ枠推定はできない。
- 同一 account を複数マシンで使うときは `state/quota-config.json` の `accountAliases` を同じ論理名にする。quota observation 自体はマシン間で加算しない。
- quota 推定は rolling 5h window を初期対象から外し、weekly/monthly の同一 `resetAt` 内だけで行う。
- `anthropic/*` や local/gateway provider は subscription quota の対象外として、必要になるまで pricing master を追加しない。
- 公式な価格改定日、キャンペーン、plan-specific coefficient が判明したら、master に revision または condition を追加し再集計する。
