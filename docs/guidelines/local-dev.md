# Local Development

開発環境の依存管理のルール。

- マシンに入れるツールは home-manager で、Node.js と npm で配布される CLI は mise で管理する (`docs/tool-management.md`)。
- `internal/` の依存は pnpm で管理する。`internal/.npmrc` の `save-exact=true` でバージョンを固定する。
- 依存を変更したら、`internal/pnpm-lock.yaml` を同じコミットに含める。
- グローバルインストール (`npm install -g`、`pnpm add -g`) はしない。
