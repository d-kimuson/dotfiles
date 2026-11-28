# worker-advisor

知識の少ない安価なモデル (worker) に、Frontier モデルの知識を足して、費用と成果物の質を釣り合わせるパターン。`/worker-advisor` prompt から使うほか、`coordinate-task` が worker へ依頼するときに指定する。

- worker は相談の要否を自分で判断しきれないので、開始時と完了時の相談を必須にした。Work 中の相談は worker の判断に任せる。runtime をまたいで決定論的に強制する仕組みは保守できないため、プロンプトの手順だけで縛る
- Advisor は judge に固定した。方針の誤りがタスク全体の誤りになるため、worker より上位のモデルにする。arbiter はタスクごとに Advise と Review で 2 回以上呼ぶと利用枠の消費が速すぎるため使わない
- 形式検証の手法は Advisor が `formal-modeling` のパターンから設計し、worker は Feedback Cycle の 1 つとして回す
- Review は方針を出した呼び出しに引きずられないよう、別の呼び出しにする
- 旧 `qae` Role の検証観点は Review の依頼文 (`references/review-request.md`) に移した。principles は旧 `product-engineer` Role が推奨していたものを引き継いだ

本文: [PLAYBOOK.md](./PLAYBOOK.md)
