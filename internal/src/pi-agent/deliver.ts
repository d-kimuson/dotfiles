import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path, { dirname } from "node:path"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

type JsonObject = Record<string, JsonValue>

type FrontmatterValue = string | number | boolean | readonly string[]
type Frontmatter = Record<string, FrontmatterValue>

type MarkdownAgent = {
  readonly frontmatter: Frontmatter
  readonly body: string
}

type ModelChoice = {
  readonly provider: string
  readonly modelName: string
  readonly modelId: string
  readonly thinking: string | null
}

type ModelProfiles = Record<string, readonly ModelChoice[]>

export type DeliverPiAgentOptions = {
  readonly dryRun: boolean
  readonly availableProviders?: readonly string[]
}

const SUPPORTED_PROVIDERS = [
  "opencode-go",
  "openai-codex",
  "github-copilot",
] as const

const AGENT_MODEL_PROFILES = {
  hard: ["planner", "reviewer", "oracle"],
  medium: ["worker"],
  low: ["scout", "researcher", "context-builder", "delegate"],
} as const

const getPaths = () => {
  const dotfilesRoot = path.join(homedir(), ".local/share/chezmoi")
  const piAgentConfigRoot = path.join(dotfilesRoot, "config/pi-agent")

  return {
    modelProfilesSource: path.join(
      dotfilesRoot,
      "internal/src/pi-agent/model-profiles.json"
    ),
    providersLocal: path.join(piAgentConfigRoot, "providers.local.json"),
    settingsSource: path.join(piAgentConfigRoot, "settings.json"),
    settingsLocal: path.join(piAgentConfigRoot, "settings.local.json"),
    settingsTarget: path.join(homedir(), ".pi/agent/settings.json"),
    frontendWorkerSource: path.join(
      piAgentConfigRoot,
      "agents/frontend_worker.md"
    ),
    frontendWorkerLocal: path.join(
      piAgentConfigRoot,
      "agents/frontend_worker.local.json"
    ),
    frontendWorkerTarget: path.join(
      homedir(),
      ".pi/agent/agents/frontend_worker.md"
    ),
  }
}

const isPlainObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const mergeTopLevel = (
  base: JsonObject,
  overlay: JsonObject | null
): JsonObject => {
  if (overlay === null) return base
  return { ...base, ...overlay }
}

const readOptionalText = async (filePath: string): Promise<string | null> => {
  try {
    return await readFile(filePath, "utf-8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw err
  }
}

const readJsonObject = async (filePath: string): Promise<JsonObject> => {
  const content = await readFile(filePath, "utf-8")
  const parsed = JSON.parse(content) as unknown
  if (!isPlainObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`)
  }
  return parsed
}

const readOptionalJsonObject = async (
  filePath: string
): Promise<JsonObject | null> => {
  const content = await readOptionalText(filePath)
  if (content === null) return null

  const parsed = JSON.parse(content) as unknown
  if (!isPlainObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`)
  }
  return parsed
}

const parseProviderName = (value: unknown, source: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Expected provider name string in ${source}`)
  }
  if (!SUPPORTED_PROVIDERS.includes(value as (typeof SUPPORTED_PROVIDERS)[number])) {
    throw new Error(
      `Unsupported provider in ${source}: ${value}. Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}`
    )
  }
  return value
}

const readLocalProviders = async (
  filePath: string
): Promise<readonly string[] | null> => {
  const config = await readOptionalJsonObject(filePath)
  if (config === null) return null

  const providers = config["availableProviders"]
  if (!Array.isArray(providers)) {
    throw new Error(`Expected availableProviders array in ${filePath}`)
  }

  return providers.map((provider) => parseProviderName(provider, filePath))
}

const resolveAvailableProviders = async (
  filePath: string,
  cliProviders: readonly string[] | undefined
): Promise<readonly string[]> => {
  if (cliProviders !== undefined) {
    return cliProviders.map((provider) => parseProviderName(provider, "--providers"))
  }

  const localProviders = await readLocalProviders(filePath)
  return localProviders ?? SUPPORTED_PROVIDERS
}

const parseModelChoice = (value: unknown, source: string): ModelChoice => {
  if (typeof value !== "string") {
    throw new Error(`Expected model profile entry string in ${source}`)
  }

  const [modelId, thinking, ...extraParts] = value.split(":")
  if (
    modelId === undefined ||
    extraParts.length > 0 ||
    modelId.trim() === "" ||
    thinking === ""
  ) {
    throw new Error(
      `Expected model profile entry format provider/model or provider/model:thinking in ${source}: ${value}`
    )
  }

  const slashIndex = modelId.indexOf("/")
  if (slashIndex <= 0 || slashIndex === modelId.length - 1) {
    throw new Error(
      `Expected model id format provider/model in ${source}: ${value}`
    )
  }

  return {
    provider: modelId.slice(0, slashIndex),
    modelName: modelId.slice(slashIndex + 1),
    modelId,
    thinking: thinking ?? null,
  }
}

const readModelProfiles = async (filePath: string): Promise<ModelProfiles> => {
  const raw = await readJsonObject(filePath)
  const profiles: Record<string, readonly ModelChoice[]> = {}

  for (const [profileName, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) {
      throw new Error(`Expected array for model profile ${profileName} in ${filePath}`)
    }
    profiles[profileName] = entries.map((entry) =>
      parseModelChoice(entry, `${filePath}.${profileName}`)
    )
  }

  return profiles
}

const getProfileChoices = (
  profiles: ModelProfiles,
  profileName: string
): readonly ModelChoice[] => {
  const choices = profiles[profileName]
  if (choices !== undefined) return choices

  if (profileName === "low") {
    const lightChoices = profiles["light"]
    if (lightChoices !== undefined) return lightChoices
  }

  throw new Error(`Missing model profile: ${profileName}`)
}

const filterProfileChoices = (
  profiles: ModelProfiles,
  profileName: string,
  availableProviders: readonly string[]
): readonly ModelChoice[] => {
  const choices = getProfileChoices(profiles, profileName).filter((choice) =>
    availableProviders.includes(choice.provider)
  )

  if (choices.length === 0) {
    throw new Error(
      `No models remain for profile ${profileName}. Available providers: ${availableProviders.join(", ")}`
    )
  }

  return choices
}

const firstChoice = (
  choices: readonly ModelChoice[],
  profileName: string
): ModelChoice => {
  const choice = choices[0]
  if (choice === undefined) {
    throw new Error(`No models remain for profile ${profileName}`)
  }
  return choice
}

const getThinking = (choice: ModelChoice, profileName: string): string => {
  if (choice.thinking !== null) return choice.thinking
  throw new Error(`Missing thinking level for profile ${profileName}: ${choice.modelId}`)
}

const buildAgentModelConfig = (
  choices: readonly ModelChoice[],
  profileName: string
): JsonObject => {
  const primary = firstChoice(choices, profileName)
  const thinking = getThinking(primary, profileName)
  const fallbackModels = choices.slice(1).map((choice) => choice.modelId)
  return fallbackModels.length === 0
    ? {
        model: primary.modelId,
        thinking,
      }
    : {
        model: primary.modelId,
        thinking,
        fallbackModels,
      }
}

const buildGeneratedSettings = (
  profiles: ModelProfiles,
  availableProviders: readonly string[]
): JsonObject => {
  const scoped = filterProfileChoices(profiles, "scoped", availableProviders)
  const medium = filterProfileChoices(profiles, "medium", availableProviders)
  const defaultChoice = firstChoice(medium, "medium")
  const defaultThinkingLevel = getThinking(defaultChoice, "medium")
  const agentOverrides: JsonObject = {}

  for (const [profileName, agentNames] of Object.entries(AGENT_MODEL_PROFILES)) {
    const choices = filterProfileChoices(profiles, profileName, availableProviders)
    for (const agentName of agentNames) {
      agentOverrides[agentName] = buildAgentModelConfig(choices, profileName)
    }
  }

  return {
    defaultProvider: defaultChoice.provider,
    defaultModel: defaultChoice.modelName,
    defaultThinkingLevel,
    enabledModels: scoped.map((choice) => choice.modelId),
    agentOverrides,
  }
}

const buildGeneratedFrontendWorker = (
  profiles: ModelProfiles,
  availableProviders: readonly string[]
): Frontmatter => {
  const design = filterProfileChoices(profiles, "design", availableProviders)
  const primary = firstChoice(design, "design")
  const thinking = getThinking(primary, "design")

  const fallbackModels = design.slice(1).map((choice) => choice.modelId)
  return fallbackModels.length === 0
    ? {
        model: primary.modelId,
        thinking,
      }
    : {
        model: primary.modelId,
        thinking,
        fallbackModels,
      }
}

const materializeJsonConfig = async (
  sourcePath: string,
  localPath: string,
  targetPath: string,
  generated: JsonObject,
  dryRun: boolean
): Promise<void> => {
  const base = await readJsonObject(sourcePath)
  const local = await readOptionalJsonObject(localPath)
  const built = mergeTopLevel(mergeTopLevel(base, generated), local)

  const targetExists = (await readOptionalText(targetPath)) !== null
  const output = JSON.stringify(built, null, 2) + "\n"

  if (dryRun) {
    console.log(`  [dry-run] Would write to: ${targetPath}`)
    console.log(output)
    return
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, output, "utf-8")
  console.log(`${targetExists ? "Updated" : "Created"}: ${targetPath}`)
}

const parseFrontmatter = (content: string, filePath: string): MarkdownAgent => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (match === null) {
    throw new Error(`Expected frontmatter block in ${filePath}`)
  }

  const rawFrontmatter = match[1]
  const body = match[2]
  if (rawFrontmatter === undefined || body === undefined) {
    throw new Error(`Failed to parse frontmatter block in ${filePath}`)
  }

  const frontmatter: Frontmatter = {}
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    if (line.trim() === "") continue

    const lineMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (lineMatch === null) {
      throw new Error(`Unsupported frontmatter line in ${filePath}: ${line}`)
    }

    const key = lineMatch[1]
    const value = lineMatch[2]
    if (key === undefined || value === undefined) {
      throw new Error(`Unsupported frontmatter line in ${filePath}: ${line}`)
    }
    frontmatter[key] = value
  }

  return { frontmatter, body }
}

const readMarkdownAgent = async (filePath: string): Promise<MarkdownAgent> => {
  return parseFrontmatter(await readFile(filePath, "utf-8"), filePath)
}

const readOptionalFrontmatterOverride = async (
  filePath: string
): Promise<Frontmatter | null> => {
  const parsed = await readOptionalJsonObject(filePath)
  if (parsed === null) return null

  for (const [key, value] of Object.entries(parsed)) {
    const isValidArray =
      Array.isArray(value) && value.every((item) => typeof item === "string")
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      !isValidArray
    ) {
      throw new Error(
        `Expected string, number, boolean, or string[] for ${key} in ${filePath}`
      )
    }
  }

  return parsed as Frontmatter
}

const serializeFrontmatterValue = (value: FrontmatterValue): string => {
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

const serializeMarkdownAgent = (agent: MarkdownAgent): string => {
  const frontmatter = Object.entries(agent.frontmatter)
    .map(([key, value]) => `${key}: ${serializeFrontmatterValue(value)}`)
    .join("\n")

  return `---\n${frontmatter}\n---\n${agent.body}`
}

const materializeMarkdownAgent = async (
  sourcePath: string,
  localPath: string,
  targetPath: string,
  generated: Frontmatter,
  dryRun: boolean
): Promise<void> => {
  const base = await readMarkdownAgent(sourcePath)
  const local = await readOptionalFrontmatterOverride(localPath)
  const built: MarkdownAgent = {
    frontmatter: {
      ...base.frontmatter,
      ...generated,
      ...(local ?? {}),
    },
    body: base.body,
  }

  const targetExists = (await readOptionalText(targetPath)) !== null
  const output = serializeMarkdownAgent(built)

  if (dryRun) {
    console.log(`  [dry-run] Would write to: ${targetPath}`)
    console.log(output)
    return
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, output, "utf-8")
  console.log(`${targetExists ? "Updated" : "Created"}: ${targetPath}`)
}

export const deliverPiAgentConfig = async (
  options: DeliverPiAgentOptions
): Promise<void> => {
  if (options.dryRun) {
    console.log("[dry-run mode]")
  }

  const paths = getPaths()
  const profiles = await readModelProfiles(paths.modelProfilesSource)
  const availableProviders = await resolveAvailableProviders(
    paths.providersLocal,
    options.availableProviders
  )

  console.log(`Available providers: ${availableProviders.join(", ")}`)

  console.log("\npi-agent settings")
  await materializeJsonConfig(
    paths.settingsSource,
    paths.settingsLocal,
    paths.settingsTarget,
    buildGeneratedSettings(profiles, availableProviders),
    options.dryRun
  )

  console.log("\npi-agent frontend_worker")
  await materializeMarkdownAgent(
    paths.frontendWorkerSource,
    paths.frontendWorkerLocal,
    paths.frontendWorkerTarget,
    buildGeneratedFrontendWorker(profiles, availableProviders),
    options.dryRun
  )

  console.log("\nDone.")
}
