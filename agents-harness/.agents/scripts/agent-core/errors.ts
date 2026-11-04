/**
 * CLI 全体で共有するエラー型。
 * ここは依存を持たせない（他のモジュールから一方向に参照される）。
 */

/** 使い方の誤り。exit code 2 で終了する。 */
export class UsageError extends Error {
  readonly exitCode = 2

  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

/** 実行時の失敗（対象が存在しない等）。exit code 1 で終了する。 */
export class CliError extends Error {
  readonly exitCode = 1

  constructor(message: string) {
    super(message)
    this.name = 'CliError'
  }
}

export function isUsageError(error: unknown): error is UsageError {
  return error instanceof UsageError
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError
}
