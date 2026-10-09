import { describe, expect, it } from "vitest"
import { DOCKER_IMAGE, dockerLauncher, nativeLauncher } from "./engine.ts"

describe("launchers", () => {
  it("native は host と port を渡す", () => {
    expect(nativeLauncher("127.0.0.1", "50021")).toEqual({
      kind: "native",
      command: "voicevox-engine",
      args: ["--host", "127.0.0.1", "--port", "50021"],
    })
  })

  it("docker はコンテナの 50021 を指定の host:port に公開する", () => {
    const launcher = dockerLauncher("127.0.0.1", "50022")
    expect(launcher.args).toContain("127.0.0.1:50022:50021")
    expect(launcher.args.at(-1)).toBe(DOCKER_IMAGE)
  })
})
