---
name: worker-advisor
description: worker モデルがファイル変更を伴うタスクを進めるときに使う。開始時と完了時に Frontier モデルへ相談する
principles: [prove-it-works, tracer-bullet, strongest-verification, deterministic-guardrails, red-test-first]
---

# Worker-Advisor

Advisor (Frontier モデル) の知識で方針を決め、Worker (自分) が実装を進める。Advise と Review は省略しない。

Advisor には `arbiter` のモデルを使い、AGENTS.md の SubAgent Delegation に従って呼ぶ。Advisor にはファイルを変更させない。

## 手順

1. **Advise**: [references/advice-request.md](./references/advice-request.md) の形で依頼し、回答を handoff ディレクトリの `advice.md` に保存する。
2. **Work**: `advice.md` の方針と I/F に沿って実装し、`advice.md` の指標と形式検証で検証しながら進める。方針から外れる判断をしたら、理由を `advice.md` に追記する。次のときは Advisor に問いを投げてよい。回答は `advice.md` に追記する。
   - 重要な判断が必要になった
   - 前提が変わった
   - 同じ問題を解消できずにループしている
3. **Review**: 完了条件を自分で検証してから、[references/review-request.md](./references/review-request.md) の形で依頼する。Advise とは別の呼び出しにする。
4. 指摘のうち、完了条件か `advice.md` の方針に反するものを直し、Review を再度依頼する。2 回直しても同じ指摘が残れば、直さずに報告へ進む。

## 報告

- 変更の要約と、変更したファイル
- 指標と形式検証ごとの結果。実行したコマンドと出力を貼る
- Review の結論と、未解決の指摘
- `advice.md` の方針から外れた判断と、その理由
