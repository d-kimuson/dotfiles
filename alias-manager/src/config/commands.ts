import { AliasDeclaration, fn, FunctionDeclaration } from '../commands/types.js';

export function getAliases(): AliasDeclaration[] {
  return [
    // regular
    {
      name: 'l',
      definition: 'exa',
    },
    {
      name: 'tree',
      definition: 'lsd --tree',
    },
    {
      name: 'reload',
      definition: 'exec $SHELL -l',
    },
    {
      name: 'diffy',
      definition: 'colordiff -y --left-column',
    },
    {
      name: 'diffx',
      definition: 'colordiff -u',
    },
    {
      name: 'cda',
      definition: 'cd ~/Apps',
    },
    {
      name: 'cdp',
      definition: 'cd ~/Playground',
    },
    {
      name: 'myip',
      definition: 'ifconfig | grep 192 | cut -f 2 -d \' \'',
    },
    // docker
    {
      name: 'd',
      definition: 'docker',
    },
    {
      name: 'dcmp',
      definition: 'docker compose',
    },
    // git
    {
      name: 'g',
      definition: 'git',
    },
    // 元のdotfiles_managerのエイリアスのみを残す
    {
      name: 'gblog',
      definition: 'git log --oneline main..',
    },
    {
      name: 'gpush',
      definition: 'git push origin HEAD',
    },
    {
      name: 'gpushf',
      definition: 'git push origin HEAD --force-with-lease',
    },
    {
      name: 'gunadd',
      definition: 'git restore --staged',
    },
    {
      name: 'guncom',
      definition: 'git rm -rf --cached',
    },
  ];
}

const c = fn('c', /* bash */`
  if [ -z "$1" ]; then
    echo "required file path";
    return 1;
  fi
  bat --pager '' $1
`)

const get_os = fn('get_os', /* bash */`
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
`)

const kill_port = fn('kill-port', /* bash */`
  if [ -z "$1" ]; then
    echo "required port number";
    return 1;
  fi
  lsof -ti tcp:$1 | xargs kill -9
`)

const install_compose = fn('install-compose', /* bash */`
  mkdir -p $DOCKER_CONFIG/cli-plugins
  curl -SL https://github.com/docker/compose/releases/download/v2.23.1/docker-compose-darwin-aarch64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
  chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
`)

const colima_start = fn('colima-start', /* bash */`
  colima start --cpu \${COLIMA_CPU:-6} --memory \${COLIMA_MEMORY:-12} --disk \${COLIMA_DISK:-120} \\
  --arch aarch64 \\
  --vm-type vz --vz-rosetta --mount-type virtiofs --mount-inotify\\
  --mount $HOME/sms/:w\\
  --mount $HOME/officefrontier/:w\\
  --mount $HOME/Apps/:w\\
  --mount $HOME/Playground/:w
`)

const dkill_all = fn('dkill_all', /* bash */`
  docker rm -f $(docker ps -aq)
`)

const dkill = fn('dkill', /* bash */`
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker rm -f $1
`)

const dkilli_all = fn('dkilli_all', /* bash */`
  docker rmi $(docker images -aq)
`)

const dkilli = fn('dkilli', /* bash */`
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker rmi -f $1
`)

const dbash = fn('dbash', /* bash */`
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker exec -it $1 bash
`)

const dsh = fn('dsh', /* bash */`
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker exec -it $1 sh
`)

const dlog = fn('dlog', /* bash */`
  if [ -z "$1" ]; then
    echo "required container id or name";
    return 1;
  fi
  docker logs -f $1
`)

const gadd = fn('gadd', /* bash */`
  if [ -z "$1" ]; then
    echo "required file path";
    return 1;
  fi
  git add $1 && git status
`)

const gcd = fn('gcd', /* bash */`
  cd $(git rev-parse --show-toplevel)
`)

const gpull = fn('gpull', /* bash */`
  git pull --rebase origin $(git rev-parse --abbrev-ref HEAD)
`)

const gautofixup = fn('gautofixup', /* bash */`
  if [ -z "$1" ]; then
    echo "required commit hash";
    return 1;
  fi
  git commit --fixup $1
  git rebase -i --autosquash $1~1
`)

const gback = fn('gback', /* bash */`
  if [ -z "$1" ]; then
    echo "required commit hash";
    return 1;
  fi
  git reset --hard \${1};
`)

const gignore = fn('gignore', /* bash */`
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
`)

const setup_m1mac = fn('setup_m1mac', /* bash */`
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
`)

const setup_ubuntu = fn('setup_ubuntu', /* bash */`
  sudo apt update
  sudo apt upgrade -y
  sudo apt install zsh -y
  chsh -s $(which zsh)
  sudo apt install make gcc -y
  sudo apt install -y zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev
  curl https://sh.rustup.rs -sSf | sh
  source $HOME/.cargo/env
`)

export function getFunctions(): FunctionDeclaration[] {
  return [
    c,
    get_os,
    kill_port,
    install_compose,
    colima_start,
    dkill_all,
    dkill,
    dkilli_all,
    dkilli,
    dbash,
    dsh,
    dlog,
    gadd,
    gcd,
    gpull,
    gautofixup,
    gback,
    gignore,
    setup_m1mac,
    setup_ubuntu
  ];
} 