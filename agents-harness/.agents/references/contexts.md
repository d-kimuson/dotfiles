# Context ディレクトリ

本人の仕事の文脈を `~/.agents/state/contexts/<name>/` に Markdown で持つ。`<name>` は所属ごとの短い ASCII の kebab-case (個人なら `personal`、会社なら社名)。

## `<name>` の選び方

1. 環境変数 `AGENTS_CONTEXT` があればそれを使う。
2. なければ `~/.agents/state/contexts/` 直下のディレクトリが 1 つならそれを使う。
3. どちらでも決まらなければ本人に聞く。新しい名前なら、下のファイルを空の見出しだけで作る。

## ファイル

| パス                  | 中身                                                                 | 書く playbook          |
| --------------------- | -------------------------------------------------------------------- | ---------------------- |
| `PROFILE.md`          | 所属、役割、担当プロダクト、判断の優先順位や原則                     | 本人 (Agent は追記の提案だけ) |
| `INTERESTS.md`        | Interest Model。`## 関心あり` と `## 関心なし` に、対象と理由、記録日を 1 行ずつ | catchup                |
| `RESOURCES.md`        | 情報源。1 行に 1 つ、種類 (Slack チャンネル、ドキュメントの空間など)、場所、読むツール | catchup                |
| `INDEX.md`            | Context Store の索引。トピックごとに 1 行の要約と `topics/<topic>.md` へのリンク | catchup                |
| `topics/<topic>.md`   | トピックごとの経緯、決まったこと、未決の論点。論点には出典の URL を付ける | catchup                |
| `catchups/<YYYY-MM-DD>.md` | catchup のダイジェスト。最新のファイル名の日付が前回の実行日      | catchup                |

読むときは `INDEX.md` から始め、要るトピックの `topics/<topic>.md` だけを開く。
