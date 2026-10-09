import { CAST, creditLine } from "../cast/cast.ts"
import { escapeHtml } from "../lib/html.ts"
import { type Transcript } from "./transcript.ts"

const timestamp = (seconds: number): string => {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** <script> 内に埋め込んでも閉じタグとして解釈されない JSON */
const embedJson = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")

const STYLE = `
:root {
  --ground: #F3F1EE; --surface: #FFFFFF; --ink: #2A2220; --muted: #6E625C; --line: #E2DCD6;
  --zundamon: #2F7A22; --zundamon-soft: #E2F2DA; --metan: #B42A6E; --metan-soft: #FBE2EE; --focus: #2F6FDE;
  --display: 'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif;
  --body: 'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground: #171311; --surface: #221D1A; --ink: #F2EAE4; --muted: #A99C93; --line: #3A322D;
    --zundamon: #8FD877; --zundamon-soft: #1F3319; --metan: #FF8CC0; --metan-soft: #3D1C2D; --focus: #8AB4FF;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #171311; --surface: #221D1A; --ink: #F2EAE4; --muted: #A99C93; --line: #3A322D;
  --zundamon: #8FD877; --zundamon-soft: #1F3319; --metan: #FF8CC0; --metan-soft: #3D1C2D; --focus: #8AB4FF;
}
body { background: var(--ground); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.7; }
.page { max-width: 1240px; margin: 0 auto; padding-inline: 16px; padding-block: 24px 48px; display: grid; gap: 20px; }
.masthead { display: grid; gap: 6px; }
.eyebrow { font-family: var(--display); font-weight: 800; font-size: 12px; letter-spacing: .12em; color: var(--zundamon); }
h1 { font-family: var(--display); font-weight: 800; font-size: clamp(24px, 4vw, 34px); line-height: 1.3; margin: 0; text-wrap: balance; }
.summary { margin: 0; color: var(--muted); max-width: 65ch; }
.layout { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 960px) { .layout { grid-template-columns: minmax(0, 1.75fr) minmax(300px, 1fr); } }
.player { display: grid; gap: 12px; }
video { width: 100%; max-width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 14px; display: block; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.controls .label { font-size: 13px; color: var(--muted); margin-right: 4px; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.chip { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 2px 12px; font-size: 13px; font-variant-numeric: tabular-nums; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--surface); border-color: var(--ink); }
.chapters { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
.chapters button { width: 100%; display: grid; grid-template-columns: 4.2em 1fr; gap: 8px; text-align: left; border: 0; background: none; padding: 6px 10px; border-radius: 8px; }
.chapters button:hover { background: var(--ground); }
.chapters .is-current button { background: var(--ground); font-weight: 700; }
.time { font-family: var(--mono); font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; padding-top: 2px; }
.transcript { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: min(78vh, 760px); }
.transcript h2, .sources h2 { font-family: var(--display); font-size: 15px; font-weight: 800; margin: 0; }
.transcript header { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.lines { position: relative; overflow-y: auto; list-style: none; margin: 0; padding: 8px; display: grid; gap: 2px; align-content: start; }
.lines button { width: 100%; text-align: left; border: 0; background: none; border-radius: 10px; padding: 6px 10px; display: grid; grid-template-columns: 3.6em 1fr; gap: 8px; }
.lines button:hover { background: var(--ground); }
.who { font-family: var(--display); font-weight: 800; font-size: 12px; display: block; }
.zundamon .who { color: var(--zundamon); }
.metan .who { color: var(--metan); }
.zundamon.is-current button { background: var(--zundamon-soft); }
.metan.is-current button { background: var(--metan-soft); }
.chapter-break { font-family: var(--display); font-weight: 800; font-size: 12px; color: var(--muted); padding: 10px 10px 2px; letter-spacing: .04em; }
.sources { display: grid; gap: 6px; }
.sources ul { margin: 0; padding-left: 1.2em; color: var(--muted); }
.sources a { color: inherit; }
.credit { margin: 0; font-size: 12.5px; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`

const SCRIPT = `
const data = JSON.parse(document.getElementById('episode-data').textContent);
const video = document.getElementById('video');
const lineItems = [...document.querySelectorAll('[data-line]')];
const chapterItems = [...document.querySelectorAll('[data-chapter]')];
const linesBox = document.getElementById('lines');
const follow = document.getElementById('follow');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let following = true;

const seek = (t) => { video.currentTime = t; video.play().catch(() => {}); };
document.querySelectorAll('[data-seek]').forEach((el) => el.addEventListener('click', () => seek(Number(el.dataset.seek))));

const setPressed = (selector, value) => document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
const applyRate = (rate) => { video.playbackRate = Number(rate); setPressed('[data-rate]', rate); try { localStorage.setItem('rate', rate); } catch {} };
document.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => applyRate(b.dataset.value)));
let savedRate = null;
try { savedRate = localStorage.getItem('rate'); } catch {}
applyRate(savedRate && document.querySelector('[data-rate][data-value="' + savedRate + '"]') ? savedRate : '1');

const loop = document.getElementById('loop');
loop.addEventListener('click', () => { video.loop = !video.loop; loop.setAttribute('aria-pressed', String(video.loop)); });
follow.addEventListener('click', () => { following = !following; follow.setAttribute('aria-pressed', String(following)); });

let current = -1;
video.addEventListener('timeupdate', () => {
  const t = video.currentTime;
  const index = data.lines.findIndex((l) => t >= l.start && t < l.end);
  if (index === current) return;
  current = index;
  lineItems.forEach((li, i) => li.classList.toggle('is-current', i === index));
  const chapter = index >= 0 ? data.lines[index].chapterIndex : -1;
  chapterItems.forEach((li, i) => li.classList.toggle('is-current', i === chapter));
  const el = lineItems[index];
  if (el && following) {
    const top = el.offsetTop - linesBox.clientHeight / 3;
    linesBox.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
});
`

export const buildPlayerPage = (transcript: Transcript, videoSrc: string): string => {
  const chapters = transcript.chapters
    .map(
      (c, i) =>
        `<li data-chapter="${i}"><button type="button" data-seek="${c.start}"><span class="time">${timestamp(c.start)}</span><span>${escapeHtml(c.title)}</span></button></li>`,
    )
    .join("")

  const lines = transcript.lines
    .map((line, i) => {
      const prev = transcript.lines[i - 1]
      const chapter = transcript.chapters[line.chapterIndex]
      const breakItem =
        chapter && prev?.chapterIndex !== line.chapterIndex
          ? `<li class="chapter-break" aria-hidden="true">${escapeHtml(chapter.title)}</li>`
          : ""
      return `${breakItem}<li class="${line.speaker}" data-line="${i}"><button type="button" data-seek="${line.start}"><span class="time">${timestamp(line.start)}</span><span><span class="who">${escapeHtml(CAST[line.speaker].label)}</span>${escapeHtml(line.text)}</span></button></li>`
    })
    .join("")

  const sources =
    transcript.sources.length === 0
      ? ""
      : `<section class="sources"><h2>参考にした情報</h2><ul>${transcript.sources
          .map((s) =>
            s.url === undefined
              ? `<li>${escapeHtml(s.title)}</li>`
              : `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`,
          )
          .join("")}</ul></section>`

  const rates = ["0.75", "1", "1.25", "1.5", "2"]
    .map(
      (r) =>
        `<button type="button" class="chip" data-rate data-value="${r}" aria-pressed="false">${r}×</button>`,
    )
    .join("")

  return `<title>${escapeHtml(transcript.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800&family=Zen+Kaku+Gothic+New:wght@400;700&family=IBM+Plex+Mono:wght@400&display=swap">
<style>${STYLE}</style>
<div class="page">
  <header class="masthead">
    <span class="eyebrow">ずんだもん解説 · ${timestamp(transcript.durationSeconds)}</span>
    <h1>${escapeHtml(transcript.title)}</h1>
    <p class="summary">${escapeHtml(transcript.summary)}</p>
  </header>
  <div class="layout">
    <section class="player" aria-label="動画">
      <video id="video" src="${escapeHtml(videoSrc)}" controls playsinline preload="metadata"></video>
      <div class="controls">
        <span class="label">速度</span>${rates}
        <span class="label" style="margin-left:8px">ながら見</span>
        <button type="button" class="chip" id="loop" aria-pressed="false">ループ再生</button>
      </div>
      <ol class="chapters" aria-label="チャプター">${chapters}</ol>
    </section>
    <section class="transcript" aria-label="字幕">
      <header><h2>字幕</h2><button type="button" class="chip" id="follow" aria-pressed="true">再生位置に追従</button></header>
      <ol class="lines" id="lines">${lines}</ol>
    </section>
  </div>
  ${sources}
  <p class="credit">音声・立ち絵: ${escapeHtml(creditLine())}</p>
</div>
<script type="application/json" id="episode-data">${embedJson(transcript)}</script>
<script>${SCRIPT}</script>
`
}
