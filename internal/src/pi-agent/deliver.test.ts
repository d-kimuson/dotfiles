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
})

afterEach(async () => {
  await rm(homeDir, { recursive: true, force: true })
})

const writeBaseFiles = async (): Promise<void> => {
  await writeFile(
    path.join(configDir, "model-profiles.json"),
    JSON.stringify(
      {
        scoped: [
          "zai/glm-5.3",
          "openai-codex/gpt-5.4:medium",
          "opencode-go/deepseek-v4-pro:high",
          "opencode-go/glm-5.2",
        ],
        hard: [
          "openai-codex/gpt-5.5:xhigh",
          "opencode-go/kimi-k2.6:high",
          "anthropic/claude-fable-5:high",
        ],
        medium: [
          "zai/glm-5.3:high",
          "opencode-go/deepseek-v4-pro:high",
          "openai-codex/gpt-5.4:medium",
          "anthropic/claude-opus-4-8:high",
        ],
        light: [
          "opencode-go/deepseek-v4-flash:off",
          "openai-codex/gpt-5.4-mini:off",
          "anthropic/claude-haiku-4-5:off",
        ],
        reasoning: [
          "opencode-go/deepseek-v4-flash:xhigh",
          "openai-codex/gpt-5.4-mini:xhigh",
          "anthropic/claude-opus-4-8:high",
        ],
        design: [
          "opencode-go/kimi-k2.6:medium",
          "opencode-go/glm-5.2:medium",
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
      "output: .agents/tmp/context.md",
      "defaultReads: .agents/tmp/context.md",
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
          availableProviders: ["opencode-go", "openai-codex", "anthropic", "zai"],
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
      defaultProvider: "zai",
      defaultModel: "glm-5.3",
      defaultThinkingLevel: "high",
      enabledModels: [
        "zai/glm-5.3",
        "openai-codex/gpt-5.4",
        "opencode-go/deepseek-v4-pro",
        "opencode-go/glm-5.2",
      ],
      subagents: {
        agentOverrides: {
          reviewer: {
            model: "openai-codex/gpt-5.5",
            thinking: "xhigh",
            fallbackModels: ["opencode-go/kimi-k2.6", "anthropic/claude-fable-5"],
          },
          oracle: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
            fallbackModels: ["openai-codex/gpt-5.4-mini", "anthropic/claude-opus-4-8"],
          },
          worker: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
            fallbackModels: ["openai-codex/gpt-5.4-mini", "anthropic/claude-opus-4-8"],
          },
          researcher: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
            fallbackModels: ["openai-codex/gpt-5.4-mini", "anthropic/claude-opus-4-8"],
          },
          scout: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "off",
            fallbackModels: ["openai-codex/gpt-5.4-mini", "anthropic/claude-haiku-4-5"],
          },
          delegate: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "off",
            fallbackModels: ["openai-codex/gpt-5.4-mini", "anthropic/claude-haiku-4-5"],
          },
        },
      },
    })

    const frontendWorker = await readFile(
      path.join(targetDir, "agents/frontend_worker.md"),
      "utf-8"
    )
    expect(frontendWorker).toContain("model: opencode-go/kimi-k2.6")
    expect(frontendWorker).toContain("thinking: medium")
    expect(frontendWorker).toContain("fallbackModels: opencode-go/glm-5.2")
    expect(frontendWorker).toContain("output: .agents/tmp/context.md")
    expect(frontendWorker).toContain("defaultReads: .agents/tmp/context.md")
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
      availableProviders: ["opencode-go"],
    })

    expect(await readJson(path.join(targetDir, "settings.json"))).toEqual({
      lastChangelogVersion: "0.74.0",
      packages: ["npm:pi-subagents"],
      defaultProvider: "opencode-go",
      defaultThinkingLevel: "high",
      subagents: {
        agentOverrides: {
          reviewer: {
            model: "opencode-go/kimi-k2.6",
            thinking: "high",
          },
          oracle: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
          },
          worker: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
          },
          researcher: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
          },
          scout: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "off",
          },
          delegate: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "off",
          },
        },
      },
      defaultModel: "deepseek-v4-pro",
      enabledModels: ["opencode-go/deepseek-v4-pro", "opencode-go/glm-5.2"],
    })

    const frontendWorker = await readFile(
      path.join(targetDir, "agents/frontend_worker.md"),
      "utf-8"
    )
    expect(frontendWorker).toContain("name: frontend_worker")
    expect(frontendWorker).toContain("model: opencode-go/kimi-k2.6")
    expect(frontendWorker).not.toContain("localOnly: keep")
    expect(frontendWorker).not.toContain("old body")
  })
})
