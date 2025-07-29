# Dotfiles Manager v2

TypeScriptで実装されたdotfilesマネージャーです。

## 機能

- シェルスクリプト（エイリアスと関数）の生成

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles

# 依存関係のインストール
pnpm i
```

## 使い方

### シェルスクリプトの生成

```bash
pnpm build
```

これにより、`output/shell_aliases.sh`ファイルが生成されます。

そして、`.zshrc`や`.bashrc`に以下を追加します：

```bash
source ~/dotfiles/dotfiles_manager_v2/output/shell_aliases.sh
```

## 開発

```bash
# 開発モードで実行（ファイル変更を監視）
pnpm dev

# テスト実行
pnpm test

# 型チェック
pnpm lint
```

## ライセンス

ISC 