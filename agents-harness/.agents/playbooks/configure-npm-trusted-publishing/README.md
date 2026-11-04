# Configure npm trusted publishing

npm パッケージを trusted publishing (OIDC) で公開する仕組みを整える playbook。

- 公開前の依存監査: `pnpm audit:deps` を `preversion` と Release workflow の両方で実行する
- `minimumReleaseAge` などの pnpm 設定を `pnpm-workspace.yaml` で確保する
- release skill を project skill として作成する

## 出典

`~/repos/motion-kit` の `release.yml` と `docs/guidelines/release.md`、`~/repos/dev-process-kit` の release skill を汎用化した。motion-kit の構成 (`--ignore-scripts`、`npm publish` で `--provenance` を付けない、`clean-pkg-json` を workflow で実行する) を基準にしている。理由は motion-kit の `docs/decisions/20261029-npm-trusted-publishing-release.accepted.md` を参照。

依存監査は両リポジトリとも未導入で、この playbook で追加したもの。

## 設計メモ

- `audit:deps` は `--prod` を付けない。Release workflow は `id-token: write` を持つジョブで devDependencies (ビルドツール) も実行するため。
- 監査は CI の lint には入れない。外部の advisory が増えるだけで無関係な PR が落ちるため、リリース時のゲートに限定する。
- npm アカウントの操作 (初回公開、trusted publisher 設定、トークン禁止) は Agent が実行せずユーザーに渡す。

本文: [PLAYBOOK.md](./PLAYBOOK.md)
