# ローカル LLM

## 目的

llama.cpp で uncensored な Qwen3.6-35B-A3B を手元のマシンで動かし、同じマシン上の pi などから `https://llama.localhost` で使う。
M3 Pro 36GB を前提に組んでいる。
LLM を使っていない間はマシンを重くしない。

## 構成

```text
launchd (home-manager の launchd.agents.local-llm)
└── portless llama local-llm/serve.sh     # https://llama.localhost → 127.0.0.1:$PORT
    └── llama-server (ルータ)              # 常駐。モデルは持たない
        └── llama-server (モデルごとの子)  # リクエストで起動・読み込み、アイドルで sleep
```

| 要素 | 選定 | 理由 |
| --- | --- | --- |
| ランタイム | llama.cpp (nixpkgs の `llama-cpp`) | Metal が効き、`--spec-type draft-mtp` (ネイティブ MTP 投機デコード) を持つ。ollama は独自の量子化・スケジューラを挟むぶん遅い |
| モデル | `SC117/Qwen3.6-35B-A3B-uncensored-heretic-Native-MTP-Preserved-APEX-GGUF` の APEX-I-Compact (17.0GB) | MoE 対応の混合精度量子化で、同サイズの標準量子化より品質が高い。MTP ヘッドも残っている |
| 公開 | portless | 固定ポートを持たない。ルータも portless のプロキシも loopback だけで待ち受けるので、LAN や tailnet からは届かない |
| 常駐 | launchd | ログイン時に起動し、落ちたら再起動する |

llama.cpp を `home.packages` ではなく launchd agent の PATH で渡す理由は、`chezmoi/private_dot_config/home-manager/home.nix.tmpl` の `launchd.agents.local-llm` のコメントにある。

## 使っていない間の負荷

重いのは 17GB の重みで、ルータは軽い。
そこでルータだけを常駐させ、重みはリクエストが来たときに読み込み、アイドルが続いたら解放する (`local-llm/presets.ini` の `sleep-idle-seconds`)。

M3 Pro 36GB での実測は次のとおり。

| 状態 | ルータ | 子プロセス | wired (システム全体) |
| --- | --- | --- | --- |
| 待機 (ルータのみ) | RSS 約 50〜110MB | なし | 4.7GB |
| 読み込み済み | RSS 約 50MB | RSS 16.4GB | 25.9GB |
| sleep 後 | footprint 55MB | footprint 469MB | 4.7GB |

sleep しても子プロセスは終了せず、抜け殻が残る。
待ち時間は、読み込み前の初回リクエストが 22 秒、sleep からの復帰が生成込みで約 10 秒 (どちらもページキャッシュにモデルが残っている状態)。
デコードとプリフィルの速度は `local-llm/bench.md` にある。

llama.cpp の仕様では `/health` と `/props` はアイドルタイマーをリセットしないので、死活監視を入れても重みは読み込まれない。

## 有効にする

既定では無効 (`chezmoi/.chezmoidata.toml` の `localLLM = false`)。
動かすマシンでだけ `~/.config/chezmoi/chezmoi.toml` で上書きする。

```toml
[data]
  localLLM = true
```

`localLLM` は、launchd agent の登録と `LLAMA_BASE_URL` の設定 (`chezmoi/dot_zshrc.tmpl`) を切り替える。

```bash
local-llm/pull.sh          # モデルを ~/models に取得 (約 18GB)。chezmoi apply では実行しない
chezmoi apply
home-manager switch        # launchd agent を登録して起動する
curl -s https://llama.localhost/health
```

## 運用

| 目的 | コマンド |
| --- | --- |
| 状態 | `curl -s https://llama.localhost/models` (`loaded` / `sleeping` / `unloaded`) |
| ログ | `~/Library/Logs/local-llm.log` |
| 再起動 (`presets.ini` の変更を反映) | `launchctl kickstart -k gui/$(id -u)/org.nix-community.home.local-llm` |
| 計測 | `python3 local-llm/bench.py`。結果は `local-llm/bench.md` |

## pi からの接続

pi 標準の llama.cpp プロバイダが環境変数 `LLAMA_BASE_URL` を読み、`/model` に `llama.cpp/qwen3.6-35b-a3b-uncensored` が出る。
`~/.pi/agent/auth.json` に llama.cpp の credential があれば、そちらが優先される。

portless は HTTPS を張るので、Node 製のツールには portless の CA を `NODE_EXTRA_CA_CERTS` で信頼させる (`shell/envrc.sh`)。
すでに起動しているシェルや pi には反映されないため、起動し直す。
反映されていないと `SELF_SIGNED_CERT_IN_CHAIN` で失敗する。

## モデルと量子化

M3 Pro のメモリ帯域は 150GB/s しかなく、デコード速度は 1 トークンあたりに読む重みのバイト数でほぼ決まる。
35B-A3B は活性 3B なので、量子化を上げるほど素直に遅くなる。

| ティア | サイズ | 備考 |
| --- | --- | --- |
| I-Compact | 17.0GB | 既定。公式いわく品質/サイズ比が最良。デコード最速 |
| I-Quality | 21.9GB | 品質優先。デコードは 3 割ほど落ちる |
| I-Balanced | 24.2GB | 36GB 機では KV と OS のぶんが足りない |
| I-MINI | 14.3GB | 速度が足りないときの退避先 |

ティアを変えるときは `local-llm/presets.ini` の `model` と `local-llm/pull.sh` の取得対象を合わせて差し替える。

長いコンテキストでも KV キャッシュが小さく済む理由は、`local-llm/presets.ini` の `ctx-size` のコメントにある。

## 調整つまみ

| 症状 | 対処 |
| --- | --- |
| メモリが足りない | `ctx-size` を下げる |
| デコードが遅い | `spec-draft-n-max` を 3 まで上げる / ティアを落とす |
| 復帰の待ちが気になる | `sleep-idle-seconds` を延ばす |
| 画像入力が要らない | `mmproj` を消す (0.9GB 節約) |
| プリフィルが遅い | System Settings の「ストレージ」パネルを閉じる (裏のディスクスキャンでスワップが荒れる)。Docker / VM を止める |
