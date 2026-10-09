# ステージ (静止画 1 枚) の描画と撮影

動画の 1 コマは 1280×720 の HTML を headless Chromium でスクリーンショットしたもの。見た目はすべてこの CSS で決まる。

## レイアウトの要点

| 要素         | 位置・見た目                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| 背景         | クリーム色の斜めストライプ + 白い丸 2 つ                                                                       |
| トップバー   | 上端。濃茶のチャプター pill / エピソード名 (省略記号で切る) / クレジット                                       |
| ボード       | `left:64 top:60 1152×420`。白地・5px 濃茶枠・角丸 28・下に 8px のベタ影。中にスライド                          |
| 立ち絵       | 320×400 の枠を左下 (めたん) と右下 (ずんだもん) に置き、全身の立ち絵を拡大して上半身だけ見せる。話者は `is-bounce` で 8px 上がる |
| 表情記号     | 頭の横。♪ (happy) / ！ (surprised) / 水色のしずく 2 つ (troubled) / ドヤッ (smug)。白い太縁取り              |
| 字幕         | 立ち絵の間 (`left/right:300 top:500`)。白文字 + 話者色の太縁取り (ずんだもん緑 `#3E9A2C` / めたんピンク `#C93A84`)。26 字超で 35px、44 字超で 30px |
| 段階表示     | 未表示の項目は `visibility:hidden` で場所だけ確保。直近の項目は黄色マーカー (`#FFE27A`)                         |

フォントは M PLUS Rounded 1c (400/700/800) を `@fontsource` のローカル CSS から読む (撮影時にネットワークに依存しない)。

## テキストの自動縮小

`data-fit` を付けた要素は、`scrollHeight/scrollWidth` が箱に収まるまで font-size を 1px ずつ下げる (下限 14px)。はみ出しは台本側で直すのが原則で、これは保険。縮みすぎていないかは preview で目視する。

## `render/stage.ts`

`renderStage(state)` が `#stage` の中身を返し、`stageDocument(fontCssUrls, portraits)` がブラウザに 1 回だけ読み込む文書を返す。立ち絵は表情ごとに `.character-<speaker>.face-<face> .portrait { background-image }` を出し分ける。

```ts
import { creditLine } from '../cast/cast.ts';
import { type Face, type Slide, SPEAKERS, type Speaker } from '../script/schema.ts';
import { type FrameState } from './frameState.ts';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** 段階表示: 未表示の項目は場所だけ確保し、直近に表示した項目を強調する */
const revealClass = (index: number, reveal: number | null): string => {
  if (reveal === null) return '';
  if (index >= reveal) return 'is-hidden';
  return index === reveal - 1 ? 'is-latest' : '';
};

const heading = (text: string): string => `<h2 class="heading" data-fit>${escapeHtml(text)}</h2>`;

const slideBody = (slide: Slide, reveal: number | null): string => {
  switch (slide.kind) {
    case 'title':
      return `<div class="slide slide-title">
        <p class="badge">ずんだもん解説</p>
        <h1 data-fit>${escapeHtml(slide.title)}</h1>
        ${slide.subtitle === undefined ? '' : `<p class="subtitle-text">${escapeHtml(slide.subtitle)}</p>`}
      </div>`;
    case 'bullets':
      return `<div class="slide slide-bullets">${heading(slide.heading)}
        <ul data-fit>${slide.items.map((item, i) => `<li class="${revealClass(i, reveal)}">${escapeHtml(item)}</li>`).join('')}</ul>
      </div>`;
    case 'keyword':
      return `<div class="slide slide-keyword">
        <p class="keyword" data-fit><span>${escapeHtml(slide.word)}</span></p>
        ${slide.description === undefined ? '' : `<p class="description">${escapeHtml(slide.description)}</p>`}
      </div>`;
    case 'table':
      return `<div class="slide slide-table">${heading(slide.heading)}
        <div class="table-wrap" data-fit><table>
          <thead><tr>${slide.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>${slide.rows
            .map(
              (row, i) =>
                `<tr class="${revealClass(i, reveal)}">${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
            )
            .join('')}</tbody>
        </table></div>
      </div>`;
    case 'flow':
      return `<div class="slide slide-flow">${heading(slide.heading)}
        <ol class="flow" data-fit>${slide.nodes
          .map(
            (node, i) =>
              `<li class="${revealClass(i, reveal)}"><span>${escapeHtml(node)}</span></li>`,
          )
          .join('')}</ol>
      </div>`;
    case 'code':
      return `<div class="slide slide-code">${heading(slide.heading)}
        <pre data-fit data-lang="${escapeHtml(slide.language)}"><code>${escapeHtml(slide.code)}</code></pre>
      </div>`;
    default:
      return slide satisfies never;
  }
};

const subtitleSize = (text: string): string => {
  if (text.length > 44) return 'is-small';
  if (text.length > 26) return 'is-medium';
  return '';
};

/** 立ち絵は 1 枚絵なので、表情は頭の横に出す記号で表す */
const emote = (face: Face): string => {
  switch (face) {
    case 'normal':
      return '';
    case 'happy':
      return '<span class="emote emote-happy">♪</span>';
    case 'surprised':
      return '<span class="emote emote-surprised">！</span>';
    case 'troubled':
      return '<span class="emote emote-troubled"><i></i><i></i></span>';
    case 'smug':
      return '<span class="emote emote-smug">ドヤッ</span>';
    default:
      return face satisfies never;
  }
};

const character = (speaker: Speaker, state: FrameState): string => {
  const pose = state.characters[speaker];
  const classes = [
    'character',
    `character-${speaker}`,
    `face-${pose.face}`,
    pose.speaking ? 'is-speaking' : '',
    pose.bounce ? 'is-bounce' : '',
  ].filter((c) => c !== '');
  return `<div class="${classes.join(' ')}"><div class="portrait"></div>${emote(pose.face)}</div>`;
};

/** #stage の中身。静止画 1 枚分 */
export const renderStage = (state: FrameState): string => `
  <header class="topbar">
    <span class="chapter">${escapeHtml(state.chapter)}</span>
    <span class="episode">${escapeHtml(state.episodeTitle)}</span>
    <span class="credit">${escapeHtml(creditLine())}</span>
  </header>
  <main class="board">${slideBody(state.slide, state.reveal)}</main>
  ${character('metan', state)}
  ${character('zundamon', state)}
  <p class="subtitle subtitle-${state.subtitle.speaker} ${subtitleSize(state.subtitle.text)}" data-fit><span>${escapeHtml(state.subtitle.text)}</span></p>
`;

const STAGE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${STAGE_WIDTH}px; height: ${STAGE_HEIGHT}px; overflow: hidden; }
body { font-family: 'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif; color: #3B2A22; }
#stage {
  position: relative; width: ${STAGE_WIDTH}px; height: ${STAGE_HEIGHT}px; overflow: hidden;
  background:
    radial-gradient(circle at 12% 18%, rgba(255,255,255,.7) 0 60px, transparent 61px),
    radial-gradient(circle at 88% 10%, rgba(255,255,255,.5) 0 40px, transparent 41px),
    repeating-linear-gradient(135deg, #FFF3DC 0 24px, #FFEBCB 24px 48px);
}
.topbar { position: absolute; top: 14px; left: 64px; right: 64px; display: flex; gap: 14px; align-items: center; height: 36px; }
.chapter { background: #3B2A22; color: #fff; font-weight: 800; font-size: 20px; padding: 4px 18px; border-radius: 999px; }
.episode { flex: 1; min-width: 0; font-weight: 700; font-size: 18px; color: #7A5A48; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.credit { flex: none; font-size: 13px; font-weight: 700; color: #9A7A66; white-space: nowrap; }

.board {
  position: absolute; left: 64px; top: 60px; width: 1152px; height: 420px;
  background: #fff; border: 5px solid #3B2A22; border-radius: 28px; box-shadow: 0 8px 0 #3B2A22;
  padding: 26px 56px 30px; overflow: hidden;
}
.slide { height: 100%; display: flex; flex-direction: column; gap: 18px; }
.heading {
  flex: none; font-size: 40px; font-weight: 800; line-height: 1.35; max-height: 120px; overflow: hidden;
  padding-bottom: 8px; border-bottom: 6px dotted #F2B33D;
}
.is-hidden { visibility: hidden; }

.slide-title { align-items: center; justify-content: center; text-align: center; gap: 22px; }
.badge { background: #E0303E; color: #fff; font-weight: 800; font-size: 24px; padding: 6px 22px; border-radius: 999px; }
.slide-title h1 { align-self: stretch; font-size: 68px; font-weight: 800; line-height: 1.35; max-height: 280px; overflow: hidden; }
.subtitle-text { font-size: 30px; font-weight: 700; color: #7A5A48; }

.slide-bullets ul { list-style: none; display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; overflow: hidden; font-size: 34px; font-weight: 700; line-height: 1.35; }
.slide-bullets li { padding-left: 1.3em; position: relative; }
.slide-bullets li::before { content: '◆'; position: absolute; left: 0; color: #E0303E; font-size: .8em; top: .18em; }
.slide-bullets li.is-latest { background: linear-gradient(transparent 58%, #FFE27A 58%); }

.slide-keyword { align-items: center; justify-content: center; text-align: center; gap: 28px; }
.keyword { align-self: stretch; font-size: 92px; font-weight: 800; line-height: 1.35; max-height: 260px; overflow: hidden; }
.keyword span { background: linear-gradient(transparent 62%, #FFE27A 62%); padding: 0 .2em; }
.description { font-size: 32px; font-weight: 700; color: #5A4034; line-height: 1.5; max-width: 900px; }

.table-wrap { flex: 1; min-height: 0; overflow: hidden; font-size: 26px; }
.slide-table table { width: 100%; border-collapse: separate; border-spacing: 0; font-weight: 700; line-height: 1.35; }
.slide-table th { background: #3B2A22; color: #fff; padding: 10px 16px; text-align: left; }
.slide-table th:first-child { border-top-left-radius: 14px; }
.slide-table th:last-child { border-top-right-radius: 14px; }
.slide-table td { padding: 10px 16px; border-bottom: 3px solid #F1E2D4; }
.slide-table tr.is-latest td { background: #FFF6CC; }

.flow { list-style: none; flex: 1; min-height: 0; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 22px 0; font-size: 28px; font-weight: 800; overflow: hidden; word-break: auto-phrase; }
.flow li { display: flex; align-items: center; }
.flow li span { display: block; background: #FFF6E5; border: 4px solid #3B2A22; border-radius: 18px; padding: 16px 22px; max-width: 300px; text-align: center; line-height: 1.3; box-shadow: 0 5px 0 #3B2A22; }
.flow li.is-latest span { background: #FFE27A; }
.flow li + li::before { content: '➜'; color: #E0303E; font-size: 1.3em; padding: 0 14px; }

.slide-code pre {
  flex: 1; min-height: 0; overflow: hidden; background: #2B2420; color: #FDF3E7; border-radius: 18px; padding: 16px 24px;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 24px; line-height: 1.4; white-space: pre-wrap;
}

.character { position: absolute; bottom: 0; width: 320px; height: 400px; }
/* 立ち絵 (縦 500px の全身) を拡大し、頭がボードの下端に来るよう下げて上半身だけ見せる */
.character .portrait { position: absolute; inset: 0; background: no-repeat center 120px / auto 640px; }
.character.is-bounce .portrait { transform: translateY(-8px); }
.character-metan { left: -12px; }
.character-zundamon { right: -12px; }
/* ずんだもんの立ち絵は頭が小さめに描かれているので、めたんと頭の大きさを揃える */
.character-zundamon .portrait { background-size: auto 720px; background-position: center 92px; }
.emote { position: absolute; top: 110px; font-weight: 800; line-height: 1; paint-order: stroke fill; -webkit-text-stroke: 8px #fff; filter: drop-shadow(0 3px 0 rgba(59,42,34,.35)); }
.character-metan .emote { right: 6px; }
.character-zundamon .emote { left: 24px; top: 96px; }
.emote-happy { font-size: 52px; color: #F0568C; transform: rotate(12deg); }
.emote-surprised { font-size: 60px; color: #E0303E; }
.emote-smug { font-size: 30px; color: #3B2A22; transform: rotate(-10deg); top: 124px; }
.emote-troubled { width: 70px; height: 70px; }
.emote-troubled i { position: absolute; width: 26px; height: 26px; background: #5FB8F5; border: 4px solid #fff; border-radius: 0 50% 50% 50%; transform: rotate(45deg); }
.emote-troubled i:first-child { left: 4px; top: 30px; }
.emote-troubled i:last-child { left: 38px; top: 8px; width: 20px; height: 20px; }

.subtitle {
  position: absolute; left: 300px; right: 300px; top: 500px; bottom: 16px;
  display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 40px; font-weight: 800; line-height: 1.32; color: #fff; word-break: auto-phrase;
}
.subtitle.is-medium { font-size: 35px; }
.subtitle.is-small { font-size: 30px; }
.subtitle span { paint-order: stroke fill; -webkit-text-stroke: 9px var(--edge); filter: drop-shadow(0 4px 0 #3B2A22); }
.subtitle-zundamon { --edge: #3E9A2C; }
.subtitle-metan { --edge: #C93A84; }
`;

/** 立ち絵の URL (file:// など、ブラウザから読めるもの)。faces にない表情は base を使う */
export type PortraitUrls = Record<Speaker, { base: string; faces: Partial<Record<Face, string>> }>;

const cssUrl = (url: string): string => `url("${url.replaceAll('"', '%22')}")`;

const portraitCss = (portraits: PortraitUrls): string =>
  SPEAKERS.flatMap((speaker) => [
    `.character-${speaker} .portrait { background-image: ${cssUrl(portraits[speaker].base)}; }`,
    ...Object.entries(portraits[speaker].faces).map(
      ([face, url]) =>
        `.character-${speaker}.face-${face} .portrait { background-image: ${cssUrl(url)}; }`,
    ),
  ]).join('\n');

const portraitUrlList = (portraits: PortraitUrls): string[] =>
  SPEAKERS.flatMap((s) => [portraits[s].base, ...Object.values(portraits[s].faces)]);

/**
 * ブラウザに一度だけ読み込むステージ用 HTML。
 * window.__render(html) で #stage を差し替え、はみ出すテキストを縮めてから、フォントと立ち絵の読み込みを待つ。
 */
export const stageDocument = (
  fontCssUrls: readonly string[],
  portraits: PortraitUrls,
): string => `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
${fontCssUrls.map((url) => `<link rel="stylesheet" href="${escapeHtml(url)}">`).join('\n')}
<style>${STAGE_CSS}\n${portraitCss(portraits)}</style>
<script>
  const images = ${JSON.stringify(portraitUrlList(portraits)).replaceAll('<', '\\u003c')}.map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  const imagesReady = Promise.all(images.map((img) => img.decode()));
  const fit = (el) => {
    let size = parseFloat(getComputedStyle(el).fontSize);
    while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > 14) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  };
  window.__render = async (html) => {
    await imagesReady;
    document.getElementById('stage').innerHTML = html;
    await document.fonts.ready;
    document.querySelectorAll('[data-fit]').forEach(fit);
    await document.fonts.ready;
  };
</script>
</head><body><div id="stage"></div></body></html>`;
```

`badge` の「ずんだもん解説」、配色、立ち絵の位置調整値 (`center 120px / auto 640px`、ずんだもんは `auto 720px` / `center 92px`) は VOICEVOX 配布の立ち絵 (縦 500px の全身) に合わせた値。キャラクターを変えたら preview を見ながら調整する。

## 撮影 (`render/capture.ts`)

- `stageDocument` を `frames/stage.html` に書き、Chromium (`chromium.launch()`、viewport 1280×720) で `file://` として開く。立ち絵・フォントも `file://` URL で渡す (`pathToFileURL`)。フォント CSS は `require.resolve('@fontsource/m-plus-rounded-1c/<weight>.css')`。
- ページは 1 つだけ使い回し、1 枚ごとに `page.evaluate((html) => window.__render(html), html)` → `page.screenshot({ path, type: 'png' })`。
- `__render` は「立ち絵の decode 完了 → innerHTML 差し替え → `document.fonts.ready` → `data-fit` の縮小 → もう一度 `fonts.ready`」を待ってから返るので、撮影時に読み込み途中の絵が写らない。
- `finally` で `browser.close()`。

```ts
declare global {
  interface Window {
    __render: (html: string) => Promise<void>;
  }
}
```
