# browser-ops

Agent にブラウザ操作を依頼するときの共通 skill です。`agent-browser` CLI に一本化しています。

- 既定はセッションごとの使い捨てプロファイルです。並列に動くエージェント同士がぶつかりません。
- ログインが必要なときだけ、Agent 専用の共有プロファイル `~/.config/agent-browser/profiles/shared` を 1 つのエージェントが占有して使います。
- 通常は headless。headless の制約で操作できないサイトのみ headed に切り替えます。
- ログインが必要なときはウィンドウを開き、ユーザーが直接ログインします。パスワードを Agent に渡す必要はありません。
- 操作終了時はブラウザを終了しますが、共有プロファイルは保持します。

独立した名前付き workflow はありません。実行時の指示は `SKILL.md` に集約しています。

## 保守

- ソースは `agents-harness/.agents/skills/browser-ops/` で、`~/.agents/skills/browser-ops/` はそこへの symlink 経由で同じ実体です。変更は `chezmoi apply` なしで反映されます。
- CLI は既存の mise 管理の `npm:agent-browser` を使用します。CLI コマンドの詳細はインストール済みバージョンの `skills get core` / `--help` を参照します。
- ブラウザのプロファイルや Cookie は配布・Git 管理しません。
- 旧 `launch-chrome-debug` skill と個人 Chrome プロファイルのコピー手順を置き換えています。
- 以前は全タスクで共有プロファイルを使っていました。2026-05〜11 のセッションログでは、並列のサブエージェントが同じプロファイルを取り合い、`SingletonLock` の競合で 1 回 80〜105 秒待ったうえで作業を諦める例が最も大きな詰まりの原因だったため、既定を使い捨てプロファイルに変えました。
- 「応答しないとき」「Interaction」の注意は、同じログで多かった失敗 (daemon の IPC 無応答、`eval` の `const` 再宣言、存在しない `viewport` コマンド、古い ref、変数に入れたコマンドの zsh での分割失敗) から書いています。
- 2026-11 に browser-use CLI 1.0.5 を代替候補として試し、見送りました。セッションごとに別プロファイルの Chrome を起動して `BU_CDP_URL` で繋げば、3 並列でも重いページでも固まりませんでした。一方で既定の動きは起動中の個人の Chrome への接続で、ブラウザを分けるには自前のラッパーが要ります。Chrome for Testing 156 ではページ遷移が毎回タイムアウトしました。規約変更の後も agent-browser の daemon が固まり続けるなら、ラッパーを用意して移行を再検討します。
