# Strongest verification

検証手段を、ごまかしの効かない側へ寄せる原則。

## 設計メモ

- 強さの順は example testing < ADT による型検査 < 形式証明・モデル検査。取れる範囲で強い側へ寄せ、弱い手段で済ませるときは理由を言う
- モデル検査の手順は原則に含めず、playbook `formal-modeling` に置く (手順なので)

## 推奨する Role

product-engineer、qae

本文: [PRINCIPLE.md](./PRINCIPLE.md)
