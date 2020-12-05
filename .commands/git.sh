#!/bin/bash

# ====================
# Alias
# ====================

alias g='git'
alias ghis='git reflog --date=local -n 10'
alias gdiff='git diff --name-only'
alias glog='git log --graph'
alias gpush='git push origin HEAD'
alias gcd='cd `git rev-parse --show-toplevel`'
alias gb='git branch'
alias gunadd='git restore --staged'  # ステージングを外す
alias guncom='git rm -rf --cached'   # コミットを外す
alias g-current-branch='git branch | grep "*" | cut -f 2 -d " "'
alias gpull='git fetch && git merge origin/`git branch | grep "*" | cut -f 2 -d " "`'

# ====================
# Functions
# ====================

function gadd() {
  # ステージングとステータス表示を同時に
  # Usage: gadd <対象>
  git add $1 && git status
}

function ginit() {
  # リポジトリ初期化の一連操作をまとめたもの
  #   1. リポジトリの初期化
  #   2. .gitignore の追加
  #   3. ライセンスの設定
  #   4. 上記を `initiali commit` でコミットする
  git init
  echo "Pleace setup gitignore"
  gignore
  printf "add LICENCE ?(y/n) >> "; read ans
  if [ "$ans" = "y" ]; then
    glicence
  fi
  git add . && git commit -m "initial commit" && git status
}

function gignore() {
  # https://github.com/github/gitignore のテンプレートから gitignore を生成する
  echo "一覧: https://github.com/github/gitignore"
  
  INPUT='INIT'
  while [ "$INPUT" != "q" ]; do
    printf "Select Ignore Template(Press q to quit) >> "; read INPUT
    
    if [ "$INPUT" != "q" ]; then
      touch .gitignore
      curl "https://raw.githubusercontent.com/github/gitignore/master/"$INPUT".gitignore" | grep -v '404' >> .gitignore
      cat .gitignore
    fi
  done
}

function glicence() {
  # templates 下に置いてある LICENSE をコピってくる
  # [TODO] 置いておくのばからしいので、リポジトリから拾ってくるようにしたほうが良さそう
  echo "-- Select LICENCE --"
  ls ~/dotfiles/.commands/templates/LICENCES
  printf ">> "; read LICENCE
  cp ~/dotfiles/.commands/templates/LICENCES/${LICENCE} ./
  mv ./${LICENCE} LICENCE
}

function gback() {
  # 指定のコミットまで戻る
  ghis;
  printf "where to back? >> "; read cn;
  git reset --hard ${cn};
}

function gfix() {
  # 直前のコミットメッセージを修正する
  git commit --amend
}
