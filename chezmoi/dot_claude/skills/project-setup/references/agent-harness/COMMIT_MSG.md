# コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) を採用する。

## 形式

```text
<type>(<scope>): <description>

[optional body]
```

## 言語

- `type` と `scope` は Conventional Commits に従い英語の識別子で書く。
- `description` と本文は日本語で書く。
- 敬語は使わず、簡潔な常体で書く。

## Types

| Type       | 用途                                    |
| ---------- | --------------------------------------- |
| `feat`     | 新機能・新しい能力の追加                |
| `fix`      | バグ修正                                |
| `refactor` | バグ修正でも機能追加でもないコード変更  |
| `chore`    | ビルド、ツール、依存関係、CI などの変更 |
| `docs`     | ドキュメントのみの変更                  |
| `test`     | テストの追加・更新                      |
| `perf`     | パフォーマンス改善                      |

## Scope

任意。変更対象のモジュールや機能領域を使う。

| Scope    | 対象領域                    |
| -------- | --------------------------- |
| `server` | Backend API (`src/server/`) |
| `web`    | Frontend SPA (`src/web/`)   |
| `lib`    | 共有ユーティリティ          |
| `build`  | ビルド設定・ツール          |
| `deps`   | 依存関係更新                |
| `docs`   | ドキュメント                |

## ルール

- 1 行目は `<type>(<scope>): <description>` にする。
- `scope` は必要なときだけ付ける。
- `description` は日本語で簡潔に書く。
- `description` の末尾に句点は付けない。
- 1 行目は 72 文字以内を目安にする。
- 本文には「何をしたか」よりも「なぜそうしたか」「判断の背景」を書く。
- 本文を書く場合も日本語で書く。

## 例

良い例:

- `feat(server): ユーザー取得 workflow を追加`
- `feat(web): TanStack Start ベースの routing に移行`
- `fix(server): 未認証時のレスポンス分岐を修正`
- `chore(deps): 依存関係を更新`
- `refactor(server): 認証判定を純粋関数へ分離`

本文ありの例:

```text
refactor(server): ユーザー更新処理を workflow に移動

routes に DB 操作と業務判断が混在していたため、HTTP 境界と
transaction script の責務を分離した。
```

悪い例:

- `Fixed bug`（type がなく曖昧）
- `feat: Add new feature for the user authentication system`（英語で、長く、粒度が曖昧）
- `update`（type がなく、変更内容が分からない）
