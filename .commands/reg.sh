#!/bin/bash

# ====================
# Alias
# ====================

alias diffy='diff -y --left-column'  # Github Like
alias diffg='diff -u'
alias fdir='find . -type d -name'    # 完全一致
alias ffile='find . -type f -name'
alias sdir='find . -type d | grep'   # 部分一致
alias sfile='find . -type f | grep'

# move to specfic directory
alias cdd='cd ~/Desktop'
alias cdp='cd ~/Playground'
alias cda='cd ~/Apps'

# 遊び
alias cal='\cal -NC3'
alias tenki='curl wttr.in/Chiba'

# ====================
# デフォルトコマンドの上書き
# より使いやすく互換性がある実行ファイルへの上書きをする
# 元のコマンドは \<cmd> で呼べる EX: \cat file
# TODO: やっぱり行儀悪いので消したい...
# ====================

if [[ -x `which lsd` ]]; then
  tree='lsd --tree'
fi

if [[ -x `which bat` ]]; then
  alias bcat='bat --pager ""'
fi

# ====================
# Functions
# ====================

if [[ "$OSTYPE" == "darwin"* ]]; then
  function del() {
    mv $1 ~/.Trash
  }
fi

function mcd() {
  mkdir $1 && cd $1
}

function replace() {
  # ファイルの文字列置換
  # Usage: replace <ファイルパス> 置換前 置換後
  sed -i -e "s/"$2"/"$3"/g" $1
  printf "バックアップファイルを削除しますか ? (y/n) >> "; read ans
  if [ $ans = "y" ]; then
    \rm $1-e
  fi
}

function mkv2mp4 {
  if [ $# -ne 1 ]; then
    echo "引数=>$#個" 1>&2
    echo "引数はhoge.mkvのみ" 1>&2
    exit 1
  fi
  
  if [ $1 = *.mkv ]; then
    TEXT=$1
    arr=(`echo $TEXT | tr -s '.' ' '`)
    tmp=".mp4"
    name=${arr[0]}$tmp
    ffmpeg -i $1 -pix_fmt yuv420p $name
  elif [ $1 = *.avi ]
  then
    TEXT2=$1
    arr2=( `echo $TEXT | tr -s '.' ' '`)
    tmp2=".mp4"
    name2=${arr2[0]}$tmp2
    ffmpeg -i $1 -pix_fmt yuv420p $name2
  else
    echo "拡張子がおかしい"
  fi
}
