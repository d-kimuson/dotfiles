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
  await mkdir(configDir, { recursive: true })
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
          "openrouter/deepseek/deepseek-v4-flash-0731",
          "openrouter/moonshotai/kimi-k3",
        ],
        hard: [
          "openai-codex/gpt-5.5:xhigh",
          "opencode-go/kimi-k2.6:high",
          "anthropic/claude-fable-5:high",
        ],
        oracle: ["openai-codex/gpt-5.5:xhigh"],
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
        subagents: {
          agentOverrides: {
            worker: { disabled: true },
          },
        },
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
            model: "openai-codex/gpt-5.5",
            thinking: "xhigh",
          },
          worker: { disabled: true },
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
  })

  it("includes openrouter scoped models when openrouter is available", async () => {
    await writeBaseFiles()
    await writeFile(
      path.join(configDir, "providers.local.json"),
      JSON.stringify(
        {
          availableProviders: ["openai-codex", "openrouter"],
        },
        null,
        2
      ),
      "utf-8"
    )

    await deliverPiAgentConfig({ dryRun: false })

    expect(await readJson(path.join(targetDir, "settings.json"))).toMatchObject({
      defaultProvider: "openai-codex",
      defaultModel: "gpt-5.4",
      enabledModels: [
        "openai-codex/gpt-5.4",
        "openrouter/deepseek/deepseek-v4-flash-0731",
        "openrouter/moonshotai/kimi-k3",
      ],
    })
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

  it("merges managed zai custom models into existing models.json", async () => {
    await writeBaseFiles()
    await writeFile(
      path.join(configDir, "models.json"),
      JSON.stringify(
        {
          providers: {
            zai: {
              models: [
                {
                  id: "glm-5.3-flash",
                  name: "GLM-5.3-Flash",
                  api: "openai-completions",
                  reasoning: true,
                },
              ],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
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
        zai: {
          models: [
            {
              id: "glm-5.3-flash",
              name: "GLM-5.3-Flash",
              api: "openai-completions",
              reasoning: true,
            },
          ],
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
      availableProviders: ["opencode-go", "openai-codex"],
    })

    expect(await readJson(path.join(targetDir, "settings.json"))).toEqual({
      lastChangelogVersion: "0.74.0",
      packages: ["npm:pi-subagents"],
      defaultProvider: "opencode-go",
      defaultThinkingLevel: "high",
      subagents: {
        agentOverrides: {
          reviewer: {
            model: "openai-codex/gpt-5.5",
            thinking: "xhigh",
            fallbackModels: ["opencode-go/kimi-k2.6"],
          },
          oracle: {
            model: "openai-codex/gpt-5.5",
            thinking: "xhigh",
          },
          worker: { disabled: true },
          researcher: {
            model: "opencode-go/deepseek-v4-flash",
            thinking: "xhigh",
            fallbackModels: ["openai-codex/gpt-5.4-mini"],
          },
          scout: {
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
      },
      defaultModel: "deepseek-v4-pro",
      enabledModels: [
        "openai-codex/gpt-5.4",
        "opencode-go/deepseek-v4-pro",
        "opencode-go/glm-5.2",
      ],
    })

    await expect(
      readFile(path.join(targetDir, "agents/frontend_worker.md"), "utf-8")
    ).rejects.toMatchObject({ code: "ENOENT" })
  })
})
