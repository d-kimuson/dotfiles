import { spawn } from "node:child_process"
import { join } from "node:path"
import { z } from "zod"
import { PROJECT_ROOT } from "../lib/paths.ts"

const Diagnostic = z.object({
  severity: z.string(),
  code: z.string(),
  message: z.string(),
  hint: z.string().optional(),
})
export type Diagnostic = z.infer<typeof Diagnostic>

/** motion-kit の --json が stdout に 1 つだけ書く封筒 (使う項目だけ) */
const Envelope = z.object({
  ok: z.boolean(),
  data: z.unknown(),
  diagnostics: z.array(Diagnostic),
})
export type Envelope = z.infer<typeof Envelope>

const MOTION_KIT_CLI = join(PROJECT_ROOT, "node_modules/@kimuson/motion-kit/dist/cli.js")

/** stdout に書かれた封筒を読む。読めなければ、見えた内容を添えて throw する */
export const parseEnvelope = (stdout: string): Envelope => {
  let json: unknown
  try {
    json = JSON.parse(stdout)
  } catch (error) {
    throw new Error(`motion-kit の出力が JSON ではありません:\n${stdout.slice(0, 2000)}`, {
      cause: error,
    })
  }
  const parsed = Envelope.safeParse(json)
  if (!parsed.success) {
    throw new Error(`motion-kit の出力が封筒の形ではありません:\n${stdout.slice(0, 2000)}`)
  }
  return parsed.data
}

export const describeDiagnostics = (diagnostics: readonly Diagnostic[]): string =>
  diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.code}: ${d.message}${d.hint === undefined ? "" : ` (${d.hint})`}`)
    .join("\n")

/**
 * motion-kit の CLI を PROJECT_ROOT で実行する。stderr (進捗やレンダラのログ) はそのまま流し、
 * 失敗は診断をメッセージにして throw する。成功したら data を返す
 */
export const runMotionKit = async (
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<unknown> => {
  const child = spawn(process.execPath, [MOTION_KIT_CLI, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "inherit"],
  })
  const chunks: Buffer[] = []
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", resolve)
  })
  const stdout = Buffer.concat(chunks).toString("utf8")
  if (stdout.trim() === "") {
    throw new Error(`motion-kit が結果を出さずに終了しました (exit ${String(code)})`)
  }
  const envelope = parseEnvelope(stdout)
  if (!envelope.ok || code !== 0) {
    const detail = describeDiagnostics(envelope.diagnostics) || `exit ${String(code)}`
    throw new Error(`motion-kit が失敗しました:\n${detail}`)
  }
  return envelope.data
}
