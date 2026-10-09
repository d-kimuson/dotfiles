# サンドボックス内で pnpm のコマンドが失敗する

## Symptom

Claude Code のサンドボックス内で、リポジトリ内のどの pnpm パッケージ (`internal/` や `chezmoi/dot_agents/deps/learn-it/scripts/` など、独自の `package.json`/`pnpm-lock.yaml` を持つディレクトリ) でも `pnpm typecheck`/`pnpm test` が失敗することがある。

- `internal/package.json` の `packageManager` と、home-manager が入れた pnpm のバージョンが違うと、pnpm がバージョンを切り替えようとして書き込みやダウンロードで失敗する。
- `internal/src/llm-usage/dashboard.test.ts` はローカルのポートを listen するため、`listen EPERM` で失敗する。
- registry.npmjs.org への接続が `invalid peer certificate: OSStatus -26276` で失敗することがある。副作用として、そのパッケージの `node_modules/` が空になり、リポジトリルートに `.pnpm-store/` が作られる。

## Workaround

- サンドボックスの外で実行する。
- サンドボックスの中で実行するなら、対象パッケージのディレクトリで `./node_modules/.bin/tsc -p . --noEmit` と `./node_modules/.bin/vitest run` を直接実行する。`dashboard.test.ts` も通すには、設定で `sandbox.network.allowLocalBinding: true` にする。
- `node_modules/` が空になった場合は、サンドボックスの外で (対象パッケージのディレクトリで) `pnpm install --frozen-lockfile` を実行して復元する。リポジトリルートに残った `.pnpm-store/` は削除する。

## Why Not Fixed

サンドボックスの制約はこのリポジトリの外の設定で決まる。`packageManager` の食い違いは、home-manager の pnpm に合わせれば解消する。
