# Dotfiles

シェル周りの設定リポジトリ、`$HOME/dotfiles` に設置してシンボリックリンクを貼ることで適用できる

## Requirements

- [direnv](https://direnv.net/docs/installation.html)
  - `brew install direnv`, `sudo apt install direnv`
- [starship](https://starship.rs/ja-JP/guide/#%F0%9F%9A%80-installation)
  - `curl -sS https://starship.rs/install.sh | sh`
- [mise](https://mise.jdx.dev/getting-started.html)
  - `curl https://mise.run | sh`
- [Claude Code](https://docs.anthropic.com/ja/docs/claude-code/setup)
  - `curl -fsSL https://claude.ai/install.sh | bash`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
  - `brew install gemini-cli`, `npm install -g @google/gemini-cli`
- gh
  - `brew install gh`, `sudo apt install gh`

## Installation

```bash
cd $HOME
git clone git@github.com:d-kimuson/dotfiles.git
```

## Setup

```bash
./scripts/sync.sh
exec $SHELL -l
mise use node@22 -g
mise use python@latest -g
./scripts/claude_code_mcp.sh
```

以下のファイルは symlink できない(すべきでない)ので手動でコピー等する

- [claude-code/settings.json](./claude-code/settings.json)
  - 対象: `~/.claude/settings.json`

## Alias Manager のビルド

Alias Manager を更新した場合は、以下のコマンドでビルドしてください：

```bash
$ cd alias-manager
$ pnpm i
$ pnpm build
```

ビルド成果物は `alias-manager/output/shell_aliases.sh` に生成され、`.zshrc` から読み込まれます。

> 注意: dotfiles setup 時（`sync.sh` 実行時）はビルドは実行されません。  
> 事前にコミットされたビルド成果物を使用するため、変更時は手動でビルドしてコミットしてください。

## リポジトリに載せない設定を書く

認証情報や、端末固有のパスなどの情報は、`.localrc` に記述する
