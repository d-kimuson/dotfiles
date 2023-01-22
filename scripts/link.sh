#/bin/bash

set -eu

args=("$@")
argn=$#

for i in $(seq $argn); do
  item=${args[$i-1]}
  
  if [ -e ~/$item ]; then
    echo "~/$item is already exists, so skipped."
  else
    ln -sf ~/dotfiles/$item ~/$item
    echo "~/$item is linked."
  fi
done
