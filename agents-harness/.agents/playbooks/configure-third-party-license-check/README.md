# Configure third party license check

サードパーティライセンスの一覧生成とチェックを仕組み化する playbook。

- 本番依存のライセンス本文を `THIRD_PARTY_LICENSES.md` に書き出してコミットする
- CI で許可リスト外のライセンスとコミット漏れを検出する
- Web 系でその MD をもとに配信するかはアプリ次第なので扱わない

## 出典

`~/repos/motion-kit` の `scripts/third-party-licenses.ts`、`scripts/check-licenses.ts`、`scripts/license-allowlist.ts` を 1 本にまとめて汎用化した。

- 依存の収集は motion-kit の依存グラフ探索をやめ、`pnpm licenses list --prod --json` の `paths` を使う。preview 用の devDependencies バンドル、vendored コードなど motion-kit 固有の処理は外した。
- `--check` は `git show HEAD:` ではなく作業ツリーのファイルと比較する。CI ではどちらも同じで、ローカルでも生成直後に確かめられるため。
- dev-process-kit は Vite の `build.license` でバンドルの実体から生成し、`dist/` に出力している (コミットしない)。バンドルに含まれるものを正確に列挙できるが、Vite 前提でコミット対象にならないため採用しなかった。

テンプレートは pnpm 12 で生成・`--check`・許可リスト外の検出を確認済み。

本文: [PLAYBOOK.md](./PLAYBOOK.md)
