---
name: product-manage
description: Context Store から本人の判断が要る事項を選び、Personal Task Board に積むときに使う
---

# product-manage

Context Store から本人の判断待ちの事項を 5 件ほど選び、Personal Task Board に積む。

Context ディレクトリの選び方とファイルは `~/.agents/references/contexts.md` に、盤面の操作は `~/.agents/playbooks/personal-task-board/PLAYBOOK.md` に従う。

1. `PROFILE.md` の優先順位と原則、`INDEX.md` を読み、未決の論点がありそうなトピックの `topics/<topic>.md` を開く。
2. `board.ts list` で盤面を見て、既にカードがある事項を候補から外す。
3. 候補を、本人の判断が他の人や作業を止めている度合いと、優先順位・原則との関係で並べ、5 件ほどに絞る。ほかの事項の前提になる判断を先にする。
4. 1 件ずつ `todo` 列に `判断` タグで積む。title は決めることを問いの形で書く。description に選択肢、判断の材料、止まっているもの、`topics/<topic>.md` のパスを書く。出典の URL は `--link` で付ける。
5. 選ばなかった候補を 1 行ずつ挙げ、ページの URL と一緒に本人に渡す。
