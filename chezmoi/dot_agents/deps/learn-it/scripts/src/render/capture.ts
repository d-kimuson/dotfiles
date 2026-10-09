import { createRequire } from "node:module"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { type Portraits } from "../cast/portraits.ts"
import { writeFileAtomic } from "../lib/fs.ts"
import { SPEAKERS } from "../script/schema.ts"
import { type PortraitUrls, STAGE_HEIGHT, STAGE_WIDTH, stageDocument } from "./stage.ts"

declare global {
  interface Window {
    __render: (html: string) => Promise<void>
  }
}

const FONT_WEIGHTS = ["400", "700", "800"] as const

/** 撮影時にネットワークへ依存しないよう、フォントは @fontsource のローカル CSS を読む */
const fontCssUrls = (): string[] => {
  const require = createRequire(import.meta.url)
  return FONT_WEIGHTS.map(
    (w) => pathToFileURL(require.resolve(`@fontsource/m-plus-rounded-1c/${w}.css`)).href,
  )
}

const portraitUrls = (portraits: Portraits): PortraitUrls => {
  const toUrl = (path: string): string => pathToFileURL(path).href
  return Object.fromEntries(
    SPEAKERS.map((s) => [
      s,
      {
        base: toUrl(portraits[s].base),
        faces: Object.fromEntries(
          Object.entries(portraits[s].faces).map(([f, p]) => [f, toUrl(p)]),
        ),
      },
    ]),
  ) as PortraitUrls
}

export type CaptureJob = { readonly html: string; readonly path: string }

/**
 * ステージの HTML を 1 枚ずつ PNG に撮る。
 * ページは 1 つだけ使い回し、#stage の中身を差し替えて撮る
 */
export const captureFrames = async (
  workDir: string,
  portraits: Portraits,
  jobs: readonly CaptureJob[],
  onProgress: (done: number) => void = () => {},
): Promise<void> => {
  const stagePath = join(workDir, "stage.html")
  await writeFileAtomic(stagePath, stageDocument(fontCssUrls(), portraitUrls(portraits)))
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT } })
    await page.goto(pathToFileURL(stagePath).href)
    for (const [i, job] of jobs.entries()) {
      await page.evaluate(async (html) => window.__render(html), job.html)
      await page.screenshot({ path: job.path, type: "png" })
      onProgress(i + 1)
    }
  } finally {
    await browser.close()
  }
}
