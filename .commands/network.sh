#!/bin/bash

# ====================
# Alias
# ====================

alias myip='ifconfig | grep 192 | cut -f 2 -d " "'

# ====================
# Functions
# ====================

function kill-process-from-portnum() {
  lsof -i :$1 | awk -F " " '{ print $2 }' | grep -v "PID" | xargs kill -9
}

function kill-port() {
  printf "Input port number >> "; read PORT
  kill-process-from-portnum $PORT
}
