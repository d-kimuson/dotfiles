# Dead Code Removal

使われていないコード、ファイル、依存を消す。

## 依頼

Independent Agent に次を依頼する。

「使われていないコード、ファイル、依存を探して消してください。言語に合うツール (TypeScript なら knip など) で候補を出し、動的な参照、公開している API、設定・スクリプト・HTML からの参照、直接実行するスクリプトでないことを確かめてから消します。ツールが見ない候補 (export していない関数、警告を抑えるためだけの参照) は、コードを読んで探してください。確かめきれないものと、使われていなくても消すかどうかを人が決めるもの (`docs/guidelines/quality-assurance/human-check-criteria.md` に当たるもの) は、消さずに候補と理由を返してください。AGENTS.md の Feedback Loop がすべて通るまで直し、`docs/guidelines/delegate.md` の完了の定義まで進めてください。」

## 成果物

- 削除の変更 (完了の定義に従う)。
- 確かめきれなかった候補は、まとめて 1 つのタスクとして `docs/guidelines/backlog.md` に従って Backlog に起票する。
- 人が決める候補は、候補ごとにユーザーのタスクとして起票する。
