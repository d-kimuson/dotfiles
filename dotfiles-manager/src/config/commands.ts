import { AliasDeclaration, FunctionDeclaration } from '../commands/types.js';

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
    {
      name: 'gpull',
      definition: 'git pull origin HEAD',
    },
  ];
}

export function getFunctions(): FunctionDeclaration[] {
  return [
    // 元のdotfiles_managerの関数のみを残す
    {
      name: 'c',
      definition: `
  if [ -z "$1" ]; then
  echo "required file path";
  return 1;
  fi
  bat --pager '' $1
`,
    },
    {
      name: 'get_os',
      definition: `
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
`,
    },
    {
      name: 'kill-port',
      definition: `
  if [ -z "$1" ]; then
  echo "required port number";
  return 1;
  fi
  lsof -i :$1 | awk -F " " '{ print $2 }' | grep -v "PID" | xargs kill -9
`,
    },
    {
      name: 'install-compose',
      definition: `
  mkdir -p $DOCKER_CONFIG/cli-plugins
  curl -SL https://github.com/docker/compose/releases/download/v2.23.1/docker-compose-darwin-aarch64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
  chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
`,
    },
    {
      name: 'colima-start',
      definition: `
  colima start --cpu \${COLIMA_CPU:-6} --memory \${COLIMA_MEMORY:-12} --disk \${COLIMA_DISK:-120} \\
  --arch aarch64 \\
  --vm-type vz --vz-rosetta --mount-type virtiofs --mount-inotify\\
  --mount $HOME/sms/:w\\
  --mount $HOME/Apps/:w\\
  --mount $HOME/Playground/:w
`,
    },
    {
      name: 'dkill_all',
      definition: `
  docker rm -f $(docker ps -aq)
`,
    },
    {
      name: 'dkill',
      definition: `
  if [ -z "$1" ]; then
  echo "required container id or name";
  return 1;
  fi
  docker rm -f $1
`,
    },
    {
      name: 'dkilli_all',
      definition: `
  docker rmi $(docker images -aq)
`,
    },
    {
      name: 'dkilli',
      definition: `
  if [ -z "$1" ]; then
  echo "required container id or name";
  return 1;
  fi
  docker rmi -f $1
`,
    },
    {
      name: 'dbash',
      definition: `
  if [ -z "$1" ]; then
  echo "required container id or name";
  return 1;
  fi
  docker exec -it $1 bash
`,
    },
    {
      name: 'dsh',
      definition: `
  if [ -z "$1" ]; then
  echo "required container id or name";
  return 1;
  fi
  docker exec -it $1 sh
`,
    },
    {
      name: 'dlog',
      definition: `
  if [ -z "$1" ]; then
  echo "required container id or name";
  return 1;
  fi
  docker logs -f $1
`,
    },
    {
      name: 'gadd',
      definition: `
  if [ -z "$1" ]; then
  echo "required file path";
  return 1;
  fi
  git add $1 && git status
`,
    },
    {
      name: 'gcd',
      definition: `
  cd $(git rev-parse --show-toplevel)
`,
    },
    {
      name: 'gpull',
      definition: `
  git fetch && git merge origin/$(git rev-parse --abbrev-ref HEAD)
`,
    },
    {
      name: 'gautofixup',
      definition: `
  if [ -z "$1" ]; then
  echo "required commit hash";
  return 1;
  fi
  git commit --fixup $1
  git rebase -i --autosquash $1~1
`,
    },
    {
      name: 'gback',
      definition: `
  if [ -z "$1" ]; then
  echo "required commit hash";
  return 1;
  fi
  git reset --hard \${1};
`,
    },
    {
      name: 'gignore',
      definition: `
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
`,
    },
    {
      name: 'setup_m1mac',
      definition: `
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
`,
    },
    {
      name: 'setup_ubuntu',
      definition: `
  sudo apt update
  sudo apt upgrade -y
  sudo apt install zsh -y
  chsh -s $(which zsh)
  sudo apt install make gcc -y
  sudo apt install -y zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev
  curl https://sh.rustup.rs -sSf | sh
  source $HOME/.cargo/env
`,
    },
  ];
} 