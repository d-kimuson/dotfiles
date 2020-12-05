#!/bin/bash

# ====================
# Alias
# ====================

alias reload='source ~/.zshrc'
alias cedit='code ~/dotfiles/.commands'

# ====================
# Functions
# ====================

function cls() {
  # Usage
  # - cls: コマンドファイル一覧の表示
  # - cls <filename>: ファイルで指定されているエイリアス/関数の表示
  #    EXAMPLE: cls python
  if [ -z "$1" ]; then
    ls ~/dotfiles/.commands | grep ".sh" | sed s/"\.sh"//g
  else
    \find ~/dotfiles/.commands -type f -name $1".sh"
    \find ~/dotfiles/.commands -type f -name $1".sh" | xargs cat | grep 'alias' | grep -v "cat"
    \find ~/dotfiles/.commands -type f -name $1".sh" | xargs cat | grep 'function' | awk '{print $1, $2}' | grep -v "cat"
  fi
}
