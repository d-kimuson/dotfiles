#!/bin/bash

# ====================
# Env Variables
# ====================

# ====================
# Alias
# ====================

# ====================
# Functions
# ====================

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

function pnpm-init() {
  declare -a project_name_tokens=()
  printf "ディレクトリ名を指定してください >> "; read project_name_tokens
  PROJECT_NAME=$(echo $project_name_tokens)
  
  git clone git@github.com:d-kimuson/pnpm-boilerplate.git $PROJECT_NAME
  cd $PROJECT_NAME
  ./scripts/setup_repository.sh
  
  code .
}
