#/bin/bash

if [ $(which make | grep make) = "" ]; then
  if [ $OS_IDENTIFY = "ubuntu" ]; then
    sudo apt install make -y
    elif [ $OS_IDENTIFY = "mac-m1" ]; then
    brew install make
  fi
fi

make setup
