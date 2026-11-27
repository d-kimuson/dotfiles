# Web application backend: Quint と MBT

集約とトランザクションを Quint にそのまま写し、モデルから生成したトレースで実装を動かして突き合わせる。

## モデルへの写し方

| 実装 | モデル |
| --- | --- |
| 集約 | `var`。集約の種類ごとに `id -> 状態` の map を 1 つ |
| トランザクション (1 リクエストのユースケース) | action。引数は `nondet` で選ぶ |
| 集約の不変条件、集約をまたぐ整合性 | 不変条件の `val` |
| 複数リクエストの並行 | action の非決定的な選択による interleaving |

1 つのトランザクションが DB 上で原子的でない (複数回に分けて書く、外部呼び出しを挟む) なら、その段階ごとに action を分ける。分けないと競合の反例が出ない。

## 検証

1. [quint.md](./quint.md) の手順で不変条件を `quint run` と `quint verify` で確かめる。
2. トレースを生成する。

   ```sh
   quint run model.qnt --mbt --invariant=<不変条件名> --max-steps=<N> --n-traces=<M> --out-itf='traces/out_{seq}.itf.json'
   ```

   各状態には `mbt::actionTaken` (取った action) と `mbt::nondetPicks` (選んだ引数) が入る。
3. 実装側にトレースを再生するテストを書く。テスト用の DB を初期化し、状態ごとに `mbt::actionTaken` に対応するトランザクションを `mbt::nondetPicks` の引数で実行する。実行後、DB の状態をモデルの `var` と同じ形に射影して、トレースの値と比べる。ITF の値は `{"#bigint": "1"}`、`{"#set": [...]}`、`{"#map": [[k, v], ...]}` の形で入る。
4. 一致しなければ、実装とモデルのどちらが要求に反しているかを決めて直す。

判定するコマンドは、`quint verify` とトレース再生テストの 2 つ。
