import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { frameArgs, framePngName, projectEnv, renderArgs } from "./args.ts"

describe("renderArgs", () => {
  it("Composition と品質を指定して mp4 に出力する", () => {
    assert.deepEqual(renderArgs({ entry: "e.tsx", out: "/o/video.mp4", crf: 24 }), [
      "render",
      "e.tsx",
      "--composition",
      "explainer",
      "--out",
      "/o/video.mp4",
      "--video-crf",
      "24",
      "--json",
    ])
  })
})

describe("frameArgs", () => {
  it("フレームをカンマ区切りで渡す", () => {
    const args = frameArgs({ entry: "e.tsx", outDir: "/o/p", frames: [39, 83] })
    assert.equal(args[args.indexOf("--frame") + 1], "39,83")
    assert.equal(args[args.indexOf("--out") + 1], "/o/p")
  })

  it("出力ファイル名は 5 桁にゼロ埋めする", () => {
    assert.equal(framePngName(39), "frame-00039.png")
  })
})

describe("projectEnv", () => {
  it("プランの場所と配信を許すキャッシュを渡す", () => {
    assert.deepEqual(projectEnv("/w/plan.json", "/c/explainer-video"), {
      EXPLAINER_PLAN: "/w/plan.json",
      EXPLAINER_FS_ALLOW: "/c/explainer-video",
    })
  })
})
