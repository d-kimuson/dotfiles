# Source Prezto.
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
    source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

autoload -Uz promptinit
promptinit
prompt steeef

# Customize to your needs...

# Other Config Files
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi

if [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
fi

if [ -f ~/.commandsrc ]; then
    source ~/.commandsrc
fi

# PATH
export PATH=/Library/TeX/texbin:$PATH
export PATH=$HOME/.nodebrew/current/bin:$PATH
export PATH=$PATH:/Users/kaito/Applications/phantomjs-2.1.1-macosx/bin
export PATH="$PATH:/usr/local/opt/llvm/bin"
export PATH=$PATH:/relativePath/to/play
export PATH="$PATH:$HOME/flutter/bin"
export PATH="$HOME/.cargo/bin:$PATH"

# Google Cloud Platform
# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/kaito/Downloads/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/kaito/Downloads/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/Users/kaito/Downloads/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/kaito/Downloads/google-cloud-sdk/completion.zsh.inc'; fi

# Pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# 環境変数
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1

if [ -f ~/.env_variable.secret ]; then
    source ~/.env_variable.secret
fi