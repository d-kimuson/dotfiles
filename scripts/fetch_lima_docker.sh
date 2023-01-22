#!/bin/bash

if [ -e ~/dotfiles/lima/docker.yaml ]; then
  rm ~/dotfiles/lima/docker.yaml
fi

curl "https://raw.githubusercontent.com/lima-vm/lima/master/examples/docker.yaml" >> ~/dotfiles/lima/docker.yaml
