#!/bin/bash

REPO="d-kimuson/dotfiles"
OUTPUT_DIRECTORY="download"
OUTPUT_BINARY="dotfiles_manager"
BRANCH=${1:master}

ARTIFACT_NAME=""
if [ "$(uname)" == "Darwin" ] && [ "$(uname -m)" == "arm64" ]; then
  ARTIFACT_NAME="aarch64-apple-darwin-binary"
elif [ "$(uname)" == "Linux" ] && [ "$(uname -m)" == "x86_64" ]; then
  ARTIFACT_NAME="x86_64-unknown-linux-gnu"
else
  echo "Unsupported OS or architecture"
  exit 1
fi

# 最新のアーティファクトを取得
LATEST_RUN_ID=$(gh run list -R $REPO -b $BRANCH --json databaseId --jq '.[0].databaseId')

# アーティファクトをダウンロード
if [ -d "$OUTPUT_DIRECTORY" ]; then
  rm -rf $OUTPUT_DIRECTORY
fi
gh -R $REPO run download $LATEST_RUN_ID -n $ARTIFACT_NAME -D $OUTPUT_DIRECTORY

# 実行権限を付与し、インストール先に移動
chmod +x $OUTPUT_DIRECTORY/$OUTPUT_BINARY
sudo mv $OUTPUT_DIRECTORY/$OUTPUT_BINARY /usr/local/bin/$OUTPUT_BINARY

# クリーンアップ
rm -rf $OUTPUT_DIRECTORY/$OUTPUT_BINARY

echo "$OUTPUT_BINARY has been installed to /usr/local/bin"
