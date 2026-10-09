# ローカル preview ページのスクリーンショットが agent-browser の個別コマンドだと失敗する

## Symptom

`agent-browser --session browser-ops open` / `wait` / `screenshot` のように手順を個別コマンドに分けて実行すると、以下のいずれかで失敗する。

- 2 回目以降のコマンドで次の警告が出てデーモンが再起動し、開いていたページが `about:blank` に戻る。

  ```
  ⚠ Daemon version mismatch detected, restarting...
  ```

  グローバルにインストールした agent-browser と、別プロジェクトが pnpm でローカルに持つ agent-browser のバージョンが異なり、同じ `--session browser-ops` 名のデーモンを共有してしまうために起きる。

- `open` 直後に `screenshot` すると、クライアントサイドでレンダリングするページ (dev-process-kit のテンプレートなど) ではまだ描画が終わっておらず、スクリーンショットが真っ黒になる。

## Workaround

ページを開いてから撮るまでの手順を 1 回の `batch` 呼び出しにまとめ、個別コマンドに分割しない。

```sh
agent-browser --session browser-ops batch \
  "set viewport 1440 1000" \
  "open file:///path/to/preview.html" \
  "wait 6000" \
  "screenshot /path/to/out.png"
```

`wait` を十分な長さ (ここでは 6000ms) で挟み、クライアントサイドレンダリングの完了を待つ。

同じ `--session browser-ops` を別の Claude セッションが使っていて衝突することがある (2 回発生)。作業前に他の Agent が使っていないか確認・調整する (browser-ops skill が既に求めている調整を厳密に守る)。

## Why Not Fixed

グローバル版と各プロジェクトの pnpm ローカル版で agent-browser のバージョンを揃える運用は、このリポジトリ外の各プロジェクトの管理に依存するため強制できない。描画完了までの待機時間もページ依存で一律に決められない。
