# browser-ops

Agent にブラウザ操作を依頼するときの共通 skill です。`agent-browser` CLI に一本化し、Agent 専用の共有プロファイルでログイン状態を再利用します。

- 通常は headless。headless の制約で操作できないサイトのみ headed に切り替えます。
- ログインが必要なときはウィンドウを開き、ユーザーが直接ログインします。パスワードを Agent に渡す必要はありません。
- プロファイルは `~/.config/agent-browser/profiles/shared`。全サイト共通で使い、同時操作は避けます。
- 操作終了時はブラウザを終了しますが、プロファイルは保持します。

独立した名前付き workflow はありません。実行時の指示は `SKILL.md` に集約しています。

## 保守

- ソースは `agents-harness/.agents/skills/browser-ops/` で、`~/.agents/skills/browser-ops/` はそこへの symlink 経由で同じ実体です。変更は `chezmoi apply` なしで反映されます。
- CLI は既存の mise 管理の `npm:agent-browser` を使用します。CLI コマンドの詳細はインストール済みバージョンの `skills get core` / `--help` を参照します。
- ブラウザのプロファイルや Cookie は配布・Git 管理しません。
- 旧 `launch-chrome-debug` skill と個人 Chrome プロファイルのコピー手順を置き換えています。
