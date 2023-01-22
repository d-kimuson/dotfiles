#/bin/bash

set -eu

args=("$@")
argn=$#

for i in $(seq $argn); do
  item=${args[$i-1]}
  
  if [ -e ~/$item ]; then
    if [ -L ~/$item ]; then
      unlink ~/$item
      echo "~/$item is unlinked."
    else
      echo "~/$item is exists, but it's not link so skipped."
    fi
  else
    echo "~/$item is not exists, so skipped."
  fi
done
