import { type ChildProcess, spawn } from "node:child_process"
import { once } from "node:events"
import { setTimeout as sleep } from "node:timers/promises"
import { canRun, run } from "../lib/exec.ts"
import { createVoicevoxClient, type VoicevoxClient } from "./api.ts"

/** 初回はモデルの読み込みで時間がかかる */
const STARTUP_TIMEOUT_MS = 180_000
const POLL_INTERVAL_MS = 1000
/** SIGTERM で止まらなければ SIGKILL する */
const SHUTDOWN_GRACE_MS = 5000
/** イメージの取得は数 GB あるので待つ */
const PULL_TIMEOUT_MS = 30 * 60_000

export const DOCKER_IMAGE = "voicevox/voicevox_engine:cpu-latest"
const DOCKER_CONTAINER = "learn-it-voicevox"

/** エンジンを起動する方法。nixpkgs の voicevox-engine は Linux 専用なので、macOS では Docker を使う */
export type Launcher =
  | { readonly kind: "native"; readonly command: string; readonly args: readonly string[] }
  | { readonly kind: "docker"; readonly args: readonly string[] }

export const nativeLauncher = (hostname: string, port: string): Launcher => ({
  kind: "native",
  command: "voicevox-engine",
  args: ["--host", hostname, "--port", port],
})

export const dockerLauncher = (hostname: string, port: string): Launcher => ({
  kind: "docker",
  args: [
    "run",
    "--rm",
    "--name",
    DOCKER_CONTAINER,
    "-p",
    `${hostname}:${port}:50021`,
    DOCKER_IMAGE,
  ],
})

const chooseLauncher = async (
  hostname: string,
  port: string,
  log: (m: string) => void,
): Promise<Launcher> => {
  if (await canRun("voicevox-engine", ["--help"])) return nativeLauncher(hostname, port)
  if (await canRun("docker", ["info"])) {
    if (!(await canRun("docker", ["image", "inspect", DOCKER_IMAGE]))) {
      log(`  ${DOCKER_IMAGE} を取得しています (初回のみ。数 GB あります)`)
      await run("docker", ["pull", DOCKER_IMAGE], PULL_TIMEOUT_MS)
    }
    return dockerLauncher(hostname, port)
  }
  throw new Error(
    "VOICEVOX ENGINE を起動できません。voicevox-engine コマンドか、起動済みの Docker が必要です。" +
      " 別の場所で起動済みなら VOICEVOX_URL でその URL を渡してください",
  )
}

const stop = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, "exit")
  child.kill("SIGTERM")
  const timer = setTimeout(() => child.kill("SIGKILL"), SHUTDOWN_GRACE_MS)
  try {
    await exited
  } finally {
    clearTimeout(timer)
  }
}

const isUp = async (client: VoicevoxClient): Promise<boolean> =>
  client.version().then(
    () => true,
    () => false,
  )

/**
 * VOICEVOX ENGINE を使って fn を実行する。
 * すでに起動していればそれを使い、なければ起動して、終わったら止める。
 */
export const withVoicevox = async <T>(
  baseUrl: string,
  log: (message: string) => void,
  fn: (client: VoicevoxClient) => Promise<T>,
): Promise<T> => {
  const client = createVoicevoxClient(baseUrl)
  if (await isUp(client)) return fn(client)

  // docker の -p はホスト名を受け付けないことがあるので、VOICEVOX_URL のホストは IP で書く
  const { hostname, port } = new URL(baseUrl)
  const launcher = await chooseLauncher(hostname, port || "80", log)
  log(`  VOICEVOX ENGINE を起動しています (${baseUrl}、${launcher.kind})`)
  const [command, args] =
    launcher.kind === "native" ? [launcher.command, launcher.args] : ["docker", launcher.args]
  const child = spawn(command, [...args], { stdio: ["ignore", "ignore", "pipe"] })
  let stderr = ""
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000)
  })
  const exited = new Promise<never>((_, reject) => {
    child.once("error", (error) => {
      reject(new Error(`${command} を起動できません`, { cause: error }))
    })
    child.once("exit", (code) => {
      reject(new Error(`VOICEVOX ENGINE が終了しました (code ${code}):\n${stderr}`))
    })
  })

  try {
    const started = performance.now()
    const waitUntilUp = async (): Promise<void> => {
      while (!(await isUp(client))) {
        if (performance.now() - started > STARTUP_TIMEOUT_MS) {
          throw new Error(
            `VOICEVOX ENGINE が ${STARTUP_TIMEOUT_MS / 1000} 秒以内に起動しませんでした`,
          )
        }
        await sleep(POLL_INTERVAL_MS)
      }
    }
    await Promise.race([waitUntilUp(), exited])
    return await Promise.race([fn(client), exited])
  } finally {
    child.removeAllListeners("exit")
    // fn が先に終わったあと子プロセスの終了で exited が reject しても unhandledRejection にしない
    exited.catch(() => {})
    await stop(child)
    // docker run のクライアントが先に落ちてもコンテナを残さない
    if (launcher.kind === "docker") await canRun("docker", ["rm", "-f", DOCKER_CONTAINER])
  }
}
