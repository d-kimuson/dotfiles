#!/bin/bash

function hub-url-raw() {
  # Github 上のファイルパスから生データのURLを取得する
  echo $1 | sed -e "s/github.com/raw.githubusercontent.com/g" | sed -e "s/blob\///g"
}

function hub-file() {
  # Github ファイルのURLから生データを出力する
  # EXAMPLE: hub-file https://github.com/user/repo/README.md > ./README.md
  hub-url-raw $1 | xargs curl
}

function hub-create() {
  # Github リポジトリを作成して、カレントディレクトリと紐付けて、push する
  gh repo create
  printf "Do you push current commit to created repo? (y/n) >> "; read ans;
  if [ "$ans" = "y" ]; then
    git push origin HEAD
  fi
}
