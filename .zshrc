# ====================
# Functions
# ====================
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

# ====================
# Env Dependent
# ====================
OS_IDENTIFY=$(get_os)
if [ $OS_IDENTIFY = "mac-m1" ]; then
  source ~/dotfiles/environment/mac-m1rc
fi

# ====================
# anyenv
# ====================
# export PATH="$HOME/.anyenv/bin:$PATH"

eval "$(mise activate --shims)"
# eval "$(anyenv init -)"
# eval "$(mise activate)"
# eval "$(nodenv init -)"

# ====================
# Env variables
# ====================
export STARSHIP_CONFIG=~/dotfiles/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker

# ====================
# Load .commands files
# ====================
if [ -f ~/.commandsrc ]; then
  source ~/.commandsrc
fi

# ====================
# local
# ====================
if [ -f ~/.localrc ]; then
  source ~/.localrc
fi

# ====================
# Activate tools
# ====================
eval "$(starship init zsh)"
eval "$(direnv hook zsh)"

# pnpm global
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
