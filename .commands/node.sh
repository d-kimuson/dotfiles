#!/bin/bash

function nestg() {
  nest g module $1
  nest g service $1
  nest g controller $1
}

function yarn-v3-init() {
  yarn init -y
  yarn set version berry
  touch yarn.lock

  echo "nodeLinker: node-modules" >> ./.yarnrc.yml

  if [ ! -f ./.gitignore ]; then
    touch .gitignore
  fi

  echo "# yarn v3" >> .gitignore
  echo ".yarn/cache" >> .gitignore
  echo ".yarn/unplugged" >> .gitignore
  echo ".yarn/build-state.yml" >> .gitignore
  echo ".yarn/install-state.gz" >> .gitignore

  yarn install
}

function yarn-v3-replace() {
  rm -rf yarn.lock node_modules **/node_modules
  yarn set version berry
  touch yarn.lock

  echo "nodeLinker: node-modules" >> ./.yarnrc.yml

  if [ ! -f ./.gitignore ]; then
    touch .gitignore
  fi

  echo "# yarn v3" >> .gitignore
  echo ".yarn/cache" >> .gitignore
  echo ".yarn/unplugged" >> .gitignore
  echo ".yarn/build-state.yml" >> .gitignore
  echo ".yarn/install-state.gz" >> .gitignore

  yarn install
}
