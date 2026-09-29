import { describe, it, expect } from "vitest"
import { diffKeyPaths, formatDryRunReport } from "./describe-changes.ts"

describe("diffKeyPaths", () => {
  it("returns no changes for equal objects", () => {
    expect(diffKeyPaths({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual([])
  })

  it("reports added, changed and removed leaf paths", () => {
    expect(
      diffKeyPaths(
        { keep: 1, change: "old", remove: true },
        { keep: 1, change: "new", add: "x" }
      )
    ).toEqual([
      { kind: "changed", path: "change" },
      { kind: "removed", path: "remove" },
      { kind: "added", path: "add" },
    ])
  })

  it("descends into nested objects and reports dotted paths", () => {
    expect(
      diffKeyPaths(
        { mcp: { servers: { a: { env: { TOKEN: "old" } } } } },
        { mcp: { servers: { a: { env: { TOKEN: "new" } }, b: { url: "u" } } } }
      )
    ).toEqual([
      { kind: "changed", path: "mcp.servers.a.env.TOKEN" },
      { kind: "added", path: "mcp.servers.b" },
    ])
  })

  it("treats arrays as leaf values", () => {
    expect(diffKeyPaths({ args: ["a"] }, { args: ["a", "b"] })).toEqual([
      { kind: "changed", path: "args" },
    ])
  })

  it("treats a missing target as an empty object", () => {
    expect(diffKeyPaths(null, { a: 1, b: { c: 2 } })).toEqual([
      { kind: "added", path: "a" },
      { kind: "added", path: "b" },
    ])
  })
})

describe("formatDryRunReport", () => {
  it("lists changed key paths without values", () => {
    const report = formatDryRunReport("/tmp/target.json", [
      { kind: "added", path: "a" },
      { kind: "changed", path: "b.c" },
      { kind: "removed", path: "d" },
    ])
    expect(report).toBe(
      [
        "  [dry-run] Would write to: /tmp/target.json",
        "    + a",
        "    ~ b.c",
        "    - d",
      ].join("\n")
    )
  })

  it("says so when nothing changes", () => {
    expect(formatDryRunReport("/tmp/target.json", [])).toBe(
      ["  [dry-run] Would write to: /tmp/target.json", "    (no changes)"].join("\n")
    )
  })
})
