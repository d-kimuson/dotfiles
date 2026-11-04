import { describe, expect, it } from "vitest"
import { cacheDir, episodePaths } from "./paths.ts"

describe("episodePaths", () => {
  it("台本の隣の out/<ファイル名>/ に出力する", () => {
    expect(episodePaths("/w/ddd/main.json")).toEqual({ name: "main", outDir: "/w/ddd/out/main" })
    expect(episodePaths("/w/ddd/supplement-1.json").outDir).toBe("/w/ddd/out/supplement-1")
  })
})

describe("cacheDir", () => {
  it("XDG_CACHE_HOME があればその下を使う", () => {
    expect(cacheDir({ XDG_CACHE_HOME: "/c" })).toBe("/c/learn-it")
  })
})
