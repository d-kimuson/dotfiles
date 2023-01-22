#!/bin/bash

# dotfiles は clone されて、make setup されている前提
# されてないとこのスクリプトにもアクセスできないので...

function setup() {
  echo "Executes setup process for the $OS_IDENTIFY."
  
  setup-package-manager # もしかしたら password とか求められちゃうかも...
  setup-zsh
  setup-starship
  setup-utils
  
  if [ "$OS_IDENTIFY" = "mac-m1" ]; then
    echo "setup for m1mac (debug)"
    setup-m1mac
    elif [ "$OS_IDENTIFY" = "ubuntu" ]; then
    setup-ubuntu
  else
    echo "Since the setup function for the $OS_IDENTIFY is not defined, so skipped."
  fi
  
  echo "Performs common setup process."
  
  setup-github
  setup-anyenv
}

# ====================
# common
# ====================

function setup-package-manager() {
  if [ "$OS_IDENTIFY" = "ubuntu" ]; then
    sudo apt update
    sudo apt upgrade -y
    elif [ "$OS_IDENTIFY" = "mac-m1" ]; then
    brew update && brew upgrade
  fi
}

function setup-zsh() {
  if [ "$(echo $SHELL | grep zsh)" = "" ]; then
    if [ "$OS_IDENTIFY" = "ubuntu" ]; then
      sudo apt install zsh -y
      chsh -s $(which zsh)
    fi
  fi
  
  # exec $SHELL -l とかしちゃうと次移行が実行できないのでやらない
}

function setup-github() {
  echo "Github の SSH 設定"
  
  if [ "$(cat ~/.ssh/config | grep "Host github")" != "" ]; then
    echo "Host github already exists, skipped."
    return
  fi
  
  cd ~/.ssh
  ssh-keygen -t ed25519 -C "dev.kimuson@gmail.com"  # name: github
  echo "Host github github.com" >> ~/.ssh/config
  echo "  HostName github.com" >> ~/.ssh/config
  echo "  IdentityFile ~/.ssh/github" >> ~/.ssh/config
  echo "  User git" >> ~/.ssh/config
  
  # Github へのキー追加は手動でやってね
  echo "Github へ公開鍵を登録してね"
  echo "登録したら、`ssh -T git@github.com` で接続チェック"
}

function setup-starship() {
  if [[ -x `which starship` ]]; then
    echo "skipped starship installatoin, because already installed."
  else
    curl -sS https://starship.rs/install.sh | sh
  fi
}

function setup-utils() {
  curl https://sh.rustup.rs -sSf | sh
  source $HOME/.cargo/env
  
  if [ $OS_IDENTIFY = "ubuntu" ]; then
    sudo apt install colordiff fd-find bat lsd exa -y
    elif [ $OS_IDENTIFY = "mac-m1" ]; then
    brew install colordiff fd bat exa lsd -y
  fi
}

function setup-anyenv() {
  if [ "$(ls -a ~ | grep anyenv)" = "" ]; then
    git clone https://github.com/anyenv/anyenv ~/.anyenv
    ~/.anyenv/bin/anyenv init
  else
    echo "skipped anyenv installatoin, because already installed."
  fi
  
  echo "execute: setup-anyenv-2"
  echo $SHELL -l
}

function setup-anyenv-2() {
  anyenv install --init
  anyenv install nodenv
  anyenv install pyenv
  
  echo "execute: setup-anyenv-3"
  echo $SHELL -l
}

function setup-anyenv-3() {
  nodenv install 18.3.0
  nodenv global 18.3.0
  anyenv install pyenv
}

function setup-anyenv-3() {
  # nodenv
  nodenv install 18.3.0
  nodenv global 18.3.0
  
  # pyenv
  pyenv install 3.10.2
  pyenv global 3.10.2
  pip install --upgrade pip
}

# ====================
# For envs
# ====================

function setup-m1mac() {
  # replace
  brew install coreutils diffutils ed findutils gawk gnu-sed gnu-tar grep gzip
  
  # utility
  brew install ag jq lv parallel pandoc sift wget wdiff --with-gettext xmlstarlet
  
  # to be latest
  brew install nano unzip
}

function setup-ubuntu() {
  # zsh & prezeto
  sudo apt install make gcc -y
  sudo apt install -y zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev
}
