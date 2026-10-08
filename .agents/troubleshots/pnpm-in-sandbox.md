# サンドボックス内で pnpm のコマンドが失敗する

## Symptom

Claude Code のサンドボックス内で `pnpm --dir internal typecheck` や `pnpm --dir internal test` を実行すると失敗する。

- `internal/package.json` の `packageManager` と、home-manager が入れた pnpm のバージョンが違うと、pnpm がバージョンを切り替えようとして書き込みやダウンロードで失敗する。
- `internal/src/llm-usage/dashboard.test.ts` はローカルのポートを listen するため、`listen EPERM` で失敗する。

## Workaround

- サンドボックスの外で実行する。
- サンドボックスの中で実行するなら、`internal/` で `./node_modules/.bin/tsc -p . --noEmit` と `./node_modules/.bin/vitest run` を直接実行する。`dashboard.test.ts` も通すには、設定で `sandbox.network.allowLocalBinding: true` にする。

## Why Not Fixed

サンドボックスの制約はこのリポジトリの外の設定で決まる。`packageManager` の食い違いは、home-manager の pnpm に合わせれば解消する。
