# Pure なロジック: Lean による証明

状態や並行性は無いが、分岐や計算が複雑なロジック (料金計算、権限判定、パーサ、スケジューリングなど) の性質を証明する。

## 手順

1. Lean を入れる。`curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh` で elan を入れ、`lake new <name>` でプロジェクトを作る。Mathlib が要るときだけ `lake new <name> math` にする。
2. 実装と同じ入出力の関数を Lean で書く。
3. 守りたい性質を `theorem` として書き、証明する。
4. 判定する。

   ```sh
   lake build 2>&1 | tee build.log
   ! grep -q "declaration uses 'sorry'" build.log
   ```

   追加した `axiom` に依存していないことを `#print axioms <theorem 名>` で確かめる。出てよいのは `propext`、`Classical.choice`、`Quot.sound` だけ。

## 実装との対応

証明が保証するのは Lean の関数の性質であり、実装の性質ではない。Lean の関数を `lean_exe` にして、入力の JSON を受けて出力の JSON を返す実行ファイルにする。実装側の property-based test で入力を生成し、実装と Lean の実行ファイルの出力が一致することを確かめる。

判定するコマンドは、`lake build` と `sorry` の検査、差分の property-based test の 3 つ。
