# === Prezto ===
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

autoload -Uz promptinit
promptinit
prompt steeef

# === Load Other Config Files ===
if [ -f ~/.bashrc ]; then
  source ~/.bashrc
fi

if [ -f ~/.bash_profile ]; then
  source ~/.bash_profile
fi

if [ -f ~/.commandsrc ]; then
  source ~/.commandsrc
fi

# === Env Variables ===
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1
export NPM_CONFIG_PREFIX=~/.npm-global

eval "$(anyenv init -)"

# os dependent
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

export OS_IDENTIFY=$(get_os)

if [ $OS_IDENTIFY = "mac-m1" ]; then
  source ~/dotfiles/environment/mac-m1rc
fi

# local

if [ -f ~/.localrc ]; then
  source ~/.localrc
fi
