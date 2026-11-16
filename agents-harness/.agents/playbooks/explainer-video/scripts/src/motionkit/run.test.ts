import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { describeDiagnostics, parseEnvelope } from "./run.ts"

const envelope = (ok: boolean, diagnostics: unknown[]): string =>
  JSON.stringify({ schemaVersion: 1, command: "render", ok, data: { output: "/o.mp4" }, diagnostics })

describe("parseEnvelope", () => {
  it("封筒の ok・data・diagnostics を読む", () => {
    const parsed = parseEnvelope(envelope(true, []))
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.data, { output: "/o.mp4" })
  })

  it("JSON でなければ、見えた内容を添えて失敗する", () => {
    assert.throws(() => parseEnvelope("rendering 10%"), /JSON ではありません:\nrendering 10%/)
  })

  it("封筒の形でなければ失敗する", () => {
    assert.throws(() => parseEnvelope('{"ok":true}'), /封筒の形/)
  })
})

describe("describeDiagnostics", () => {
  it("error だけをコードとヒント付きで並べる", () => {
    const parsed = parseEnvelope(
      envelope(false, [
        { severity: "warning", code: "w.x", message: "warn" },
        { severity: "error", code: "asset.load-failed", message: "no file", hint: "check path" },
      ]),
    )
    assert.equal(describeDiagnostics(parsed.diagnostics), "asset.load-failed: no file (check path)")
  })
})
