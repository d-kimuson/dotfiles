import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(CURRENT_DIR, "../../..")
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "chezmoi/dot_gemini/antigravity-cli/executable_statusline.sh"
)

const GREEN = "\x1b[92m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[91m"
const RESET = "\x1b[0m"

const tempDirs: string[] = []

const createTempDir = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "agy-statusline-test-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

const runStatusline = (
  payload: unknown,
  envOverrides: Readonly<Record<string, string>> = {}
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } => {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload)
  const defaultHome = envOverrides["HOME"] ?? createTempDir()
  const result = spawnSync("/bin/bash", [SCRIPT_PATH], {
    input,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: defaultHome,
      TZ: "UTC",
      LC_TIME: "C",
      ...envOverrides,
    },
  })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

describe("antigravity statusline.sh", () => {
  it("renders version, directory, git info, context bar, deduplicated effort, and sorted quota buckets", () => {
    const home = createTempDir()
    const repoDir = path.join(home, "work", "sample-repo")
    const init = spawnSync("git", ["init", "-b", "feat/statusline", repoDir], {
      encoding: "utf-8",
    })
    expect(init.status).toBe(0)

    const { status, stdout, stderr } = runStatusline(
      {
        version: "1.5.16",
        workspace: { current_dir: repoDir },
        model: {
          id: "Gemini 4 Neon (High)",
          display_name: "Gemini 4 Neon (High)",
          effort: "high",
        },
        context_window: { used_percentage: 24.8 },
        quota: {
          "gemini-weekly": {
            remaining_fraction: 0.9378,
            reset_time: "2026-07-06T07:50:32Z",
            reset_in_seconds: 544320, // 10% elapsed of 604800s -> 6% used < 10% -> GREEN
          },
          "gemini-5h": {
            remaining_fraction: 0.4,
            reset_time: "2026-07-01T15:00:00Z",
            reset_in_seconds: 10800, // 40% elapsed of 18000s -> 60% used - 40% >= 10 -> RED
          },
        },
      },
      { HOME: home }
    )

    expect(stderr).toBe("")
    expect(status).toBe(0)
    const lines = stdout.trimEnd().split("\n")
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe("agy@1.5.16 at ~/work/sample-repo")
    expect(lines[1]).toBe("⎇ feat/statusline | 🐙 sample-repo")
    expect(lines[2]).toBe("🧠 ██░░░░░░░░ 24% | Gemini 4 Neon | high")
    expect(lines[3]).toContain(`💰 gemini 5h ${RED}60%${RESET} (🔄 `)
    expect(lines[3]).toContain(", 40%) | ")
    expect(lines[3]).toContain(`gemini 7d ${GREEN}6%${RESET} (🔄 `)
    expect(lines[3]).toContain(", 10%)")
  })

  it("colors pace yellow when usage is within 0..9 points ahead of elapsed and green at 0% usage", () => {
    const dir = createTempDir()
    const { status, stdout } = runStatusline({
      version: "1.5.16",
      cwd: dir,
      model: { display_name: "Gemini 4 Flash" },
      context_window: { used_percentage: 0 },
      quota: {
        "gemini-5h": {
          remaining_fraction: 0.55, // 45% used
          reset_in_seconds: 10800, // 40% elapsed -> diff +5 -> YELLOW
        },
        "gemini-weekly": {
          remaining_fraction: 1.0, // 0% used
          reset_in_seconds: 604800, // 0% elapsed -> 0% usage stays GREEN
        },
      },
    })

    expect(status).toBe(0)
    const lines = stdout.trimEnd().split("\n")
    expect(lines[1]).toBe("🧠 ░░░░░░░░░░ 0% | Gemini 4 Flash")
    expect(lines[2]).toContain(`gemini 5h ${YELLOW}45%${RESET}`)
    expect(lines[2]).toContain(`gemini 7d ${GREEN}0%${RESET}`)
  })

  it("skips disabled buckets, handles remaining_amount and unknown bucket ids, and falls back to fractional-second reset_time", () => {
    const dir = createTempDir()
    const futureIsoWithMillis = new Date(Date.now() + 3 * 3600 * 1000).toISOString()

    const { status, stdout } = runStatusline({
      version: "1.5.16",
      cwd: dir,
      model: { display_name: "Gemini 4 Pro" },
      context_window: { used_percentage: 10 },
      quota: {
        "disabled-bucket": {
          remaining_fraction: 0.1,
          disabled: true,
        },
        "credits-pool": {
          remaining_amount: 420,
        },
        "custom-pool": {
          remaining_fraction: 0.05, // 95% used -> RED without elapsed%
          reset_time: futureIsoWithMillis,
        },
        "3p-5h": {
          remaining_fraction: 0.8, // 20% used
          reset_time: futureIsoWithMillis, // ~40% elapsed of 5h -> GREEN
        },
      },
    })

    expect(status).toBe(0)
    const lines = stdout.trimEnd().split("\n")
    const usageLine = lines[lines.length - 1] ?? ""
    expect(usageLine).not.toContain("disabled-bucket")
    expect(usageLine).toMatch(
      new RegExp(`3p 5h \\x1b\\[92m20%\\x1b\\[0m \\(🔄 [^,]+, (39|40|41)%\\)`)
    )
    expect(usageLine).toContain("credits-pool rem 420")
    expect(usageLine).toContain(`custom-pool ${RED}95%${RESET} (🔄 `)
    expect(usageLine).not.toMatch(/custom-pool.*,\s*\d+%/)
  })

  it("handles empty string fields, missing model, empty quota, and invalid stdin without column shift or failure", () => {
    const empty = runStatusline("")
    expect(empty.status).toBe(0)
    expect(empty.stdout).toBe("agy at ~\n🧠 ░░░░░░░░░░ 0% | unknown\n")

    const emptyStrings = runStatusline({
      version: "",
      workspace: { current_dir: "" },
      cwd: "",
      model: { display_name: "Gemini 4 Flash", effort: "" },
      context_window: { used_percentage: 12 },
      vcs: { branch: "" },
      quota: {
        "": { remaining_fraction: 0.5 },
      },
    })
    expect(emptyStrings.status).toBe(0)
    expect(emptyStrings.stdout).toBe("agy at ~\n🧠 █░░░░░░░░░ 12% | Gemini 4 Flash\n")

    const nullModel = runStatusline({
      version: "1.5.16",
      model: null,
      context_window: null,
      quota: {},
    })
    expect(nullModel.status).toBe(0)
    expect(nullModel.stdout).toBe("agy@1.5.16 at ~\n🧠 ░░░░░░░░░░ 0% | unknown\n")
  })
})
