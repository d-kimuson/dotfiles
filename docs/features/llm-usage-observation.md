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
├── aggregate/<machine-id>/quota-estimates.json # Git 管理する quota 利用枠逆算
└── master/
    ├── pricing.json              # Git 管理する単価・係数マスタ
    └── subscriptions.json       # Git 管理する subscription plan 比較マスタ
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

## Subscription 比較マスタ

`master/subscriptions.json` は `provider + planName + applyFrom` の時系列で、通常月額、公開 monthly cap、credits 枠、圧縮率、用途別に採用するモデルの token allowance を管理する。プラン変更時は新しい開始日 entry を追加する。

`models[].availableTokensPerMonth: null` は master の記載漏れではなく、固定 token allowance が公開されていないことを表す。OpenCode Go のように provider がモデル別の typical requests と typical token pattern を公開している場合は、それを「固定 cap ではない推定 token 数」として記載する。さらに Pi aggregate に同じ model の priced usage がある場合は、観測した input / output / cache read 比率を使い、provider の quota coefficient の範囲を Peak / Off-Peak に展開した「単独モデル換算」も表示する。通常は quota 消費が少ない Off-Peak の方が token 数は大きくなり、表示は `Peak の下限 – Off-Peak の上限` とする。これは複数モデル併用時の実際の token allowance ではない。`quotaMeasurement` を持つ plan は、その provider/kind の `quota-estimates.json` から、使用率差分が `50% 以上` の最新 cycle、次に `20% 以上` の最新 cycle、最後にその他の有効な cycle の順で選び、実測値を月換算して表示する。`scaleFrom` と `quotaScale` を持つ plan は、基準 plan の実測月額を公開倍率で展開する。したがって比較画面の月次推定利用枠は、固定値より実測値を優先し、観測も倍率もない場合だけ `—` になる。credits と USD の対応が一意でない場合も、実測した USD 相当値があればそれを使う。

quota がすでに 100% で、観測開始時点から増加が確認できない monthly window は、reset 起点から 100% 到達までに記録できた usage を**検算値**として別扱いにする。この値は使用率差分からの推定ではなく、他端末・Pi 外・未収集期間を含まない下限値である。

ダッシュボードの「利用枠推定 → サブスク比較」には、ここで定義した plan とモデルだけを表示する。モデルは全 catalog ではなく、比較対象として意味のあるものに限定し、月額を `〜$30`、`〜$100`、`$101〜` の価格帯でグルーピングする。

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

`quotaMultiplier` は cacheRead を通常 input 単価へ置き換えるための仕組みではない。cacheRead は常に provider の cacheRead 単価で評価する。token kind ごとに quota 式が異なる場合は `quotaRates` を使う。単一倍率は、特定モデルの Go 枠が標準枠と異なる、または promotion により usage coefficient が変わる場合だけに使う。

`quota-estimates.json` は provider / accountAlias / window kind / resetAt ごとに、最初と最新の観測値の使用率差分、およびその正確な観測時刻の間に発生した同 provider の Pi usage を記録する。全 request が価格設定済みで使用率差分が正の場合だけ、`quotaEquivalentCostUsd / (usedPercentDelta / 100)` を推定利用枠として表示する。

初期 master の一部は Pi session に永続化されていた `usage.cost` から復元した。`applyFrom` が「公式の改定日」ではなく最初の観測日に過ぎる entry は、公式な開始・終了日が判明したら差し替える。

## 既知の時間帯ルール

### OpenCode Go / DeepSeek V4 Flash

DeepSeek V4 Flash の Peak は月〜金 UTC `01:00–04:00` および `06:00–10:00`、それ以外は Off-Peak。

| 期間 | Off-Peak API price (in/out/cacheRead) | Peak | quotaMultiplier | 根拠 |
| --- | --- | --- | --- | --- |
| 2026-08-01〜17 | `$0.14 / $0.28 / $0.0028` | 2x | `0.5` | 正式 release 後、2x Usage promotion |
| 2026-08-17〜18 | `$0.22 / $0.66 / $0.007` | 2x | `4` | 枠が $15 |
| 2026-08-18〜現在 | `$0.22 / $0.66 / $0.007` | `0.44 / 1.32 / 0.014` | `2` | 枠が $30（通常 $60 の半分） |

OpenCode Go 公式 docs は現行の Off-Peak/Peak 単価、時間帯、Flash の $30 usage、typical token pattern を記載している。DeepSeek V4 Flash の token 表示はその pattern を使い、Peak の下限から Off-Peak の上限へ展開する: <https://dev.opencode.ai/docs/go/>。

### Z.ai / GLM-5.3 / GLM-5.3-Flash

Z.ai の現在の quota rule では GLM-5.3/GLM-5-Turbo は月〜金 Singapore Time `14:00–18:00` に 3x coefficient、それ以外は 1x coefficient。UTC では月〜金 `06:00–10:00` である。

`zai/glm-5.3` の master は API 単価 `$1.4 / $4.4 / $0.26` を維持し、該当 UTC window のみ `quotaMultiplier: 3` を設定する。`zai/glm-5.3-flash` は公式 pricing page の標準 API 単価（input `$0.15` / output `$0.50` / cache read `$0.03`）を適用する。quota 換算は公式 credit 式の GLM-5.3 / Flash 比を token kind 別の `quotaRates` に反映し、既存の GLM-5.3 基準に対して off-peak 1/3、peak 1 倍の rate とする。ページに併記された一時的な 50% promotion は API 定価換算には適用しない。

出典: Z.ai pricing page <https://docs.z.ai/guides/overview/pricing>、および Plan Update Announcement, “Usage Reference for Legacy Plans”: <https://docs.z.ai/devpack/notice/usage-revision>。

この rule はプラン移行状況に依存するため、Z.ai account が該当する quota rule を使用していることを quota API の plan/limit response と合わせて継続確認する。

## 他マシンの導入・集計

各マシンで以下をそのまま実行する。`init` は machine ID が未作成のマシンでだけ実行する。Pi をすでに起動している場合は、最後に `/reload` して extension を読み直す。

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

収集済みの全 machine aggregate は、任意の 1 台で次のコマンドを実行すると読みやすく確認できる。

```bash
cd ~/.local/share/chezmoi
node internal/src/cli.ts llm-usage dashboard
```

表示された `http://127.0.0.1:48321` をブラウザで開く。`state/` は add しない。machine ID ごとに `aggregate/<machine-id>/` が分かれるため、同じ account を使う複数マシンも file conflict なしに集約できる。push 前に他マシンの commit が入った場合だけ `git pull --rebase` が必要になる。

## 現在の不足・次の作業

- quota 生観測は extension を `/reload` した後から蓄積される。過去 token usage はあっても、過去 quota percentage が無ければ枠推定はできない。
- 同一 account を複数マシンで使うときは `state/quota-config.json` の `accountAliases` を同じ論理名にする。quota observation 自体はマシン間で加算しない。
- quota 推定は rolling 5h window を初期対象から外し、weekly/monthly の同一 `resetAt` 内だけで行う。
- `anthropic/*` や local/gateway provider は subscription quota の対象外として、必要になるまで pricing master を追加しない。
- 公式な価格改定日、キャンペーン、plan-specific coefficient が判明したら、master に revision または condition を追加し再集計する。
