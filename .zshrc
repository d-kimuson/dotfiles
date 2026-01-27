#!/usr/bin/env bash

# ====================
# Initialize Manager
# ====================
source ~/dotfiles/alias-manager/output/shell_aliases.sh

# ====================
# SET PATH
# ====================
path=(
  ${path}
  $HOME/bin
  $BUN_INSTALL/bin
  $HOME/.local/bin
)

if [ ! -d $HOME/bin ]; then
  mkdir $HOME/bin
fi

if [ "$(get_os)" = "mac-m1" ]; then
  export PATH="$PATH:/opt/homebrew/bin"
fi

# ====================
# Activate tools
# ====================
eval "$(~/.local/bin/mise activate --shims)"
eval "$(starship init zsh)"
eval "$(direnv hook zsh)"

# ====================
# auto completion
# ====================
if [ -s "/Users/kaito/.bun/_bun" ]; then
  source "/Users/kaito/.bun/_bun"
fi

# ====================
# Env variables
# ====================

export STARSHIP_CONFIG=~/dotfiles/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker
export PNPM_HOME="$HOME/Library/pnpm"
export BUN_INSTALL="$HOME/.bun"
export DIRENV_WARN_TIMEOUT=1m

export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# ====================
# Env Dependent
# ====================
OS_IDENTIFY=$(get_os)
if [ "$OS_IDENTIFY" = "mac-m1" ]; then  
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

export PATH="$HOME/dotfiles/bin:$PATH"

# Claude Code
export CLAUDE_CODE_VERSION=2.1.19
export CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true

export LITELLM_PORT="8082"

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

# ====================
# local
# ====================
if [ -f ~/.localrc ]; then
  source ~/.localrc
fi
