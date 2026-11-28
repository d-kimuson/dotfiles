# パーソナルダッシュボード

仕事モデル (https://claude.ai/artifact/SDRamdob1iKXw1bpp2jLmu) のパーソナルダッシュボード。Software Factory の外で、本人がやることを学習も含めて 1 か所に集める。`/personal-dashboard` prompt は `personal-dashboard` Playbook への alias。

## ファイル構成

```text
personal-dashboard/
├── PLAYBOOK.md         # Agent が実行する手順の入口
├── README.md           # 構成と設計判断
├── assets/
│   └── board.html      # カードを持たないテンプレート HTML (dev-process-kit 0.4.2)
└── scripts/
    ├── board.ts        # CLI (show / apply / review / edits / migrate-db / id / session)
    ├── page.ts         # HTML と base JSON・change log の相互変換と検証
    ├── card.ts         # description の節と予約タグ・assignee の読み書き
    ├── intents.ts      # intent の base JSON への冪等な適用、カード id とセッション参照
    ├── replay.ts       # brief と draft action の解析、kit 0.4.2 互換の draft 再生、addressed の計算
    ├── text-edits.ts   # 書く前と後の HTML の差分を、順に当てる置き換えの列にする
    └── board.test.ts   # ユニットテスト
```

## 設計判断

- 積む主体は、着手中のタスクを更新する全 Agent のセッション (`AGENTS.md` のルール)、収集役 (`references/manage-user.md`)、`product-manage` (タスク管理元から拾ったタスク)、`retro` (学習バックログ)
- タスクはプロジェクト横断で 1 つの盤面に集め、プロジェクト名のタグで絞る。学習バックログは同じ文書の別ページの Kanban (`personal-learning`) に分けた。タスクの列に混ぜると、今日やることを選ぶときに学習のカードが邪魔になるため
- 盤面の呼び名はページの題と同じ「パーソナルダッシュボード」に揃え、Playbook・reference・prompt の名前も `personal-dashboard` にした。文書の中の盤面 id と kit の storage key は `personal-task-board` のまま残す。本人の未反映の draft と、draft の action の target id がこの値に結び付いているため
- 列は Todo・今日やる・進行中・Pending・Done。Pending の列 id は `blocked` のまま残す。今日やるは本人が朝に選ぶ列で、Agent は動かさない
- 盤面の正は、文書の HTML の各 `<dpk-board-kanban>` が持つ base JSON に置いた。本人の操作は kit の draft に溜まり、Agent が読んで `board.ts review` で base に反映し、`addressed` を更新して書き戻す。kit は `addressed` に入った action を次の読み込みで draft から消すが、それまで draft に残るので、`board.ts review` は `addressed` 済みの action を当て直さない
- 置き場 (文書サービス、URL、読み書きのツールと手順) はマシンごとに違うので、`~/.agents/state/personal-dashboard/index.md` (Git 管理外) に置く。Git 管理の文書とスクリプトは置き場に依存させず、`board.ts` はファイルか標準入力の HTML だけを扱う
- カードの属性と記録は kit 標準の項目で表し、kit が知らない項目を base JSON に持たない
  - 確認が必要: タグ `確認が必要`
  - 着手可能日・期日: タグ `着手可能 YYYY-MM-DD`、`期日 YYYY-MM-DD` (半角空白 1 つ、Asia/Tokyo の暦日)
  - 担い手: `assignee` に `Agent` (未設定は本人)
  - 状況の記録: description の `## 記録` 節に `- YYYY-MM-DD HH:mm <書き手>: <本文>` の行
  - Pending の理由とセッション参照: description の `## Pending の理由` 節と `## セッション` 節。Web のセッションは `https://claude.ai/code/session_<id>` をリンクに置く (ローカルの参照は http でないためリンクに置けない)
  - description の節の順は、本文・Pending の理由・記録・セッション。kit はカード表面に description の先頭 3 行を出すので本文を先頭に置く
- ページが描くのは kit の Kanban だけにする。見出し行 (`::part(header)`)、Status 欄、全列の枚数 (`.diagram-stats`)、`archived` 列を CSS で隠す
- 表示は Kanban だけにした。List の切り替えは本人が要らないと判断したので 5 回目に外した
- kit は draft で足したカード (`.is-added`、緑の破線) と動かしたカード (`.is-moved`、青) に色を付ける。本人にとって draft にあるかどうかは意味が無いので、ページの stylesheet で kit の基本のカードと同じ枠と背景に戻す。選択とフォーカスの表示は残す。カードの色は `確認が必要` (amber) と期日 (超過・今日) にだけ使う
- カード詳細の kit の Assignee 欄は隠し、担い手は属性の欄の select (自分 / Agent) だけで変える。タグの絞り込みには日付のタグを出さない (`確認が必要` は絞り込みに残す)
- カードと詳細は、題 → 説明 → 番号・タグ・リンクの順に CSS の `order` で並べ替える。kit の DOM の順は変えない
- カードの属性の見せ方は、kit のタグと assignee をそのまま出さず、CSS と詳細の専用の欄で表す。確認が必要のカードは題の上に塗りつぶしのバッジを出し、枠と背景を amber にする。着手可能日と期日は `着手可能 12/3`・`期日 12/5` の印にし、予約タグは `:nth-child` で汎用のタグから隠す。期日超過・今日の強調、着手前の非表示 (`todo` と `backlog` の列だけ、ヘッダーのチェックボックス `ptb.showDeferred` で淡く表示可)、進行中 (`doing`) 列の担い手別分割 (`order` と `.kanban-cards::after` の区切り線) も、ページのスクリプトが `el.items()` (draft を反映した盤面) と閲覧時の日付 (Asia/Tokyo) から作る adopted stylesheet だけで行う。本人の draft の変更もその場で印に反映される
- kit の Shadow DOM への差し込みは、Done 列見出しの `アーカイブ` ボタン、カード詳細の属性の欄 (`.ptb-attrs`)、カード詳細末尾の「記録を足す」欄の 3 か所。どれも kit の action (`MOVE_CARD`・`ADD_CARD_TAG`・`REMOVE_CARD_TAG`・`SET_CARD_ASSIGNEE`・`SET_CARD_DESCRIPTION`) を dispatch する
- ページは sandbox の iframe で描かれることがあるので、localStorage が使えない前提で作る (読み書きは try/catch で包む)。`confirm()` を使わず、リンクの追加は Add の click と Enter を拾って `ADD_CARD_LINK` を dispatch する
- `board.ts edits` は、書き戻しで文書全体 (約 40,000 字) を送らずに済むよう、差分を置き換えの列で出す
- 書き戻しの衝突は、最新の文書を読み直して同じ `intents.json` を `board.ts apply` (または `review`) で当て直して回復する。`comment` intent に日時 `at` を持たせて重複行を防ぐことで、再適用を冪等にする
- レビューの反映 (`board.ts review`) では、kit 0.4.2 の Kanban と同じ規則で draft を再生し、`stale` の action は base に書かない。`SET_CARD_DESCRIPTION` は description 全体を置き換えるため、`## 記録` 節だけ base 側とレビュー側の和集合 (日時順) にして Agent の記録が消えないようにする。`addressed` は `board.ts` が単調に増える範囲として計算し、brief を渡して見送り (`--keep`) が無いときは brief の値と突き合わせる
- アーカイブは、Done のカードをページが隠す最後の列 `archived` へ移す。カードを削除しないので番号が詰まらず、新しいカード番号は `archived` 列を含む盤面全体の最大番号 + 1 を振る。`確認が必要` タグを持つカードは Done に残す
- `assets/board.html` はカードを持たないので、どの置き場でも同じテンプレートから盤面を作れる

本文: [PLAYBOOK.md](./PLAYBOOK.md)
