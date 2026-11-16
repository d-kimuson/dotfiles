---
name: eli5
description: 1 つの概念や仕組みを、その部分を何も知らない人に図で説明するときに使う
---

# ELI5

その部分を何も知らない人に向けて、大きな図と少ない言葉の HTML 1 ページで説明する。ページは `dev-process-kit` skill で作る。本人のコメントは質問として受け取り、言葉で答えるか、ページを直す。

## 書く

- 1 ページで扱う概念は 1 つにする。複数の概念とその関係なら、解説動画 (`explainer-video` playbook) を勧める。
- 図を主役にする。文章は図のラベルと短い添え書きに留め、段落で説明しない。
- 比喩を使うなら比喩だと分かるように書く。
- 不確かな事実は一次資料で確かめる。
- テンプレートは `dev-process-kit` skill の手順で選ぶ。構造や流れは図の board (architecture-map、sequence-diagram、state-diagram など)、段階を追う説明は `slides` にする。

## 置き場所と公開

呼び出し元が出力先を指定したらそこに書く。指定がなければスクラッチパッドに書く。

公開は `dev-process-kit` skill の手順に従う (Artifact ツールがあれば Artifact、なければファイルのパスを渡す)。直したら同じ Artifact に公開し直し、同じ URL を保つ。
