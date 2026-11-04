import { describe, it, expect } from "vitest"
import { findPresentKeyPaths, removeKeyPaths } from "./remove-keys.ts"

describe("removeKeyPaths", () => {
  it("removes a nested key and keeps its siblings", () => {
    expect(
      removeKeyPaths({ env: { A: "1", B: "2" }, other: true }, [["env", "A"]])
    ).toEqual({ env: { B: "2" }, other: true })
  })

  it("removes a top-level key", () => {
    expect(removeKeyPaths({ a: 1, b: 2 }, [["a"]])).toEqual({ b: 2 })
  })

  it("ignores a path that does not exist", () => {
    const target = { env: { A: "1" }, list: [1], leaf: "x" }
    expect(
      removeKeyPaths(target, [["missing"], ["env", "Z"], ["x", "y"], ["list", "0"], ["leaf", "k"]])
    ).toEqual(target)
  })

  it("keeps an object left empty by the removal", () => {
    expect(removeKeyPaths({ env: { A: "1" } }, [["env", "A"]])).toEqual({ env: {} })
  })

  it("does not mutate the target", () => {
    const target = { env: { A: "1" } }
    removeKeyPaths(target, [["env", "A"]])
    expect(target).toEqual({ env: { A: "1" } })
  })
})

describe("findPresentKeyPaths", () => {
  it("returns the paths that exist in the object", () => {
    expect(
      findPresentKeyPaths({ env: { A: "1" } }, [["env", "A"], ["env", "B"], ["x"]])
    ).toEqual([["env", "A"]])
  })
})
