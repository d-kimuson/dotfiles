# Quint の基本手順

1. 対象の状態、遷移、守りたい不変条件だけを書き出す。実装の詳細は入れない。
2. モデルを書く。`init` (初期状態)、`step` (遷移)、不変条件の `val` を持つ module にする。Quint は `npm i @informalsystems/quint -g` で入る。
3. `quint typecheck model.qnt` で型を通す。
4. 反例を探す。まず速いシミュレーションを使う。

   ```sh
   quint run model.qnt --invariant=<不変条件名> --max-steps=<N>
   ```

   違反が出れば、状態の列が表示される。どの action を取ったかも見たいときは `--mbt` を足す。
5. 違反が出なければ、`quint verify` で `--max-steps` (既定 10) までの全ての実行を調べる。JDK 21 以上が要る。モデル検査器 Apalache は自動で取得される。

   ```sh
   quint verify model.qnt --invariant=<不変条件名> --max-steps=<N>
   ```

   `[ok]` は、その歩数までに違反がないという意味。無限に成り立つ証明ではない。状態空間が小さく有限なら `--backend tlc` で TLC も使える。
6. 見つかった反例の手順を、実コードの example test に写して再現する。失敗 (Red) を確かめる (`red-test-first`)。モデル側にも同じ手順の `run <name>Test = ...` を書けば、`quint test model.qnt` で固定できる。
7. 実コードを修正し、モデルにも同じ修正を反映する。
8. example test が通ることと、モデルで `quint run` / `quint verify` が `[ok]` になることを、どちらも確かめる。
