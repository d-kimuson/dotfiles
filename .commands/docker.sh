#!/bin/bash

# ====================
# Alias
# ====================

alias d='docker'
alias dcmp='docker-compose'

# ====================
# Functions
# ====================

function lima-status() {
  if [ "$(limactl list | grep 'docker' | grep 'Running')" != "" ]; then
    echo "running"
    elif [ "$(limactl list | grep 'docker' | grep 'Stopped')" != "" ]; then
    echo "stopped"
  else
    echo "deleted"
  fi
}

function start-lima() {
  LIMA_STATUS=$(lima-status)
  if [ "$LIMA_STATUS" = "running" ]; then
    echo "lima is already runninng."
    elif [ "$LIMA_STATUS" = "stopped" ]; then
    cd ~/dotfiles/config/lima && limactl start docker && cd -
  else
    cd ~/dotfiles/config/lima && limactl start ./docker.yaml && cd -
  fi
}

function stop-lima() {
  # 現状わざわざ stop するのは壊れて再起動したいときくらいなので削除までまとめちゃう
  LIMA_STATUS=$(lima-status)
  
  if [ "$LIMA_STATUS" = "running" ]; then
    limactl stop -f docker
  fi
  
  limactl delete docker
}

function restart-lima() {
  stop-lima
  start-lima
}

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