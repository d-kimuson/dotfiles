#!/usr/bin/env bash

alias l="eza";
alias tree="lsd --tree";
alias reload="exec $SHELL -l";
alias diffy="colordiff -y --left-column";
alias diffx="colordiff -u";
alias myip="ifconfig | grep 192 | cut -f 2 -d ' '";
alias d="docker";
alias dcmp="docker compose";
alias g="git";
alias gpush="git push origin HEAD";
alias gpushf="git push origin HEAD --force-with-lease";
alias gunadd="git restore --staged";
alias guncom="git rm -rf --cached";

function c() {
  if [ -z "$1" ]; then
    echo "required file path";
    return 1;
  fi
  bat --pager '' $1
}

function get_os() {
  if [ "$(uname)" = "Darwin" ]; then
    if [ "$(which arch)" = "arch not found" ]; then
      os="mac-intel"
    else
      os="mac-m1"
    fi
  elif [ "$(uname)" = "Linux" ]; then
    if [ -e /etc/debian_version ] || [ -e /etc/debian_release ]; then
      if [ -e /etc/lsb-release ]; then
        os="ubuntu"
      else
        os="debian"
      fi
    elif [ -e /etc/centos-release ]; then
      os="centos"
    else
      os="unknown-linux"
    fi
  else
    os="unknown"
  fi
  echo $os
}

function kill-port() {
  if [ -z "$1" ]; then
    echo "required port number";
    return 1;
  fi
  lsof -ti tcp:$1 | xargs kill -9
}

function colima-start() {
  colima start --cpu ${COLIMA_CPU:-6} --memory ${COLIMA_MEMORY:-12} --disk ${COLIMA_DISK:-120} \
  --arch aarch64 \
  --vm-type vz --vz-rosetta --mount-type virtiofs --mount-inotify\
  --mount $HOME/sms/:w\
  --mount $HOME/officefrontier/:w\
  --mount $HOME/Apps/:w\
  --mount $HOME/Playground/:w
}

function dkill_all() {
  docker rm -f $(docker ps -aq)
}

function dkill() {
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker rm -f $1
}

function dkilli_all() {
  docker rmi $(docker images -aq)
}

function dkilli() {
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker rmi -f $1
}

function dbash() {
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker exec -it $1 bash
}

function dlog() {
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker logs -f $1
}

function gadd() {
  if [ -z "$1" ]; then
    echo "required file path";
    return 1;
  fi
  git add $1 && git status
}

function gcd() {
  cd $(git rev-parse --show-toplevel)
}

function gpull() {
  git pull --rebase origin $(git rev-parse --abbrev-ref HEAD)
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

# Claude Code
function start_litellm() {
  config_file= ~/dotfiles/litellm/litellm_config.default.yaml

  if [ -f ~/dotfiles/litellm/litellm_config.yaml ]; then
    config_file= ~/dotfiles/litellm/litellm_config.yaml
  fi

  docker run \
    -v $config_file:/app/config.yaml \
    -e OPENAI_API_KEY=$GLOBAL_OPENAI_API_KEY \
    -p 127.0.0.1:$LITELLM_PORT:4000 \
    --name litellm-proxy \
    --health-cmd='wget -q -O - http://127.0.0.1:4000/health || exit 1' \
    --health-interval=5s \
    --health-timeout=10s \
    --health-retries=5 \
    -d \
    ghcr.io/berriai/litellm:main-latest \
    --config /app/config.yaml --detailed_debug
}

function stop_litellm() {
  docker rm -f litellm-proxy
}

function restart_litellm() {
  stop_litellm
  start_litellm
}

function cc_litellm_activate() {
  local -r proxy_url="http://127.0.0.1:$LITELLM_PORT"

  export ANTHROPIC_BASE_URL="$proxy_url"
  export ANTHROPIC_MODEL="gpt-5"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="gpt-5-mini"
  export ANTHROPIC_DEFAULT_OPUS_MODEL="gpt-5"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="gpt-5"
}

function cc_litellm_deactivate() {
  unset ANTHROPIC_BASE_URL
  unset ANTHROPIC_MODEL
  unset ANTHROPIC_DEFAULT_HAIKU_MODEL
  unset ANTHROPIC_DEFAULT_OPUS_MODEL
  unset ANTHROPIC_DEFAULT_SONNET_MODEL
}
