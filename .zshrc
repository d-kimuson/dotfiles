# === Prezto ===
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

autoload -Uz promptinit
promptinit
prompt steeef

# === Load Other Config Files ===
if [ -f ~/.commandsrc ]; then
  source ~/.commandsrc
fi

# === Env Variables ===
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1
export NPM_CONFIG_PREFIX=~/.npm-global

if [ -f ~/.localrc ]; then
  source ~/.localrc
fi
