#!/bin/bash

function ssh-keygen-strong {
  printf "Input key file name >> "; read filename
  ssh-keygen -t rsa -b 4096 -f $filename
  
  chmod 600 $filename; chmod 600 $filename.pub
}
