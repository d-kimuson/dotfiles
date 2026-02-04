#!/usr/bin/env bash

chezmoi apply
home-manager switch

exec $SHELL -l
