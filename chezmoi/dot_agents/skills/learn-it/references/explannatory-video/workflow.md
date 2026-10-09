# 1 本作る手順

Claude の仕事は **調べる → 台本を書く → 生成して確認する → Artifact で公開する** の 4 つ。途中でユーザーに確認しない。最後に Artifact のリンクと要点を伝える。

前提: 生成の仕組み (`pnpm video` CLI) が作業ディレクトリにあること。なければ [setup.md](setup.md) から作る。

## 0. 環境

- コマンドは `nix develop -c <cmd>` で実行する (direnv が効いていれば素の `pnpm` でもよい)。node / pnpm / ffmpeg / voicevox-engine は flake の devShell が揃える。
- 初回のみ: `pnpm install` と `pnpm exec playwright install chromium-headless-shell`。
- VOICEVOX ENGINE は `VOICEVOX_URL` (既定 `http://127.0.0.1:50021`) で動いていればそれを使い、なければ CLI が自動で起動・停止する (初回はモデル読み込みで 1〜2 分)。

## 1. 調べる

調査はサブエージェント (Explore / general-purpose) に任せ、要点 (事実・用語・具体例・出典) だけを受け取る。

| トピック                   | 情報源                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| 一般的な技術・概念         | 一次資料 (公式ドキュメント、提唱者の文献) を WebSearch / WebFetch                               |
| 社内の業務・プロダクト     | 関連リポジトリのコード・ドキュメント、社内 wiki、チャット。プロジェクトの AGENTS.md に参照先があればそれに従う |

- 社内トピックは推測で埋めない。分からない点はぼかして書かず、扱わない。
- 参照した資料は台本の `sources` に入れる (社内資料は記事タイトルと URL)。
- 秘密情報を含むファイル (`.env*` など) は読まない。

## 2. 台本を書く

`episodes/<slug>/script.json` に書く。`<slug>` はトピックを表す短い ASCII の kebab-case (例: `ddd`)。
[script.md](script.md) を読んでから書く。既存の `episodes/*/script.json` があれば完成例として 1 本読む。

```sh
pnpm -s video validate episodes/<slug>/script.json
```

エラーはパス付き (`scenes.3.lines.2.reveal: ...`) で出るので、通るまで直す。

## 3. 生成して確認する

```sh
pnpm -s video preview episodes/<slug>/script.json   # 各シーン最後のセリフを PNG に (音声なし・数秒)
```

`out/<slug>/preview/scene-*.png` を Read で全部見る。

- 見出し・表・コードが枠からはみ出していない、極端に縮んでいない
- 字幕が 2 行以内に収まっている
- 立ち絵・表情記号がスライドの文字に重なっていない

問題があれば台本側で直す (スライドの文言を短く / 項目を減らす / シーンを分ける)。直ったら本番生成する (5 分の動画で 2〜3 分。音声はキャッシュされ、変えたセリフだけ再合成される)。

```sh
pnpm -s video build episodes/<slug>/script.json
```

最後に表示されるサイズが **15 MB を超えたら** `--crf 32` などで再生成する (Artifact のファイル上限)。

## 4. Artifact で公開する

Artifact ツールで公開する。

- `file_path`: `out/<slug>/index.html`
- `files`: `{ "video.mp4": "out/<slug>/video.mp4" }`
- `icon`: `video` (初回のみ)
- `description`: 動画の内容を一文で

作り直したら同じ `file_path` で再公開すれば同じ URL が更新される。
社内情報を含む動画は、誰に共有するかをユーザーに任せる (Artifact は非公開で作られる)。
ユーザーには Artifact のリンク、動画の長さ、チャプター、出典の概要を短く伝える。

## うまくいかないとき

| 症状                                 | 対処                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 読み間違い (英字・略語・固有名詞)    | その行に `yomi` を足す ([script.md](script.md#yomi))                                             |
| 声の高さ・速さを変えたい             | キャストの `voice` (VOICEVOX AudioQuery の speedScale など) を調整 ([pipeline.md](pipeline.md#キャスト)) |
| エンジンが起動しない・タイムアウト   | `voicevox-engine --host 127.0.0.1 --port 50021` を別ターミナルで先に起動する (起動済みなら再利用される) |
| エンジンを更新したのに声が変わらない | nix 版はバージョンが `latest` 固定でキャッシュが効き続けるので `.cache/tts` を消す               |
| Chromium が見つからない              | `pnpm exec playwright install chromium-headless-shell`                                           |
| 動画が 15 MB を超える                | `--crf` を上げる (28 → 32)。それでも大きければシーンを削って尺を縮める                           |
