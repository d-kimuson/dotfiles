#!/bin/bash

function setup-m1mac() {
  # replace
  brew install coreutils diffutils ed findutils gawk gnu-sed gnu-tar grep gzip

  # utility
  brew install ag jq lv parallel pandoc sift wget wdiff --with-gettext xmlstarlet

  # to be latest
  brew install nano unzip
}
