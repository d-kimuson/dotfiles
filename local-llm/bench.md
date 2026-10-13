# 実測

## 環境

| 項目 | 値 |
| --- | --- |
| マシン | Mac15,6 / Apple M3 Pro / 36GB 統合メモリ / 150GB/s |
| OS | macOS 26.5.1 (25F80) |
| llama.cpp | 0.6.0 (build 11429, commit d812350) Homebrew bottle |
| モデル | Qwen3.6-35B-A3B-uncensored-heretic APEX-I-Compact 17.0GB |
| 設定 | ctx 131072 / `--flash-attn on` / `--spec-type draft-mtp --spec-draft-n-max 2` / `-ngl 999` / mmproj あり |

計測は `python3 bench.py`。llama.cpp が返す `timings` をそのまま読んでいる。

## デコード

同一プロンプトを繰り返し投げた定常状態。温度 0。

| プロンプト | デコード | draft 採用 |
| --- | --- | --- |
| short (Fibonacci 関数) | 42.2 tok/s | 126/146 (86.3%) |
| long (投機デコードの説明) | 39.0 tok/s | 120/157 (76.4%) |

投機デコードなしの比較は取っていないが、`spec-draft-n-max 2` で 1 ステップあたり最大 3 トークン進むので、採用率から見ておおむね 1.5〜2 倍の想定。

## プリフィル

20,306 トークンのユニークなプロンプトを 1 回で処理。

| 指標 | 値 |
| --- | --- |
| プリフィル | 378.3 tok/s |
| デコード | 34.9 tok/s |
| wall | 55.4s（プリフィル + 48 トークン生成） |

20k トークンで約 55 秒。llama.cpp のプレフィックスキャッシュが効くので、同じ文脈での 2 ターン目以降はここは払わない。

## pi 経由のエンドツーエンド

| タスク | wall |
| --- | --- |
| `-p "Reply with exactly: OK"` | 十数秒 |
| `--tools ls` でカレントを一覧 → 結果を報告 | 3m04s |

ツール呼び出しは GGUF 同梱のチャットテンプレート（`--jinja`）で通る。上の 3 分は pi のシステムプロンプトのプリフィルが支配的。

## 常駐プロセスの影響

同じ設定・同じモデルで、他のプロセスを落としながら段階的に計測した。

| 状況 | short | long | 20k プリフィル |
| --- | --- | --- | --- |
| Docker / VM + Storage スキャン常駐 | 40.5 tok/s | 35.1 tok/s | 320.8 tok/s |
| Docker Desktop 停止 | 42.0 tok/s | 37.5 tok/s | — |
| Storage スキャン停止 | 42.2 tok/s | 39.0 tok/s | 378.3 tok/s |

### スワップを壊していたのは Docker ではなく System Settings

`vm.swapusage` が 27GB 中 26.9GB まで埋まり、スワップが毎秒 800 回読み / 1,750 回書きされていた。最初は Docker の VM を疑ったが、Docker を落としてもスワップの使用量は 23GB のままだった。

真犯人は **System Settings の「ストレージ」パネル**。7 日間起動しっぱなしで、その裏で `StorageManagementService`(67% CPU) と `ApplicationsStorageExtension`(55% CPU) がディスクをスキャンし続けていた。System Settings を終了させた瞬間にスワップ書き込みが **0/s** になった。

| 指標 | スキャン中 | スキャン停止直後 | アイドル時 |
| --- | --- | --- | --- |
| swapout | 1,756/s | 0/s | 450/s |
| swapin | 815/s | 140/s | 220/s |

停止直後は 0 になったが、デスクトップアプリ（Orca、WindowServer など）が動き出すと 450/s 程度には戻る。これはモデル側が wired で 26GB を占めるため、残り 10GB をアプリ群が取り合っている構造的なもので、消せる類のものではない。

### それでもスワップ使用量は減らない

スキャンを止めても `used` は 23〜24GB でほぼ横ばいだった。macOS は一度確保したスワップを、実際に必要になるまで返さない。数値をきれいにしたい場合だけ再起動する（性能面では churn の量のほうが効く）。

なお `Pages wired down` は常時 26GB 前後ある。内訳の大半は llama-server の Metal バッファで、これは RSS には現れない（`llama-server` の RSS は 4GB 程度に見える）。

## さらにメモリを空ける場合

| 手段 | 空く量 | トレードオフ |
| --- | --- | --- |
| mmproj を外す | 2GB 前後 | 画像・動画入力が使えなくなる |
| ctx を 65536 に | 1.3GB | 長い文脈が切れる |
| I-MINI ティアに変更 | 3GB 前後 | 品質が落ちる |
| 再起動 | スワップの数値がきれいになる | モデルの再ロードに 1〜4 分 |

## 未計測

- 投機デコード無効時との直接比較（`spec-type` を外した同一条件）
- I-Quality / I-MINI との速度・品質比較
- 画像入力（mmproj はロード済みだが未検証）
