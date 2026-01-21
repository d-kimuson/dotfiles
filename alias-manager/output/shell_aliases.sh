alias l="exa";
alias tree="lsd --tree";
alias reload="exec $SHELL -l";
alias diffy="colordiff -y --left-column";
alias diffx="colordiff -u";
alias cda="cd ~/Apps";
alias cdp="cd ~/Playground";
alias myip="ifconfig | grep 192 | cut -f 2 -d ' '";
alias d="docker";
alias dcmp="docker compose";
alias g="git";
alias gblog="git log --oneline main..";
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
function install-compose() {
  mkdir -p $DOCKER_CONFIG/cli-plugins
  curl -SL https://github.com/docker/compose/releases/download/v2.23.1/docker-compose-darwin-aarch64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
  chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
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
function dsh() {
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker exec -it $1 sh
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
function gautofixup() {
  if [ -z "$1" ]; then
    echo "required commit hash";
    return 1;
  fi
  git commit --fixup $1
  git rebase -i --autosquash $1~1
}
function gback() {
  if [ -z "$1" ]; then
    echo "required commit hash";
    return 1;
  fi
  git reset --hard ${1};
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
function setup_m1mac() {
  brew update && brew upgrade
  # replace
  brew install coreutils diffutils ed findutils gawk gnu-sed gnu-tar grep gzip
  # utility
  brew install ag jq lv parallel pandoc sift wget wdiff xmlstarlet
  # to be latest
  brew install nano unzip
  # rust
  curl https://sh.rustup.rs -sSf | sh
  source $HOME/.cargo/env
}
function setup_ubuntu() {
  sudo apt update
  sudo apt upgrade -y
  sudo apt install zsh -y
  chsh -s $(which zsh)
  sudo apt install make gcc -y
  sudo apt install -y zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev
  curl https://sh.rustup.rs -sSf | sh
  source $HOME/.cargo/env
}