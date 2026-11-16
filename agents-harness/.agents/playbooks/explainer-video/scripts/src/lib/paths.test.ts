import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cacheDir, episodePaths, PROJECT_ROOT, VIDEO_ENTRY } from "./paths.ts"
import { access } from "node:fs/promises"
import { join } from "node:path"

describe("episodePaths", () => {
  it("台本の隣の out/<ファイル名>/ に出力する", () => {
    assert.deepEqual(episodePaths("/w/ddd/main.json"), { name: "main", outDir: "/w/ddd/out/main" })
    assert.equal(episodePaths("/w/ddd/supplement-1.json").outDir, "/w/ddd/out/supplement-1")
  })
})

describe("cacheDir", () => {
  it("XDG_CACHE_HOME があればその下を使う", () => {
    assert.equal(cacheDir({ XDG_CACHE_HOME: "/c" }), "/c/explainer-video")
  })
})

describe("PROJECT_ROOT", () => {
  it("package.json と motion-kit のエントリがあるディレクトリを指す", async () => {
    await access(join(PROJECT_ROOT, "package.json"))
    await access(join(PROJECT_ROOT, VIDEO_ENTRY))
  })
})
