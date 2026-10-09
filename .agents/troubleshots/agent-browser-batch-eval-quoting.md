# agent-browser batch 内の eval がネストした引用符で ReferenceError になる

## Symptom

`agent-browser ... batch "..." "eval <式>"` で、`<式>` の中にさらに引用符を含む JS を渡すと `ReferenceError` になり失敗する。

## Workaround

確認したい値を、preview 用 HTML 側に埋め込んだデバッグスクリプトで `window.__dbg` のようなグローバル変数にあらかじめ設定しておき、`batch` からは `eval window.__dbg` のように引用符を含まない単純な式だけを渡す。

## Why Not Fixed

`batch` 内の `eval` 引数の引用符解釈は agent-browser 側の挙動で、単発の調査用途のため仕組み化は見送った。
