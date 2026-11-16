import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DOCKER_IMAGE, dockerLauncher, nativeLauncher } from "./engine.ts"

describe("launchers", () => {
  it("native は host と port を渡す", () => {
    assert.deepEqual(nativeLauncher("127.0.0.1", "50021"), {
      kind: "native",
      command: "voicevox-engine",
      args: ["--host", "127.0.0.1", "--port", "50021"],
    })
  })

  it("docker はコンテナの 50021 を指定の host:port に公開する", () => {
    const launcher = dockerLauncher("127.0.0.1", "50022")
    assert.ok(launcher.args.includes("127.0.0.1:50022:50021"))
    assert.equal(launcher.args.at(-1), DOCKER_IMAGE)
  })
})
