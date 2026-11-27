---
description: 'dotfiles-apply 相当の反映を行い、chezmoi の conflict とエラーを解消して反映し切る'
disable-model-invocation: true
user-invocable: true
---

zabrze abbreviation `dotfiles-apply` (`docs/commands.md`) と同じ反映を行う。chezmoi の conflict は差分を読んで解消し、エラーは原因を直して、すべての反映が通るまで続ける。

## 手順

### 1. 事前確認

1. カレントディレクトリが `~/.local/share/chezmoi` であることを確かめる。別の checkout (worktree など) の場合は反映を実行せず中断して報告する (`docs/commands.md`)。
2. `git status` で未コミットの変更を把握する。conflict の解消で加える変更と混ぜない。

反映のコマンドはすべてサンドボックスの外で実行する (`.agents/troubleshots/chezmoi-apply-in-sandbox.md`、`.agents/troubleshots/nix-in-sandbox.md`)。

### 2. chezmoi の conflict の解消

`chezmoi status` の各行は 1 列目が「chezmoi が最後に書いた内容から target state が変わったか」、2 列目が「反映で target state が変わるか」を表す。次の 2 種類を conflict として扱う。

- 両方の列に文字がある行 (`MM` など)。`chezmoi apply` が上書きの確認を求める。
- 2 列目だけに文字があり、`chezmoi state get --bucket=entryState --key=<絶対パス>` が空の行。chezmoi が書いたことのないファイルで、`chezmoi apply` は確認なしに上書きする。

conflict ごとに `chezmoi diff --no-pager <target>` を読む。`-` の行が target state だけにあり、上書きで消える内容である。その内容を、次の表の上の行から順に当てはめて扱う。

| target state だけにある内容 | 対応 |
| --- | --- |
| ツールが繰り返し書き込む | ツールが書く内容と一致するように source state を直し、同じ conflict の再発を防ぐ |
| 不要 (source state より古い、ツールが再生成できる) | 上書きする |
| 必要で、マシン固有か、公開リポジトリに置けない | source state から読み込まれる Git 管理外のローカルファイルへ移す (`~/.ssh/config.local`、`~/.gitconfig-local`、`shell/localrc.sh` など)。読み込む仕組みが無ければ source state に足す |
| 必要で、マシン間で共通 | source state に取り込む。`.tmpl` はテンプレート構文を保ったまま編集する |

秘密情報の値は source state に取り込まない (`docs/chezmoi.md`)。必要か不要かを差分と周辺の設定から判断できない内容は、上書きせずにユーザーへ確認する。

対応を決めた conflict は `chezmoi apply --force <target>` で反映し、`chezmoi diff --no-pager <target>` が空であることと、移した設定が効いていること (`ssh -G <host>`、`git config --get <key>` など) を確かめる。

### 3. 反映

次の順に実行する。Bash の呼び出しをまたぐと `source` の結果が失われるため、`home-manager switch` は `source` と同じ呼び出しで実行する。`home-manager switch` は数分かかることがあるため、タイムアウトは長めに取る。

```bash
chezmoi apply --no-tty --keep-going </dev/null
source shell/envrc.sh && home-manager switch
node internal/src/cli.ts pi-agent deliver
node internal/src/cli.ts merge-config
node internal/src/cli.ts keybindings deliver
```

終了コードだけでなく、標準出力・標準エラーの警告も確認する (`--keep-going` は失敗した対象を飛ばして続行する)。

### 4. 失敗への対応

`.agents/troubleshots/` に既知の症状がないか確認したうえで原因を切り分け、直してから失敗したコマンド以降を再実行する。

- リポジトリ側の原因 (source state、`config/`、`internal/` の不備): target state を直接直さず正本を修正する。`docs/guidelines/delegate.md` の「確認してからやる」に該当する変更は、原因と対応案を提示してユーザーに確認する。
- 外部要因 (nixpkgs の破損 revision、ネットワークの一時障害など): `.agents/troubleshots/` のワークアラウンドで復旧する。新しいワークアラウンドを得たら `.agents/troubleshots/<topic>.md` を `docs/guidelines/writing/troubleshoot.md` の形式で追加する。
- 自律で解決できない場合: 環境を壊したままにせず (必要なら `home-manager generations` で確認した直前世代の `activate` を実行する)、原因・試した内容・選択肢を報告して中断する。

### 5. 検証

1. `chezmoi verify` が終了コード 0 を返し、`chezmoi status` が空であることを確かめる。
2. リポジトリを変更した場合は、`AGENTS.md` の Feedback Loop に該当する検証と、`docs/guidelines/delegate.md` の内部レビューを行う。

### 6. コミット

リポジトリを変更した場合は `docs/guidelines/commit.md` と `docs/guidelines/delegate.md` に従ってコミットし、push する。変更が無ければコミットしない。

## 成果物

- source state と一致した実機 (chezmoi、home-manager、Pi 設定、Claude/Codex/Command Code のマージ設定、キーバインド)
- conflict の解消やエラーの修正でリポジトリを変更した場合のコミット
- 次の内容を含む報告:
  - conflict ごとの差分の要約と、選んだ対応 (上書き、source state へ取り込み、ローカルファイルへ移動)
  - 発生した失敗・警告と、原因・実施した修正
  - 実行した検証コマンドと結果
  - シェル設定 (`shell/`、`chezmoi/dot_zshrc.tmpl` など) が変わった場合は、開いているシェルへ読み込むコマンド `exec $SHELL -l`
