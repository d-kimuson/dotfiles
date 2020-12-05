#!/bin/bash

# ====================
# Alias
# ====================

alias d='docker'
alias dcmp='docker-compose'

# ====================
# Functions
# ====================

function dkill () {
  # Usage
  # - dkill: コンテナの全削除
  # - dkill <コンテナ名>: 指定のコンテナを削除
  if [ -z "$1" ]; then
    docker rm -f `docker ps -aq`
  else
    docker rm -f $1
  fi
}

function dkilli () {
  # Usage
  # - dkill: イメージの全削除
  # - dkill <イメージ名>: 指定のイメージを削除
  if [ -z "$1" ]; then
    docker rmi `docker images -aq`
  else
    docker rmi -f $1
  fi
}

function dbash() {
  # 起動中のコンテナに bash で入る
  # Usage: dbash <コンテナ名>
  docker exec -it $1 bash
}

function dlog() {
  # コンテナのログを逐次表示
  # Usage: dlog <コンテナ名>
  docker logs -f $1
}

function cont-ubuntu () {
  # ubuntu:latest からコンテナをデーモン起動し、bash で入る
  if [ -z "$1" ]; then
    container_name="test_ubuntu"
  else
    container_name=$1
  fi
  
  docker pull ubuntu:latest
  docker run -it -d --name $container_name ubuntu
  docker exec -it $container_name bash
}