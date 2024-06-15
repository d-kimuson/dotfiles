#!/usr/bin/env bash

# ====================
# Activate tools
# ====================
# TODO: build & push 周りがちゃんとできたら適切なパスに変える
~/dotfiles/dotfiles_manager/target/debug/dotfiles-manager activate | source /dev/stdin

eval "$(mise activate --shims)"
eval "$(starship init zsh)"
eval "$(direnv hook zsh)"

# ====================
# auto completion
# ====================
if [ -s "/Users/kaito/.bun/_bun" ]; then
  source "/Users/kaito/.bun/_bun"
fi

# ====================
# PATH
# ====================
path=(
  ${path}
  $HOME/bin
  $BUN_INSTALL/bin
)

if [ "$(get_os)" = "mac-m1" ]; then
  export PATH="$PATH:/opt/homebrew/bin"
fi

# ====================
# Env variables
# ====================

export STARSHIP_CONFIG=~/dotfiles/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker
export PNPM_HOME="$HOME/Library/pnpm"
export BUN_INSTALL="$HOME/.bun"

case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# ====================
# Env Dependent
# ====================
OS_IDENTIFY=$(get_os)
if [ "$OS_IDENTIFY" = "mac-m1" ]; then
  export DOCKER_HOST="unix:///$HOME/.colima/default/docker.sock"
  
  BRER_PREFIX="/opt/homebrew"
  
  path=(
    $BRER_PREFIX/opt/coreutils/libexec/gnubin(N-/) # coreutils
    $BRER_PREFIX/opt/ed/libexec/gnubin(N-/) # ed
    $BRER_PREFIX/opt/findutils/libexec/gnubin(N-/) # findutils
    $BRER_PREFIX/opt/gnu-sed/libexec/gnubin(N-/) # sed
    $BRER_PREFIX/opt/gnu-tar/libexec/gnubin(N-/) # tar
    $BRER_PREFIX/opt/grep/libexec/gnubin(N-/) # grep
    ${path}
  )
  manpath=(
    $BRER_PREFIX/opt/coreutils/libexec/gnuman(N-/) # coreutils
    $BRER_PREFIX/opt/ed/libexec/gnuman(N-/) # ed
    $BRER_PREFIX/opt/findutils/libexec/gnuman(N-/) # findutils
    $BRER_PREFIX/opt/gnu-sed/libexec/gnuman(N-/) # sed
    $BRER_PREFIX/opt/gnu-tar/libexec/gnuman(N-/) # tar
    $BRER_PREFIX/opt/grep/libexec/gnuman(N-/) # grep
    ${manpath}
  )
  elif [ "$OS_IDENTIFY" = "ubuntu" ]; then
  export CFLAGS=-I/usr/include/openssl
  export LDFLAGS=-L/usr/lib
  alias fd="fd-find"
  
  zstyle ':completion:*:*:git:*' script ~/.zsh/git-completion.bash
  fpath=(~/.zsh $fpath)
  autoload -Uz compinit && compinit
fi

# ====================
# local
# ====================
if [ -f ~/.localrc ]; then
  source ~/.localrc
fi
