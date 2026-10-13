# pueue kill で子プロセスが orphan として残る

## Symptom

`pueue add` で起動したタスクがさらに子プロセスを起動する構成 (`portless <name> <cmd>` で `cmd` がサーバープロセスを起動するなど) で `pueue kill` すると、ラッパー自体は止まるが起動された子プロセス (例: `llama-server`) が orphan として残り、ポートを listen し続ける。手動で kill する必要がある。

同じ構成 (`portless` 経由で子プロセスを起動) を launchd agent で動かし `launchctl kickstart -k` した場合は、子プロセスも含めて終了し、orphan は残らなかった。

## Workaround

`pueue` でラッパースクリプト越しに子プロセスを起動する構成は避ける。常駐させたいなら launchd (`launchd.agents.*`) など、プロセスグループ全体を終了できる仕組みを使う。
`pueue kill` 後に orphan が残った場合は `pgrep`/`lsof -i` などでポートを握っているプロセスを探して個別に kill する。

## Why Not Fixed

pueue が子プロセスをどこまで追跡して終了させるかは pueue 側の実装。常駐サーバーには pueue を使わない方針にした (`docs/features/local-llm.md` は launchd を採用)。
