# LLM usage observation

このディレクトリは、Pi session JSONL と subscription quota の観測値を、マシンごとの日次データへ集計するための台帳である。

```text
observe/llm-usage/
├── state/                       # Git 管理外: 生の quota 観測値と machine ID
│   ├── machine-id
│   └── quota/YYYY-MM-DD.jsonl
├── aggregate/<machine-id>/YYYY/MM.json
└── master/
    ├── pricing.json              # Git 管理: モデル単価の時系列マスタ
    └── subscriptions.json       # Git 管理: subscription plan の時系列マスタ
```

`state/` は [`./.gitignore`](./.gitignore) で除外する。`aggregate/` と `master/` は commit する。複数マシンで同じ account を使う場合、aggregate の quota を加算せず、`provider + accountAlias + window + resetAt` の時系列として統合する。

## 初期化と集計

```bash
node internal/src/cli.ts llm-usage init
node internal/src/cli.ts llm-usage aggregate
node internal/src/cli.ts llm-usage dashboard
```

`dashboard` は `127.0.0.1:48321` に read-only の表示画面を起動する。ブラウザで表示された URL を開く。`--port 0` を指定すると空いている port を自動選択する。画面の「推定利用枠」は同じ provider/account/reset window の最初・最新の quota 使用率差分と、その厳密な観測時刻の間にある Pi usage の `quotaEquivalentCostUsd` から `利用額 ÷ (使用率差分 / 100)` で算出する。使用率差分が 0、または未価格設定 usage が含まれる場合は推定しない。

`init` は `state/machine-id` に stable UUID を一度だけ作る。再作成やマシン名への変更が必要な場合は、既存ファイルを明示的に置き換える。

`aggregate` は以下を読む。

- `state/quota/**/*.jsonl`: extension が書き出す quota 観測値
- `~/.pi/agent/sessions/**/*.jsonl`: Pi の assistant message usage
- `master/pricing.json`（存在すれば）: usage 日付に対応する定価

出力は UTC 日付で区切る。Pi の fork/clone が持つ同一 assistant entry は usage 内訳と時刻から hash を作って重複排除する。`toolResult.usage` は provider/model が無い場合があるため、この PoC では集計しない。再集計は入力から作り直せる日だけ更新し、既存 month file の他の日は保持する。複数マシンで aggregate を commit/push した後、任意のマシンで `dashboard` を起動すると、同じ画面で月・machine を切り替えて確認できる。

## quota observation schema

1 行につき 1 回の fetch 結果を記録する。認証情報・prompt・API response 全体を含めない。

```json
{"schemaVersion":1,"kind":"quota_observation","observedAt":"2026-01-15T09:00:00.000Z","provider":"openai-codex","accountAlias":"default","windows":[{"kind":"weekly","usedPercent":10.2,"resetAt":"2026-01-20T00:00:00.000Z"}]}
```

`usedPercent` は表示用の整数へ丸める前の API 生値を記録する。`accountAlias` は token や account ID ではなく、同一 subscription を複数マシンで結ぶためのローカルな論理名である。デフォルトは `default`。同じ provider で subscription を区別する場合は、Git 管理外の `state/quota-config.json` に指定する。

```json
{
  "accountAliases": {
    "openai-codex": "personal",
    "opencode-go": "personal",
    "zai": "personal",
    "xai": "personal"
  }
}
```

## subscription master

`master/subscriptions.json` は `provider + planName + applyFrom` を一意とする subscription 比較用マスタである。プラン変更・値上げ・値下げがあった場合は既存 entry を書き換えず、新しい `applyFrom` の entry を追加する。

- `monthlyPriceUsd`: 通常の月額。割引価格ではなく比較用の定価を入れる
- `monthlyQuotaUsd`: monthly cap が公開されている場合の月次推定利用枠
- `weeklyCredits`: credits 制 provider の weekly 枠。`monthlyQuotaUsd` へ自動変換しない
- `compressionRatio`: `monthlyQuotaUsd / monthlyPriceUsd`。quota が USD でない場合は `null`
- `models[].availableTokensPerMonth`: 用途比較に採用するモデルだけの月間 token allowance。範囲は `min` / `max` で保持する

公開情報がない値は `null` とする。`models[].availableTokensPerMonth: null` は master の記載漏れではなく、固定 token allowance が公開されていないことを表す。OpenCode Go のように provider がモデル別の typical requests と typical token pattern を公開している場合は、「固定 cap ではない推定 token 数」として記載する。さらに Pi aggregate に同じ model の priced usage がある場合は、観測した input / output / cache read 比率を使い、provider の quota coefficient の範囲を Peak / Off-Peak に展開した「単独モデル換算」もダッシュボードで表示する。通常は quota 消費が少ない Off-Peak の方が token 数は大きくなり、表示は `Peak の下限 – Off-Peak の上限` とする。これは複数モデル併用時の実際の token allowance ではない。ただし `quotaMeasurement` がある plan は、使用率差分が 50%以上の最新 cycle、次に20%以上の最新 cycle、最後にその他の有効な cycle の順で選んだ実測値を月換算する。`scaleFrom` と `quotaScale` がある plan は基準 plan の実測値を公開倍率で展開する。実測も比較倍率もない場合だけダッシュボードで `—` になる。ダッシュボードの「サブスク比較」はこの master を表示し、モデル欄は月額 `〜$30`、`〜$100`、`$101〜` の価格帯でグルーピングする。

## pricing master

`prices` は `modelIdentifier` と `applyFrom` の組を一意にする。使用日以下で最新の revision を採用するため、キャンペーン価格から通常価格への移行をそのまま書ける。`tiers` は任意で、`input + cacheRead + cacheWrite` が `inputTokensAbove` を超えた request に tier 単価を適用する。

`conditions` は任意の UTC 曜日・時刻 rate override である。`utc-weekly-time-window` の `weekdays` は JavaScript の UTC weekday（`0` は日曜、`1` は月曜）で、`startUtc` から `endUtc` の半開区間を表す。`quotaMultiplier` は API retail price と subscription quota 上の実効単価の比である。token kind ごとに quota 式が異なる場合は `quotaRates` を使い、出力では API 定価換算を `retailCostUsd`、quota 推定用を `quotaEquivalentCostUsd` として分ける。Z.ai `zai/glm-5.3-flash` は公式 pricing page の標準 API 単価（input `$0.15` / output `$0.50` / cache read `$0.03`）と、公式 credit 式の GLM-5.3 / Flash 比を token kind 別の `quotaRates` に登録している。ページに併記された一時的な 50% promotion は API 定価換算には適用しない。

```json
{
  "schemaVersion": 1,
  "currency": "USD",
  "prices": [
    {
      "modelIdentifier": "provider/model-id",
      "applyFrom": "2026-01-01",
      "inputPerMillionUsd": 1.25,
      "outputPerMillionUsd": 10,
      "cacheReadPerMillionUsd": 0.125,
      "cacheWritePerMillionUsd": 1.25
    },
    {
      "modelIdentifier": "provider/model-id",
      "applyFrom": "2026-02-01",
      "inputPerMillionUsd": 2.5,
      "outputPerMillionUsd": 20,
      "cacheReadPerMillionUsd": 0.25,
      "cacheWritePerMillionUsd": 2.5,
      "quotaMultiplier": 1,
      "tiers": [
        {
          "inputTokensAbove": 272000,
          "inputPerMillionUsd": 5,
          "outputPerMillionUsd": 20,
          "cacheReadPerMillionUsd": 0.5,
          "cacheWritePerMillionUsd": 5
        }
      ]
    }
  ]
}
```

4 種の token を各 request の revision で個別に価格化する。価格マスタが未作成、またはマスタに無い model は token 数を出力するが、日次 `retailCostUsd` は `null` にする。その場合でも、価格を解決できた request だけの合計は `pricedRetailCostUsd` に残す。4 種すべてが 0 の assistant message は費用・token 使用量に寄与しないため集計対象外にする。

この PoC の初期 entries は Pi session に永続化済みの cost 内訳と、cost が 0 の subscription provider は当該時点の Pi model catalog を照合して作成した。`applyFrom` は観測できた最初の日であり、Provider がその日に価格を変更したという主張ではない。公式なキャンペーン開始・終了日が判明したら、その日付の revision へ置き換える。
