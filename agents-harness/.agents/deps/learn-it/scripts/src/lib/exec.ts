import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_MS = 10 * 60_000

/** 外部コマンドを実行する。失敗したら stderr をメッセージに含めて throw する */
export const run = async (
  command: string,
  args: readonly string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(command, [...args], {
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : ""
    throw new Error(`${command} が失敗しました:\n${stderr.slice(-4000)}`, { cause: error })
  }
}

/** コマンドが PATH にあり、実行できるか */
export const canRun = async (command: string, args: readonly string[]): Promise<boolean> =>
  execFileAsync(command, [...args], { timeout: 10_000 }).then(
    () => true,
    () => false,
  )
