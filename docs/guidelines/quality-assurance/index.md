# Quality Assurance

## 原則

品質の検証は、コストに対して効果の高い手段が効くように組み立てる。

- 安く速い手段 (型、Lint、ユニットテスト) で担保できる範囲を最大化する。状態のバリエーションは型で表し、判断は純粋関数に切り出して、ユニットテストで確かめられる範囲を広げる。
- それでも検知しにくい領域だけを、よりコストの掛かる手段 (integration テスト、E2E、探索的テストなど) で必要に応じて補う。どの品質要求をどの手法で担保するかは下の表に従う。
- 安い手段を安いまま保つために、テストは速く、揺れないものにする。
  - ファイルを読み書きするテストは `mkdtemp` で一時ディレクトリを作り、`HOME` をそこに向ける。実際の `$HOME` や固定のパスに触れない (`internal/src/pi-agent/deliver.test.ts`)。
  - ネットワークと環境変数は `vi.stubGlobal("fetch", ...)` と `vi.stubEnv` で差し替え、外部に出ない (`internal/src/pi-agent/usage-status.test.ts`)。

## 品質要求と手法

| 品質要求 | 型 | ユニット | CI | 反映 (`chezmoi apply`・deliver) | レビュー | 実機での確認 |
| --- | --- | --- | --- | --- | --- | --- |
| 設定のマージ・生成の結果が正しい | ○ | ◎ | — | ○ | △ | △ |
| hooks (language-guard など) の判定が正しい | ○ | ◎ | — | — | △ | ○ |
| 秘密情報をコミット・出力しない | — | ○ | — | ○ | ◎ | — |
| chezmoi テンプレートが展開でき、意図した差分になる | — | — | ○ | ◎ | △ | ○ |
| 新しいマシンでセットアップが通る | — | — | ○ | — | △ | ◎ |
| 反映後にツールやエージェントが期待どおり動く | — | △ | △ | △ | △ | ◎ |

◎ 主に担保する、○ 一部を担保する、△ 偶然気づくことがある、— 担保しない。

## 手法ごとの範囲

| 手法 | 範囲 | 書かないもの | 詳細 |
| --- | --- | --- | --- |
| 型 | `internal/` の入出力の形、バリアントの網羅 | — | `internal/tsconfig.json` |
| ユニット | マージ・生成・判定の純粋関数、dry-run の出力に値が出ないこと | 実際の `$HOME` やネットワークに触れるテスト | `internal/src/**/*.test.ts` |
| CI | ubuntu での `chezmoi init --apply`。home-manager は動かさない | 型検査とテスト (CI では実行しない) | `.github/workflows/ci.yaml` |
| 反映 | 変更を実機に反映し、`chezmoi verify` や配布コマンドが通ること | — | AGENTS.md の Feedback Loop、`docs/commands.md` |
| レビュー | 秘密情報、ガイドラインへの準拠、設計 | 機械的に検査されるもの | `docs/guidelines/review/index.md` |
| 実機での確認 | 反映後にツールやエージェントを起動して動きを見る | — | — |

## 失敗の再現

- 1 ファイルだけ実行する: `pnpm --dir internal exec vitest run src/mcp/deliver.test.ts`
- 1 テストだけ実行する: `pnpm --dir internal exec vitest run src/mcp/deliver.test.ts -t "<テスト名>"`
