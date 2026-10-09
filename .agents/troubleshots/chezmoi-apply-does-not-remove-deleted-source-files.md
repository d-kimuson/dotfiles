# chezmoi apply がソース側で削除・リネームしたファイルを配布先から消さない

## Symptom

`chezmoi/` 配下でファイルを削除・リネームしてから `chezmoi apply` しても、配布先 (`~/.agents/...` など) に古いファイルが残る。
`chezmoi verify` は「現在 chezmoi が管理していると認識しているターゲット」だけを見るため、この残留ファイルがあっても成功してしまい、気付けない。

例: `chezmoi/dot_agents/skills/learn-it/references/explanatory-video/` を削除して `chezmoi apply` した後も `~/.agents/skills/learn-it/references/explanatory-video/` が残った。

## Workaround

- 配布先の古いファイルを手動で `rm` する。
- 繰り返し発生するなら `.chezmoiremove` (削除したいパターンを列挙し、apply 時にそれらを配布先から削除する chezmoi の仕組み) の採用を検討する。未採用。

## Why Not Fixed

`.chezmoiremove` を使うかどうかはこのリポジトリ全体の運用方針の決定が必要 (すべてのディレクトリに適用するか、削除のたびに手動更新するパターンを許容するか)。
