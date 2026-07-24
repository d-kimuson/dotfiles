# Style Prompt Tuner

author-style-optimizer のプロンプトチューニングを自律実行するスキル。

## 実行フロー

各イテレーションで以下のループを回す:

### 1. 方針を決める

`OPTIMIZE_STYLE_PROMPT.md` の Active Context / Knowledge を読み、今回の方針を1行で宣言する。

### 2. プロンプトを更新する

`prompts/candidates/prompt-vNNN.md` に新しい候補を作る。カウンタは既存最大+1。

### 3. rewrite を生成する

全 validation sources を LLM で書き換える:

```bash
cd /Users/kaito/repos/writing-style-prompt-tuner

# ソース一覧
ls data/processed/sources/*.md

# 1件ずつ rewrite (eval_prompt.ts の中で LLM が呼ばれる)
pnpm eval:prompt \
  --prompt prompts/candidates/prompt-vNNN.md \
  --split validation \
  --sources data/processed/sources \
  --classifier models/author_classifier/model.json \
  --features features/author_features.json \
  --output reports/eval_runs
```

LLM は pi の認証情報 (`~/.pi/agent/auth.json`) を自動読み込みする。

### 4. スコアを確認する

```bash
RUN_ID=$(ls -t reports/eval_runs/ | head -1)
cat reports/eval_runs/$RUN_ID/report.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'avg_final_score: {d[\"averageFinalScore\"]:.4f}')
print(f'classifier_score: {d[\"averageAuthorClassifierScore\"]:.4f}')
print(f'stylometric: {d[\"averageStylometricSimilarity\"]:.4f}')
print(f'content_pass_rate: {d[\"contentPreservationPassRate\"]:.4f}')
print(f'guardrail_penalty: {d[\"averageGuardrailPenalty\"]:.4f}')
"
```

### 5. 採用判断

以下を満たせば採用:

- `contentPreservationPassRate` が current best 以上
- `averageFinalScore` が current best より改善 (min_delta=0.01)
- `guardrailPenalty` が悪化していない
- topic 別で大きな regression がない

採用時: `prompts/candidates/prompt-vNNN.md` を `prompts/current_best.md` に上書きし、`OPTIMIZE_STYLE_PROMPT.md` の Current Best / Active Context / Knowledge を更新する。

棄却時: Knowledge に理由を追記。

### 6. ループ継続判断

停滞 (3回連続で改善なし) なら探索的方針に切り替える。改善が頭打ちなら停止。

## 方針生成テンプレート

各イテレーションで以下の3タイプから1つ選ぶ:

1. **現実的A**: 効いている要素を強化 (e.g. 「つまり」「一方」の使用指示を強める)
2. **現実的B**: 別の改善経路 (e.g. 文長指定を変える、段落構成の指示を追加)
3. **探索的C**: 根本的に違うアプローチ (e.g. 文体指示ではなく文体の例を示す)

## プロンプト編集時の注意

- 数値・固有名詞・URL の保持指示は常に含める
- 元の主張を変えない指示を入れる
- だ・である調を基本にする
- 著者の語彙を過剰注入しすぎない（パロディ化防止）
- Markdown 構造の使い方を具体的に指示する
