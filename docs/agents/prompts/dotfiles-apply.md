# dotfiles-apply

zabrze abbreviation `dotfiles-apply` と同じ反映を行い、chezmoi の conflict とエラーを解消して反映し切る prompt。本体は `.agents/prompts/dotfiles-apply.md`。

## いつ使うか

`dotfiles-apply` が chezmoi の conflict (`has changed since chezmoi last wrote it` の確認) やエラーで止まり、差分の判断と修正を任せたいときに使う。conflict もエラーも無いときは使わず、abbreviation の `dotfiles-apply` を直接実行する (`docs/commands.md`)。

## 起動

Claude Code、Pi、Command Code で `/dotfiles-apply` と入力する。モデルが自分から起動することはない (`disable-model-invocation: true`)。

## 成果物

- source state と一致した実機 (chezmoi、home-manager、Pi 設定、Claude/Codex/Command Code のマージ設定、キーバインド)
- conflict の解消 (上書き、source state へ取り込み、Git 管理外のローカルファイルへ移動) やエラーの修正でリポジトリを変更した場合のコミット
- conflict ごとの対応、失敗への対応、検証結果の報告
