# LLM usage observation

このディレクトリは、Pi session JSONL と subscription quota の観測値を、マシンごとの日次データへ集計するための台帳である。

```text
observe/llm-usage/
├── state/                       # Git 管理外: 生の quota 観測値と machine ID
│   ├── machine-id
│   └── quota/YYYY-MM-DD.jsonl
├── aggregate/<machine-id>/YYYY/MM.json
└── master/pricing.json           # Git 管理: モデル単価の時系列マスタ
```

`state/` は [`./.gitignore`](./.gitignore) で除外する。`aggregate/` と `master/` は commit する。複数マシンで同じ account を使う場合、aggregate の quota を加算せず、`provider + accountAlias + window + resetAt` の時系列として統合する。

## 初期化と集計

```bash
node internal/src/cli.ts llm-usage init
node internal/src/cli.ts llm-usage aggregate
```

`init` は `state/machine-id` に stable UUID を一度だけ作る。再作成やマシン名への変更が必要な場合は、既存ファイルを明示的に置き換える。

`aggregate` は以下を読む。

- `state/quota/**/*.jsonl`: extension が書き出す quota 観測値
- `~/.pi/agent/sessions/**/*.jsonl`: Pi の assistant message usage
- `master/pricing.json`（存在すれば）: usage 日付に対応する定価

出力は UTC 日付で区切る。Pi の fork/clone が持つ同一 assistant entry は usage 内訳と時刻から hash を作って重複排除する。`toolResult.usage` は provider/model が無い場合があるため、この PoC では集計しない。再集計は入力から作り直せる日だけ更新し、既存 month file の他の日は保持する。

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

## pricing master

`prices` は `modelIdentifier` と `applyFrom` の組を一意にする。使用日以下で最新の revision を採用するため、キャンペーン価格から通常価格への移行をそのまま書ける。`tiers` は任意で、`input + cacheRead + cacheWrite` が `inputTokensAbove` を超えた request に tier 単価を適用する。

`conditions` は任意の UTC 曜日・時間帯 rate override である。`utc-weekly-time-window` の `weekdays` は JavaScript の UTC weekday（`0` は日曜、`1` は月曜）で、`startUtc` から `endUtc` の半開区間を表す。`quotaMultiplier` は API retail price と subscription quota 上の実効単価の比である。出力では API 定価換算を `retailCostUsd`、quota 推定用を `quotaEquivalentCostUsd` として分ける。

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
