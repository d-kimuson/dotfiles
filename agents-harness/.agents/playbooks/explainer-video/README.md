# explainer-video (開発者向け)

`scripts/video` の実装メモ。Agent 向けの使い方は `PLAYBOOK.md`、台本の書き方は `references/script.md` を読む。ここには実装を触る人に必要なことだけを書く。

## 構成

`scripts/` が motion-kit のプロジェクトルートを兼ねる (`package.json`、`vite.config.ts`、`node_modules`)。

| パス | 役割 |
| --- | --- |
| `video` | 入口の bash。lockfile か配置先が変わったときだけ `pnpm install` と `playwright install chromium` を実行する (`node_modules/.explainer-video-lock` に印を残す) |
| `src/cli.ts` | commander の CLI (`validate` / `preview` / `build` / `yomi` / `schema`) |
| `src/script/` | 台本 (Episode) の zod スキーマと読み込み。JSON の契約はここ |
| `src/voicevox/` | VOICEVOX API クライアント、エンジンの起動と停止 (`voicevox-engine`、なければ docker)、行ごとのキャッシュ付き合成 |
| `src/cast/` | めたん・ずんだもんの声・表情・クレジットと、立ち絵の取得とキャッシュ |
| `src/audio/` | WAV の読み書きと連結 |
| `src/timeline/` | セリフの長さからタイムライン (フレーム) を作る。`animation.ts` は音量から口パクの弾みを作る |
| `src/plan/` | タイムラインと素材を 1 つの `VideoPlan` にまとめる。ブラウザ側と Node 側の共有型 |
| `src/motionkit/` | motion-kit CLI の引数組み立て (`args.ts`) と実行・結果の解釈 (`run.ts`) |
| `src/pipeline/` | `buildVideo` (合成から mp4 と player まで)、`preview`、`reading` (yomi) |
| `src/player/` | `index.html` (プレイヤーページ) と字幕データ (`transcript.json`) |
| `src/video/` | motion-kit が描画する React (ブラウザ側)。`entry.tsx` が入口 |
| `vite.config.ts` | `virtual:explainer-plan` と `server.fs.allow` を足す。motion-kit のローダが読む |

`src/video/` と、そこから import される `src/plan/plan.ts`、`src/script/schema.ts`、`src/cast/cast.ts` はブラウザで動く。ここから Node 専用モジュール (`node:fs` など) に届く import を作らない。型だけの import は `import type { ... }` と書く (`import { type X }` は `verbatimModuleSyntax` で副作用 import として残り、ページの読み込みが理由の出ない失敗になる)。

## 処理の流れ

1. `build`: VOICEVOX で全セリフを合成 (変わった行だけ)、長さからタイムラインを作り、`voice.wav` と `plan.json` を一時ディレクトリに書く。
2. `motion-kit render` を `PROJECT_ROOT` で実行して `video.mp4` を作る。
3. `transcript.json` と `index.html` を書く。
4. `preview`: 各セリフを 1 秒とみなしたタイムラインで、各シーンの最後のセリフの 20 フレーム後を `motion-kit frame` で撮り、`preview/scene-NN.png` にする。音声は合成せず、立ち絵がキャッシュにあればエンジンを起動しない。

## motion-kit の使い方

バージョンは 0.2.2 に固定している (`@kimuson/motion-kit` だけ `minimumReleaseAgeExclude`)。

- エントリ `src/video/entry.tsx` が `compositions` を export する。Composition は 1 つ (`explainer`、1280x720、fps 30)。
- Composition の長さと `audio` は静的な宣言で props から変えられない。そこで台本ごとのプランを JSON にし、環境変数 `EXPLAINER_PLAN` で `vite.config.ts` に渡す。`virtual:explainer-plan` がその JSON を default export する。
- 音声は全セリフを並べた 1 本の `voice.wav` を `audio: [{ src, startInFrames: 0, endInFrames }]` で宣言する。`preview` は音声なし (`audioPath: null`)。
- 立ち絵は `/@fs/<絶対パス>` の URL で配る。許可は `EXPLAINER_FS_ALLOW` (キャッシュのディレクトリ) を `server.fs.allow` に足す。
- `Sequence` (秒の有理数で `from` と `duration`) をシーンごとに置き、`useFrame` と `useTime` で字幕・段階表示・表情を出す。立ち絵はシーンをまたいで 1 つ。
- `useAsset`: フォントは `font-family` (`@fontsource/m-plus-rounded-1c` の 700 と 800 を entry で import し、画面に出る文字だけ要求する)、立ち絵は `image`。どれも局所の `<Suspense>` の中で呼ぶ。
- `/motion` の `interpolate` と `easing`、`spring` で、シーン切り替え・段階表示の最新項目・字幕・表情記号の動きを付ける。
- 失敗は `--json` の封筒の `diagnostics` を読んで例外にする (`src/motionkit/run.ts`)。

## 開発

```sh
cd scripts
pnpm install          # video の初回実行でも入る
pnpm run typecheck    # tsc -p . --noEmit
pnpm run test         # node --test 'src/**/*.test.ts'
```

テストは純粋なロジック (スキーマ、タイムライン、WAV、プラン、motion-kit の引数と封筒の解釈、VOICEVOX クライアントの引数) だけを対象にする。VOICEVOX も Chromium も使わない。描画の確認は `video preview` と `video build` を実機で動かし、PNG と mp4 のフレームを見る。

`video` は初回に Chromium を入れる (`pnpm exec playwright install chromium`)。motion-kit はヘッドレスで起動する。

動作確認では `VOICEVOX_URL` と `XDG_CACHE_HOME` を差し替えると、本物のキャッシュを汚さずに済む。

## アセットとライセンス

- 音声と立ち絵: VOICEVOX ENGINE から取得する。ずんだもん・四国めたんの利用規約に従い、クレジット `VOICEVOX:ずんだもん` と `VOICEVOX:四国めたん` を動画とプレイヤーページに必ず出す (`src/cast/cast.ts` の `credit`)。規約の全文は取得時に `~/.cache/explainer-video/voicevox/policy-*.md` に保存される。立ち絵は配布しない。
- フォント: M PLUS Rounded 1c (SIL Open Font License 1.1)。`@fontsource/m-plus-rounded-1c` から読み込む。
- 動画の描画: `@kimuson/motion-kit` と同梱の Chromium (Playwright)。
- 背景の縞模様、吹き出し、表情記号 (♪ ！ ドヤッ、汗) は CSS と文字で描いており、外部の画像は使っていない。
