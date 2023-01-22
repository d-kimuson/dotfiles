#!/bin/bash

# ====================
# Env Variables
# ====================

export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1
export PATH="$HOME/.poetry/bin:$PATH"

# ====================
# Alias
# ====================

# python
alias python2='/usr/bin/python'
alias py='python'
alias pyreq='touch requirements.txt && /bin/rm requirements.txt && pip freeze > requirements.txt'
alias ve-init='python -m venv .venv && source .venv/bin/activate && pip install --upgrade pip'

# Django
alias dj='python manage.py'

# ====================
# Functions
# ====================

function mpy() {
  mypy $1 && python $1
}

function pyinstall() {
  pip install $1 && pyreq
}

function pyuninstall() {
  pip uninstall $1 && pyreq
}

function ve() {
  if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
  else
    echo "仮想環境が見つかりません"
    printf "新しく作成しますか ? (y/n) >> "; read ans
    if [ $ans = "y" ]; then
      ve-init
    else
      return 1
    fi
  fi
}

function ve-jupyter {
  # 仮想環境で、Jupyter を動かす一連の操作をまとめる
  
  if [ "$VIRTUAL_ENV" = "" ]; then
    # 仮想環境がアクティベートされてない場合は、有効化する
    ve
  fi
  
  if [ "$VIRTUAL_ENV" = "" ]; then
    # 仮想環境が準備されなかった場合は、終了する
    return 1
  fi
  
  pip install jupyter ipykernel
  printf "What is kernel name ? >> "; read KERNEL_NAME
  python -m ipykernel install --user --name=$KERNEL_NAME
  python -m jupyter notebook
}
