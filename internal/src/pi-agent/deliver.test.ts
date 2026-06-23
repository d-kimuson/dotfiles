import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { deliverPiAgentConfig } from "./deliver.ts"

const testRootPrefix = path.join(tmpdir(), "deliver-pi-agent-test-")

let homeDir = ""
let configDir = ""
let targetDir = ""

const readJson = async (filePath: string): Promise<unknown> => {
  return JSON.parse(await readFile(filePath, "utf-8")) as unknown
}

beforeEach(async () => {
  homeDir = await mkdtemp(testRootPrefix)
  process.env["HOME"] = homeDir
  configDir = path.join(homeDir, ".local/share/chezmoi/config/pi-agent")
  targetDir = path.join(homeDir, ".pi/agent")

  await mkdir(path.join(configDir, "agents"), { recursive: true })
  await mkdir(path.join(homeDir, ".local/share/chezmoi/internal/src/pi-agent"), {
    recursive: true,
  })
})

afterEach(async () => {
  await rm(homeDir, { recursive: true, force: true })
})

const writeBaseFiles = async (): Promise<void> => {
  await writeFile(
    path.join(homeDir, ".local/share/chezmoi/internal/src/pi-agent/model-profiles.json"),
    JSON.stringify(
      {
        scoped: [
          "openai-codex/gpt-5.4:medium",
          "opencode-go/deepseek-v4-pro:high",
          "opencode-go/glm-5.2",
          "github-copilot/gpt-5.4:medium",
        ],
        hard: [
          "openai-codex/gpt-5.5:hard",
          "opencode-go/kimi-k2.6:high",
          "github-copilot/gpt-5.4:hard",
        ],
        medium: [
          "opencode-go/deepseek-v4-pro:high",
          "openai-codex/gpt-5.4:medium",
          "github-copilot/gpt-5.4:medium",
        ],
        light: [
          "opencode-go/deepseek-v4-flash:off",
          "openai-codex/gpt-5.4-mini:off",
          "github-copilot/gemini-3-flash-preview:off",
        ],
        design: [
          "opencode-go/kimi-k2.6:medium",
          "github-copilot/claude-sonnet-4-6:medium",
          "anthropic/claude-sonnet-4-6:medium",
        ],
      },
      null,
      2
    ),
    "utf-8"
  )

  await writeFile(
    path.join(configDir, "settings.json"),
    JSON.stringify(
      {
        lastChangelogVersion: "0.74.0",
        packages: ["npm:pi-subagents"],
      },
      null,
      2
    ),
    "utf-8"
  )

  await writeFile(
    path.join(configDir, "models.json"),
    JSON.stringify(
      {
        providers: {},
      },
      null,
      2
    ),
    "utf-8"
  )

  await writeFile(
    path.join(configDir, "agents/frontend_worker.md"),
    [
      "---",
      "name: frontend_worker",
      "description: Frontend UI implementation agent.",
      "systemPromptMode: replace",
      "skills: frontend-design",
      "---",
      "",
      "You are `frontend_worker`.",
      "",
    ].join("\n"),
    "utf-8"
  )
}

describe("deliverPiAgentConfig", () => {
  it("expands model profiles using configured available providers", async () => {
    await writeBaseFiles()
    await writeFile(
      path.join(configDir, "providers.local.json"),
      JSON.stringify(
        {
          availableProviders: ["opencode-go", "openai-codex"],
        },
        null,
        2
      ),
      "utf-8"
    )

    await deliverPiAgentConfig({ dryRun: false })

    expect(await readJson(path.join(targetDir, "settings.json"))).toEqual({
      lastChangelogVersion: "0.74.0",
      packages: ["npm:pi-subagents"],
      defaultProvider: "opencode-go",
      defaultModel: "deepseek-v4-pro",
      defaultThinkingLevel: "high",
      enabledModels: [
        "openai-codex/gpt-5.4",
        "opencode-go/deepseek-v4-pro",
        "opencode-go/glm-5.2",
      ],
      agentOverrides: {
        planner: {
          model: "openai-codex/gpt-5.5",
          thinking: "hard",
          fallbackModels: ["opencode-go/kimi-k2.6"],
        },
        reviewer: {
          model: "openai-codex/gpt-5.5",
          thinking: "hard",
          fallbackModels: ["opencode-go/kimi-k2.6"],
        },
        oracle: {
          model: "openai-codex/gpt-5.5",
          thinking: "hard",
          fallbackModels: ["opencode-go/kimi-k2.6"],
        },
        worker: {
          model: "opencode-go/deepseek-v4-pro",
          thinking: "high",
          fallbackModels: ["openai-codex/gpt-5.4"],
        },
        scout: {
          model: "opencode-go/deepseek-v4-flash",
          thinking: "off",
          fallbackModels: ["openai-codex/gpt-5.4-mini"],
        },
        researcher: {
          model: "opencode-go/deepseek-v4-flash",
          thinking: "off",
          fallbackModels: ["openai-codex/gpt-5.4-mini"],
        },
        "context-builder": {
          model: "opencode-go/deepseek-v4-flash",
          thinking: "off",
          fallbackModels: ["openai-codex/gpt-5.4-mini"],
        },
        delegate: {
          model: "opencode-go/deepseek-v4-flash",
          thinking: "off",
          fallbackModels: ["openai-codex/gpt-5.4-mini"],
        },
      },
    })

    const frontendWorker = await readFile(
      path.join(targetDir, "agents/frontend_worker.md"),
      "utf-8"
    )
    expect(frontendWorker).toContain("model: opencode-go/kimi-k2.6")
    expect(frontendWorker).toContain("thinking: medium")
    expect(frontendWorker).not.toContain("fallbackModels:")
    expect(frontendWorker).toContain("You are `frontend_worker`.")
  })

  it("preserves existing models when managed models.json is empty", async () => {
    await writeBaseFiles()
    await mkdir(targetDir, { recursive: true })
    await writeFile(
      path.join(targetDir, "models.json"),
      JSON.stringify(
        {
          providers: {
            "gateway-kimuson": {
              baseUrl: "https://gateway.example.test/v1",
              apiKey: "$GATEWAY_API_KEY",
              api: "openai-completions",
              models: [{ id: "private-model" }],
            },
            "opencode-go": {
              models: [{ id: "custom-opencode-model", name: "Custom" }],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )

    await deliverPiAgentConfig({ dryRun: false })

    expect(await readJson(path.join(targetDir, "models.json"))).toEqual({
      providers: {
        "gateway-kimuson": {
          baseUrl: "https://gateway.example.test/v1",
          apiKey: "$GATEWAY_API_KEY",
          api: "openai-completions",
          models: [{ id: "private-model" }],
        },
        "opencode-go": {
          models: [{ id: "custom-opencode-model", name: "Custom" }],
        },
      },
    })
  })

  it("uses cli providers and writes only built config", async () => {
    await writeBaseFiles()
    await mkdir(path.join(targetDir, "agents"), { recursive: true })
    await writeFile(
      path.join(targetDir, "settings.json"),
      JSON.stringify(
        {
          defaultProvider: "target-local",
          localOnly: true,
          agentOverrides: {
            scout: {
              localOnly: "not-preserved-because-agentOverrides-is-managed",
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    await writeFile(
      path.join(targetDir, "agents/frontend_worker.md"),
      [
        "---",
        "name: old_frontend_worker",
        "localOnly: keep",
        "model: old/model",
        "---",
        "",
        "old body",
        "",
      ].join("\n"),
      "utf-8"
    )

    await deliverPiAgentConfig({
      dryRun: false,
      availableProviders: ["github-copilot"],
    })

    expect(await readJson(path.join(targetDir, "settings.json"))).toEqual({
      lastChangelogVersion: "0.74.0",
      packages: ["npm:pi-subagents"],
      defaultProvider: "github-copilot",
      defaultThinkingLevel: "medium",
      agentOverrides: {
        planner: {
          model: "github-copilot/gpt-5.4",
          thinking: "hard"
        },
        reviewer: {
          model: "github-copilot/gpt-5.4",
          thinking: "hard"
        },
        oracle: {
          model: "github-copilot/gpt-5.4",
          thinking: "hard"
        },
        worker: {
          model: "github-copilot/gpt-5.4",
          thinking: "medium"
        },
        scout: {
          model: "github-copilot/gemini-3-flash-preview",
          thinking: "off"
        },
        researcher: {
          model: "github-copilot/gemini-3-flash-preview",
          thinking: "off"
        },
        "context-builder": {
          model: "github-copilot/gemini-3-flash-preview",
          thinking: "off"
        },
        delegate: {
          model: "github-copilot/gemini-3-flash-preview",
          thinking: "off"
        },
      },
      defaultModel: "gpt-5.4",
      enabledModels: ["github-copilot/gpt-5.4"],
    })

    const frontendWorker = await readFile(
      path.join(targetDir, "agents/frontend_worker.md"),
      "utf-8"
    )
    expect(frontendWorker).toContain("name: frontend_worker")
    expect(frontendWorker).toContain("model: github-copilot/claude-sonnet-4-6")
    expect(frontendWorker).not.toContain("localOnly: keep")
    expect(frontendWorker).not.toContain("old body")
  })
})
