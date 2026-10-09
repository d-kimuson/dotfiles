# 仕組みを新しく作る

TypeScript (Node のネイティブ型ストリップで直接実行) の小さな CLI として作る。ビルド工程は持たない。
各モジュールの中身は [pipeline.md](pipeline.md)・[stage.md](stage.md)・[player.md](player.md)、台本の契約は [script.md](script.md) にある。純粋関数 (timeline / wav / stage / transcript / ffmpeg 引数) は Vitest でテストしながら作る。

## 実行環境 (Nix flake + direnv)

`flake.nix`:

```nix
{
  description = "explanatory-video development environment";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  outputs =
    { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            import nixpkgs {
              inherit system;
              # VOICEVOX の音声合成ランタイム・音声モデルは独自ライセンス (unfree) のため個別に許可する
              config.allowUnfreePredicate =
                pkg:
                builtins.elem (nixpkgs.lib.getName pkg) [
                  "voicevox-core"
                  "voicevox-onnxruntime"
                  "voicevox-open-jtalk"
                  "voicevox-vvm"
                  "voicevox-additional-libraries"
                ];
            }
          )
        );
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_26
            pkgs.pnpm
            pkgs.ffmpeg
            # `voicevox-engine` で http://127.0.0.1:50021 に起動する
            pkgs.voicevox-engine
          ];
        };
      });
    };
}
```

`.envrc` は `use flake`。Nix がない環境では node (型ストリップが既定で有効な 23.6+)・pnpm・ffmpeg・VOICEVOX ENGINE (公式配布の engine を起動しておく) を別途用意する。

## 依存

```jsonc
// package.json
{
  "type": "module",
  "scripts": { "video": "node src/cli.ts", "test": "vitest run", "typecheck": "tsgo -p . --noEmit" },
  "dependencies": {
    "zod": "^4",                            // 台本・VOICEVOX 応答の検証
    "playwright": "^1",                     // 静止画撮影 (chromium-headless-shell)
    "@fontsource/m-plus-rounded-1c": "^5",  // 動画内フォント (ローカルの CSS を file:// で読む)
    "p-map": "^7"
  },
  "devDependencies": { "@typescript/native-preview": "*", "typescript": "*", "@types/node": "*", "vitest": "*", "@tsconfig/strictest": "*" }
}
```

初回のみ `pnpm install` と `pnpm exec playwright install chromium-headless-shell`。

tsconfig は Node の型ストリップに合わせる: `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"verbatimModuleSyntax": true`, `"allowImportingTsExtensions": true`, `"erasableSyntaxOnly": true`, `"noEmit": true`, `"lib": ["dom", "dom.iterable", "esnext"]` (ステージの `page.evaluate` 用)。import は `./foo.ts` と拡張子付きで書き、enum・namespace・constructor parameter properties は使わない。

`.gitignore` に `/out/` と `/.cache/` を入れる。

## ディレクトリ構成

```
episodes/<slug>/script.json   台本
src/
  cli.ts                      validate | preview | build
  script/schema.ts            台本の契約 (zod) ……………… script.md
  script/loadEpisode.ts       JSON 読み込み + 検証。issues をパス付きで整形して throw
  cast/cast.ts                キャスト定義 (声・立ち絵スタイル・クレジット)
  cast/portraits.ts           立ち絵・利用規約の取得 + キャッシュ
  voicevox/api.ts             VOICEVOX HTTP API クライアント
  voicevox/engine.ts          エンジンの起動・再利用・停止
  tts/voicevox.ts             1 セリフの合成 + sha256 キャッシュ
  audio/wav.ts                mono 16bit WAV の encode/decode/連結
  timeline/timeline.ts        セリフ → 整数フレームの cue
  timeline/animation.ts       RMS → 立ち絵の弾みトラック
  timeline/framePlan.ts       撮影する静止画の重複排除 + ffconcat
  render/frameState.ts        cue + pose → 1 枚分の描画状態
  render/stage.ts             描画状態 → HTML、ステージ文書 (CSS) ……… stage.md
  render/capture.ts           Playwright で撮影
  encode/ffmpeg.ts            ffmpeg 引数
  player/transcript.ts        目次・字幕 (秒)
  player/playerPage.ts        プレイヤーページ HTML ………………… player.md
  pipeline/buildVideo.ts      上を順に呼ぶオーケストレーション
  lib/{exec,fs}.ts            外部コマンド実行 (タイムアウト付き)、atomic write
out/<slug>/                   生成物 (git 管理外)
.cache/tts, .cache/voicevox   音声・立ち絵のキャッシュ (git 管理外)
```

設計の約束:

- 台本は zod の discriminated union。`parseEpisode` は例外を投げず `{ ok: true, episode } | { ok: false, issues }` を返す。
- 時間はすべて **30fps の整数フレーム / 24kHz の整数サンプル**で持つ (1 フレーム = 800 サンプル)。秒の浮動小数で計算しない。
- 純粋関数 (timeline・wav・stage・transcript・ffmpeg 引数) と I/O (VOICEVOX・Playwright・ffmpeg・fs) を分ける。I/O 側は薄く、外部プロセスはモックせず実際に動かして確かめる。
- キャッシュは「書いてから rename」の atomic write で、書きかけが残らないようにする。

## CLI

```
pnpm video validate <script.json>              台本をスキーマ検証して OK を出す
pnpm video preview  <script.json>              各シーン最後のセリフを PNG に (音声なし・数秒)
pnpm video build    <script.json> [--crf 28]   動画とプレイヤーページを生成する
```

- 出力先は `out/<台本のディレクトリ名>/` (`episodes/ddd/script.json` → `out/ddd/`)。台本が `episodes/` 直下に置かれていたら (`episodes/ddd.json`) ファイル名を使う。キャッシュは `<リポジトリ>/.cache`。
- `VOICEVOX_URL` 環境変数でエンジンの URL を変えられる (既定 `http://127.0.0.1:50021`)。
- ログは stderr。失敗時はメッセージだけ出して exit code 1。
- `build` の最後に `完了 (<秒>s): <分> 分 / <MB> MB` と出力パスを出す。サイズは Artifact の上限 (15 MB) 判断に使う。
- `preview` は音声なしで動く: 各セリフの長さを 1 秒 (= sampleRate サンプル) と仮定して timeline を組み、各シーンの最後の cue を `{ bounce: false }` で撮って `out/<slug>/preview/scene-NN.png` に書く。立ち絵はキャッシュがあればエンジンを起動しない (`ensurePortraits`)。

## 仕上がりの確認

1. `pnpm test` と typecheck が通る。
2. [script.md](script.md) の例を少し伸ばした台本で `validate` → `preview` → `build` を通し、preview の PNG と動画を目で確かめる (はみ出し、字幕 2 行以内、立ち絵の弾みと音声が合っているか、クレジットの表示)。
3. [workflow.md](workflow.md) の手順で Artifact に公開し、ページで再生・チャプター移動・字幕追従が動くことを確かめる。
