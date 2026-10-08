# Coding

全般に共通する、重視すべき基本原則。Lint など静的な手段で強制されるルールはここに書かず、チェックで出た違反を直すことで守る。

## 原則

- クラスを使わず、アロー関数とプレーンなデータで書く。
- 型は `readonly` にする。バリアントは `as const` の配列から導いた union で表す。
- 外部の入力 (ファイル、JSON、環境変数、API のレスポンス) は `unknown` で受け、型ガードで絞り込んでから使う。
- 副作用 (ファイル・ネットワーク・プロセス) と判断を分ける。判断は純粋関数にして、ユニットテストで確かめる。
- formatter がないので、各ファイルの既存のスタイルに合わせる (`internal/` は 2 スペース・セミコロンなし・ダブルクォート、Pi の extensions はタブ・セミコロンあり)。

## 失敗と例外

- 回復しうる失敗は `{ ok: true, ... } | { ok: false, ... }` の union で返し、呼び出し側で `ok` で分岐する (`internal/src/mcp/deliver.ts` の `ExpandResult`)。
- 回復しない異常は `throw new Error(...)` にし、メッセージに対象のファイルや設定を含める。
- 外部の例外は、文脈を足した `Error` に変換する。想定内の失敗 (ファイルがない `ENOENT` など) だけを `null` や空の値にし、それ以外は投げ直す (`internal/src/pi-agent/deliver.ts`、`internal/src/llm-usage/dashboard.ts`)。
- `catch {}` で握りつぶすのは、止めない理由があるときだけにする。理由は関数名かコメントで分かるようにする (`internal/src/pi-agent/deliver.ts` の `tryParseJsonObject`)。

## ライブラリ

用途ごとに使うライブラリを決めている。同じ用途の関数を自前で書かない。

| 用途 | ライブラリ | 使う場所 |
| --- | --- | --- |
| CLI の引数 | commander | `internal/src/cli.ts` |
| TOML の読み書き | smol-toml | Codex の設定 (`internal/src/merge-config/merge.ts`、`internal/src/mcp/deliver.ts`) |
| テスト | vitest | `internal/src/**/*.test.ts` |
| tsconfig の基準 | @tsconfig/strictest | `internal/tsconfig.json` |
