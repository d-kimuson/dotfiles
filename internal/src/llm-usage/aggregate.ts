import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type AggregateLlmUsageOptions = {
  readonly usageRoot: string
  readonly sessionsRoot: string
  readonly machineId: string
}

type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

type PriceRates = {
  readonly inputPerMillionUsd: number
  readonly outputPerMillionUsd: number
  readonly cacheReadPerMillionUsd: number
  readonly cacheWritePerMillionUsd: number
}

type QuotaRates = PriceRates

type PriceTier = PriceRates & {
  readonly inputTokensAbove: number
}

type PriceCondition = PriceRates & {
  readonly weekdays: readonly number[]
  readonly startUtcMinute: number
  readonly endUtcMinute: number
  readonly quotaMultiplier: number
  readonly quotaRates: QuotaRates | null
}

type PriceRevision = PriceRates & {
  readonly modelIdentifier: string
  readonly applyFrom: string
  readonly quotaMultiplier: number
  readonly quotaRates: QuotaRates | null
  readonly tiers: readonly PriceTier[]
  readonly conditions: readonly PriceCondition[]
}

type EffectivePrice = PriceRates & {
  readonly applyFrom: string
  readonly quotaMultiplier: number
  readonly quotaRates: QuotaRates | null
}

type Pricing = {
  readonly prices: readonly PriceRevision[]
}

type UsageEvent = {
  readonly dedupeKey: string
  readonly occurredAt: string
  readonly modelIdentifier: string
  readonly tokens: Tokens
}

type QuotaWindow = {
  readonly provider: string
  readonly accountAlias: string
  readonly kind: string
  readonly resetAt: string | null
  readonly usedPercent: number
  readonly observedAt: string
}

type QuotaObservation = {
  readonly observedAt: string
  readonly windows: readonly QuotaWindow[]
}

type PricedUsageEvent = {
  readonly event: UsageEvent
  readonly price: EffectivePrice | null
}

type IntervalUsageAggregate = {
  requestCount: number
  pricedRequestCount: number
  tokens: Tokens
  retailCostUsd: number
  quotaEquivalentCostUsd: number
  readonly unpricedModelIdentifiers: Set<string>
}

type QuotaWindowAggregate = {
  readonly provider: string
  readonly accountAlias: string
  readonly kind: string
  resetAt: string | null
  firstUsedPercent: number
  lastUsedPercent: number
  minUsedPercent: number
  maxUsedPercent: number
  firstObservedAt: string
  lastObservedAt: string
}

type ModelUsageAggregate = {
  readonly modelIdentifier: string
  requestCount: number
  pricedRequestCount: number
  tokens: Tokens
  retailCostUsd: number
  quotaEquivalentCostUsd: number
  readonly pricingApplyFrom: Set<string>
}

type DailyAggregate = {
  quotaObservationCount: number
  readonly quotaWindows: Map<string, QuotaWindowAggregate>
  requestCount: number
  pricedRequestCount: number
  tokens: Tokens
  retailCostUsd: number
  quotaEquivalentCostUsd: number
  readonly models: Map<string, ModelUsageAggregate>
  readonly unpricedModelIdentifiers: Set<string>
}

type JsonObject = object

const requiredObject = (value: unknown, source: string): object => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${source} must be an object`)
  }
  return value
}

const property = (value: JsonObject, key: string): unknown =>
  Object.getOwnPropertyDescriptor(value, key)?.value

const requiredString = (value: JsonObject, key: string, source: string): string => {
  const candidate = property(value, key)
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error(`${source}.${key} must be a non-empty string`)
  }
  return candidate
}

const requiredNumber = (value: JsonObject, key: string, source: string): number => {
  const candidate = property(value, key)
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
    throw new Error(`${source}.${key} must be a non-negative finite number`)
  }
  return candidate
}

const toIsoTimestamp = (value: unknown, source: string): string => {
  if (typeof value !== "string") throw new Error(`${source} must be an ISO timestamp string`)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${source} must be an ISO timestamp string`)
  return new Date(timestamp).toISOString()
}

const toUtcDate = (timestamp: string): string => timestamp.slice(0, 10)

// Providers can return the same reset boundary with request-specific milliseconds.
const normalizeResetAt = (timestamp: string): string => `${timestamp.slice(0, 16)}:00.000Z`

const zeroTokens = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })

const addTokens = (target: Tokens, source: Tokens): void => {
  target.input += source.input
  target.output += source.output
  target.cacheRead += source.cacheRead
  target.cacheWrite += source.cacheWrite
}

const roundUsd = (value: number): number => Math.round(value * 1_000_000_000_000) / 1_000_000_000_000

const isMissingDirectory = (error: unknown): boolean =>
  error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT"

const readJson = async (filePath: string): Promise<unknown> => JSON.parse(await readFile(filePath, "utf-8"))

const parsePriceRates = (value: JsonObject, source: string): PriceRates => ({
  inputPerMillionUsd: requiredNumber(value, "inputPerMillionUsd", source),
  outputPerMillionUsd: requiredNumber(value, "outputPerMillionUsd", source),
  cacheReadPerMillionUsd: requiredNumber(value, "cacheReadPerMillionUsd", source),
  cacheWritePerMillionUsd: requiredNumber(value, "cacheWritePerMillionUsd", source),
})

const parseOptionalQuotaRates = (value: JsonObject, source: string): QuotaRates | null => {
  const candidate = property(value, "quotaRates")
  return candidate === undefined || candidate === null ? null : parsePriceRates(requiredObject(candidate, `${source}.quotaRates`), `${source}.quotaRates`)
}

const parseUtcTime = (value: unknown, source: string): number => {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${source} must use HH:MM`)
  }
  const [hoursText, minutesText] = value.split(":")
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    throw new Error(`${source} must use HH:MM`)
  }
  return hours * 60 + minutes
}

const parsePriceCondition = (value: unknown, source: string): PriceCondition => {
  const condition = requiredObject(value, source)
  if (property(condition, "kind") !== "utc-weekly-time-window") {
    throw new Error(`${source}.kind must be utc-weekly-time-window`)
  }
  const weekdaysValue = property(condition, "weekdays")
  if (!Array.isArray(weekdaysValue) || weekdaysValue.length === 0) {
    throw new Error(`${source}.weekdays must be a non-empty array`)
  }
  const weekdays = weekdaysValue.map((day, index) => {
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error(`${source}.weekdays[${index}] must be an integer from 0 to 6`)
    }
    return day
  })
  if (new Set(weekdays).size !== weekdays.length) throw new Error(`${source}.weekdays must not repeat a day`)
  return {
    weekdays,
    startUtcMinute: parseUtcTime(property(condition, "startUtc"), `${source}.startUtc`),
    endUtcMinute: parseUtcTime(property(condition, "endUtc"), `${source}.endUtc`),
    quotaMultiplier: property(condition, "quotaMultiplier") === undefined ? 1 : requiredNumber(condition, "quotaMultiplier", source),
    quotaRates: parseOptionalQuotaRates(condition, source),
    ...parsePriceRates(condition, source),
  }
}

const parsePricing = (value: unknown, source: string): Pricing => {
  const pricing = requiredObject(value, source)
  if (property(pricing, "schemaVersion") !== 1) throw new Error(`${source}.schemaVersion must be 1`)
  if (property(pricing, "currency") !== "USD") throw new Error(`${source}.currency must be USD`)

  const prices = property(pricing, "prices")
  if (!Array.isArray(prices)) throw new Error(`${source}.prices must be an array`)

  const revisions = prices.map((entry, index): PriceRevision => {
    const entrySource = `${source}.prices[${index}]`
    const price = requiredObject(entry, entrySource)
    const applyFrom = requiredString(price, "applyFrom", entrySource)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyFrom) || Number.isNaN(Date.parse(`${applyFrom}T00:00:00.000Z`))) {
      throw new Error(`${entrySource}.applyFrom must use YYYY-MM-DD`)
    }
    const tiersValue = property(price, "tiers")
    const tiers = tiersValue === undefined
      ? []
      : !Array.isArray(tiersValue)
        ? (() => { throw new Error(`${entrySource}.tiers must be an array`) })()
        : tiersValue.map((tier, tierIndex): PriceTier => {
          const tierSource = `${entrySource}.tiers[${tierIndex}]`
          const tierPrice = requiredObject(tier, tierSource)
          return {
            inputTokensAbove: requiredNumber(tierPrice, "inputTokensAbove", tierSource),
            ...parsePriceRates(tierPrice, tierSource),
          }
        })
    const conditionsValue = property(price, "conditions")
    const conditions = conditionsValue === undefined
      ? []
      : !Array.isArray(conditionsValue)
        ? (() => { throw new Error(`${entrySource}.conditions must be an array`) })()
        : conditionsValue.map((condition, conditionIndex) =>
          parsePriceCondition(condition, `${entrySource}.conditions[${conditionIndex}]`),
        )
    const sortedTiers = [...tiers].sort((left, right) => left.inputTokensAbove - right.inputTokensAbove)
    if (sortedTiers.some((tier, index) => index > 0 && tier.inputTokensAbove === sortedTiers[index - 1]?.inputTokensAbove)) {
      throw new Error(`${entrySource}.tiers must not repeat inputTokensAbove`)
    }
    return {
      modelIdentifier: requiredString(price, "modelIdentifier", entrySource),
      applyFrom,
      ...parsePriceRates(price, entrySource),
      quotaMultiplier: property(price, "quotaMultiplier") === undefined ? 1 : requiredNumber(price, "quotaMultiplier", entrySource),
      quotaRates: parseOptionalQuotaRates(price, entrySource),
      tiers: sortedTiers,
      conditions,
    }
  })

  const revisionKeys = new Set<string>()
  for (const revision of revisions) {
    const key = `${revision.modelIdentifier}\u0000${revision.applyFrom}`
    if (revisionKeys.has(key)) throw new Error(`${source} has duplicate price revision: ${revision.modelIdentifier} on ${revision.applyFrom}`)
    revisionKeys.add(key)
  }
  return { prices: revisions }
}

const parseTokens = (value: unknown, source: string): Tokens => {
  const tokens = requiredObject(value, source)
  return {
    input: requiredNumber(tokens, "input", source),
    output: requiredNumber(tokens, "output", source),
    cacheRead: requiredNumber(tokens, "cacheRead", source),
    cacheWrite: requiredNumber(tokens, "cacheWrite", source),
  }
}

const parseUsageEvent = (value: unknown, source: string): UsageEvent | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  if (property(value, "type") !== "message") return null
  const rawMessage = property(value, "message")
  if (typeof rawMessage !== "object" || rawMessage === null || Array.isArray(rawMessage)) return null
  if (property(rawMessage, "role") !== "assistant") return null
  const message = rawMessage

  const entryId = requiredString(value, "id", source)
  const provider = requiredString(message, "provider", source)
  const model = requiredString(message, "model", source)
  const messageTimestamp = property(message, "timestamp")
  const entryTimestamp = property(value, "timestamp")
  const occurredAt =
    typeof messageTimestamp === "number" && Number.isFinite(messageTimestamp)
      ? new Date(messageTimestamp).toISOString()
      : toIsoTimestamp(entryTimestamp, `${source}.timestamp`)
  const tokens = parseTokens(property(message, "usage"), `${source}.message.usage`)
  if (tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite === 0) return null
  const dedupeSource = [entryId, occurredAt, provider, model, tokens.input, tokens.output, tokens.cacheRead, tokens.cacheWrite].join("\u0000")

  return {
    dedupeKey: createHash("sha256").update(dedupeSource).digest("hex"),
    occurredAt,
    modelIdentifier: `${provider}/${model}`,
    tokens,
  }
}

const parseQuotaObservation = (value: unknown, source: string): QuotaObservation => {
  const observation = requiredObject(value, source)
  if (property(observation, "schemaVersion") !== 1 || property(observation, "kind") !== "quota_observation") {
    throw new Error(`${source} must be a quota_observation schema version 1`)
  }
  const observedAt = toIsoTimestamp(property(observation, "observedAt"), `${source}.observedAt`)
  const provider = requiredString(observation, "provider", source)
  const accountAlias = requiredString(observation, "accountAlias", source)
  const windows = property(observation, "windows")
  if (!Array.isArray(windows) || windows.length === 0) throw new Error(`${source}.windows must be a non-empty array`)

  return {
    observedAt,
    windows: windows.map((window, index): QuotaWindow => {
      const windowSource = `${source}.windows[${index}]`
      const quotaWindow = requiredObject(window, windowSource)
      const resetAtValue = property(quotaWindow, "resetAt")
      if (resetAtValue !== null && typeof resetAtValue !== "string") {
        throw new Error(`${windowSource}.resetAt must be an ISO timestamp or null`)
      }
      return {
        provider,
        accountAlias,
        kind: requiredString(quotaWindow, "kind", windowSource),
        resetAt: resetAtValue === null ? null : normalizeResetAt(toIsoTimestamp(resetAtValue, `${windowSource}.resetAt`)),
        usedPercent: requiredNumber(quotaWindow, "usedPercent", windowSource),
        observedAt,
      }
    }),
  }
}

const loadPricing = async (filePath: string): Promise<Pricing> => {
  try {
    return parsePricing(await readJson(filePath), filePath)
  } catch (error) {
    if (isMissingDirectory(error)) return { prices: [] }
    throw error
  }
}

const readExistingDays = async (
  outputPath: string,
  machineId: string,
  month: string,
): Promise<Map<string, object>> => {
  try {
    const aggregate = requiredObject(await readJson(outputPath), outputPath)
    if (property(aggregate, "schemaVersion") !== 1) throw new Error(`${outputPath}.schemaVersion must be 1`)
    if (property(aggregate, "machineId") !== machineId) throw new Error(`${outputPath}.machineId does not match ${machineId}`)
    if (property(aggregate, "month") !== month) throw new Error(`${outputPath}.month does not match ${month}`)
    const days = requiredObject(property(aggregate, "days"), `${outputPath}.days`)
    const preserved = new Map<string, object>()
    for (const date of Object.getOwnPropertyNames(days)) {
      const day = property(days, date)
      if (typeof day !== "object" || day === null || Array.isArray(day)) {
        throw new Error(`${outputPath}.days.${date} must be an object`)
      }
      preserved.set(date, day)
    }
    return preserved
  } catch (error) {
    if (isMissingDirectory(error)) return new Map()
    throw error
  }
}

const listFiles = async (root: string, extension: string): Promise<readonly string[]> => {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const nested = await Promise.all(
      entries.map(async (entry): Promise<readonly string[]> => {
        const entryPath = path.join(root, entry.name)
        if (entry.isDirectory()) return listFiles(entryPath, extension)
        return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : []
      }),
    )
    return nested.flat().sort()
  } catch (error) {
    if (isMissingDirectory(error)) return []
    throw error
  }
}

const readJsonl = async (filePath: string): Promise<readonly unknown[]> => {
  const lines = (await readFile(filePath, "utf-8")).split("\n")
  const entries: unknown[] = []
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // Pi may be appending a final JSONL record while the aggregator runs.
      if (index === lines.length - 1) continue
      throw new Error(`${filePath}:${index + 1} is not valid JSON`)
    }
  }
  return entries
}

const matchesCondition = (condition: PriceCondition, occurredAt: string): boolean => {
  const date = new Date(occurredAt)
  const weekday = date.getUTCDay()
  if (!condition.weekdays.includes(weekday)) return false
  const minute = date.getUTCHours() * 60 + date.getUTCMinutes()
  return condition.startUtcMinute < condition.endUtcMinute
    ? minute >= condition.startUtcMinute && minute < condition.endUtcMinute
    : minute >= condition.startUtcMinute || minute < condition.endUtcMinute
}

const selectPrice = (
  pricing: Pricing,
  modelIdentifier: string,
  occurredAt: string,
  tokens: Tokens,
): EffectivePrice | null => {
  const date = toUtcDate(occurredAt)
  const revision = pricing.prices
    .filter((candidate) => candidate.modelIdentifier === modelIdentifier && candidate.applyFrom <= date)
    .sort((left, right) => left.applyFrom.localeCompare(right.applyFrom))
    .at(-1)
  if (revision === undefined) return null
  const cacheableInputTokens = tokens.input + tokens.cacheRead + tokens.cacheWrite
  const tier = revision.tiers.filter((candidate) => cacheableInputTokens > candidate.inputTokensAbove).at(-1)
  const tieredRates = tier === undefined ? revision : { ...revision, ...tier }
  const condition = revision.conditions.find((candidate) => matchesCondition(candidate, occurredAt))
  return {
    applyFrom: revision.applyFrom,
    quotaMultiplier: condition?.quotaMultiplier ?? revision.quotaMultiplier,
    quotaRates: condition?.quotaRates ?? revision.quotaRates,
    inputPerMillionUsd: condition?.inputPerMillionUsd ?? tieredRates.inputPerMillionUsd,
    outputPerMillionUsd: condition?.outputPerMillionUsd ?? tieredRates.outputPerMillionUsd,
    cacheReadPerMillionUsd: condition?.cacheReadPerMillionUsd ?? tieredRates.cacheReadPerMillionUsd,
    cacheWritePerMillionUsd: condition?.cacheWritePerMillionUsd ?? tieredRates.cacheWritePerMillionUsd,
  }
}

const retailCost = (tokens: Tokens, price: PriceRates): number =>
  roundUsd(
    (tokens.input * price.inputPerMillionUsd +
      tokens.output * price.outputPerMillionUsd +
      tokens.cacheRead * price.cacheReadPerMillionUsd +
      tokens.cacheWrite * price.cacheWritePerMillionUsd) /
      1_000_000,
  )

const createDailyAggregate = (): DailyAggregate => ({
  quotaObservationCount: 0,
  quotaWindows: new Map(),
  requestCount: 0,
  pricedRequestCount: 0,
  tokens: zeroTokens(),
  retailCostUsd: 0,
  quotaEquivalentCostUsd: 0,
  models: new Map(),
  unpricedModelIdentifiers: new Set(),
})

const aggregateQuota = (daily: DailyAggregate, observation: QuotaObservation): void => {
  daily.quotaObservationCount += 1
  for (const window of observation.windows) {
    const key = quotaWindowKey(window)
    const current = daily.quotaWindows.get(key)
    if (current === undefined) {
      daily.quotaWindows.set(key, {
        provider: window.provider,
        accountAlias: window.accountAlias,
        kind: window.kind,
        resetAt: window.resetAt,
        firstUsedPercent: window.usedPercent,
        lastUsedPercent: window.usedPercent,
        minUsedPercent: window.usedPercent,
        maxUsedPercent: window.usedPercent,
        firstObservedAt: window.observedAt,
        lastObservedAt: window.observedAt,
      })
      continue
    }
    if (window.observedAt < current.firstObservedAt) {
      current.firstObservedAt = window.observedAt
      current.firstUsedPercent = window.usedPercent
    }
    if (window.observedAt >= current.lastObservedAt) {
      current.lastObservedAt = window.observedAt
      current.lastUsedPercent = window.usedPercent
      current.resetAt = window.resetAt
    }
    current.minUsedPercent = Math.min(current.minUsedPercent, window.usedPercent)
    current.maxUsedPercent = Math.max(current.maxUsedPercent, window.usedPercent)
  }
}

const quotaCost = (tokens: Tokens, price: EffectivePrice): number => retailCost(tokens, price.quotaRates ?? price) * price.quotaMultiplier

const aggregateUsage = (daily: DailyAggregate, event: UsageEvent, price: EffectivePrice | null): void => {
  daily.requestCount += 1
  addTokens(daily.tokens, event.tokens)

  const model = daily.models.get(event.modelIdentifier) ?? {
    modelIdentifier: event.modelIdentifier,
    requestCount: 0,
    pricedRequestCount: 0,
    tokens: zeroTokens(),
    retailCostUsd: 0,
    quotaEquivalentCostUsd: 0,
    pricingApplyFrom: new Set<string>(),
  }
  model.requestCount += 1
  addTokens(model.tokens, event.tokens)

  if (price === null) {
    daily.unpricedModelIdentifiers.add(event.modelIdentifier)
  } else {
    const cost = retailCost(event.tokens, price)
    const quotaEquivalent = roundUsd(quotaCost(event.tokens, price))
    daily.pricedRequestCount += 1
    daily.retailCostUsd = roundUsd(daily.retailCostUsd + cost)
    daily.quotaEquivalentCostUsd = roundUsd(daily.quotaEquivalentCostUsd + quotaEquivalent)
    model.pricedRequestCount += 1
    model.retailCostUsd = roundUsd(model.retailCostUsd + cost)
    model.quotaEquivalentCostUsd = roundUsd(model.quotaEquivalentCostUsd + quotaEquivalent)
    model.pricingApplyFrom.add(price.applyFrom)
  }
  daily.models.set(event.modelIdentifier, model)
}

const createIntervalUsageAggregate = (): IntervalUsageAggregate => ({
  requestCount: 0,
  pricedRequestCount: 0,
  tokens: zeroTokens(),
  retailCostUsd: 0,
  quotaEquivalentCostUsd: 0,
  unpricedModelIdentifiers: new Set(),
})

const aggregateIntervalUsage = (target: IntervalUsageAggregate, usage: PricedUsageEvent): void => {
  target.requestCount += 1
  addTokens(target.tokens, usage.event.tokens)
  if (usage.price === null) {
    target.unpricedModelIdentifiers.add(usage.event.modelIdentifier)
    return
  }
  const cost = retailCost(usage.event.tokens, usage.price)
  target.pricedRequestCount += 1
  target.retailCostUsd = roundUsd(target.retailCostUsd + cost)
  target.quotaEquivalentCostUsd = roundUsd(target.quotaEquivalentCostUsd + quotaCost(usage.event.tokens, usage.price))
}

const toIntervalUsageOutput = (usage: IntervalUsageAggregate): object => ({
  requestCount: usage.requestCount,
  pricedRequestCount: usage.pricedRequestCount,
  tokens: usage.tokens,
  pricedRetailCostUsd: usage.retailCostUsd,
  pricedQuotaEquivalentCostUsd: usage.quotaEquivalentCostUsd,
  retailCostUsd: usage.pricedRequestCount === usage.requestCount ? usage.retailCostUsd : null,
  quotaEquivalentCostUsd: usage.pricedRequestCount === usage.requestCount ? usage.quotaEquivalentCostUsd : null,
  unpricedModelIdentifiers: [...usage.unpricedModelIdentifiers].sort(),
})

const providerOf = (modelIdentifier: string): string => modelIdentifier.split("/", 1)[0] ?? ""

const quotaWindowKey = (window: Pick<QuotaWindow, "provider" | "accountAlias" | "kind">): string =>
  [window.provider, window.accountAlias, window.kind].join("\u0000")

const monthlyCycleStart = (resetAt: string | null, kind: string): string | null => {
  if (resetAt === null || kind !== "monthly") return null
  const start = new Date(resetAt)
  start.setUTCMonth(start.getUTCMonth() - 1)
  return start.toISOString()
}

const createQuotaInterval = (first: QuotaWindow, last: QuotaWindow, usageEvents: readonly PricedUsageEvent[]): object => {
  const usage = createIntervalUsageAggregate()
  const inferredFullCycle = first.usedPercent === 100 && last.usedPercent === 100
  const startAt = inferredFullCycle ? monthlyCycleStart(last.resetAt, first.kind) ?? first.observedAt : first.observedAt
  for (const event of usageEvents) {
    if (providerOf(event.event.modelIdentifier) !== first.provider) continue
    if (event.event.occurredAt < startAt || event.event.occurredAt > last.observedAt) continue
    aggregateIntervalUsage(usage, event)
  }
  const usedPercentDelta = roundUsd(Math.max(0, last.usedPercent - first.usedPercent))
  const fullyPriced = usage.pricedRequestCount === usage.requestCount
  return {
    estimationMethod: inferredFullCycle ? "at-limit-observed-usage" : "usage-percentage-delta",
    usageStartAt: startAt,
    usageEndAt: last.observedAt,
    firstObservedAt: first.observedAt,
    lastObservedAt: last.observedAt,
    firstUsedPercent: first.usedPercent,
    lastUsedPercent: last.usedPercent,
    usedPercentDelta,
    usage: toIntervalUsageOutput(usage),
    estimatedQuotaBudgetUsd: fullyPriced && usedPercentDelta > 0
      ? roundUsd(usage.quotaEquivalentCostUsd / (usedPercentDelta / 100))
      : fullyPriced && inferredFullCycle && usage.requestCount > 0
        ? usage.quotaEquivalentCostUsd
        : null,
  }
}

const createQuotaEstimateOutput = (observedWindows: readonly QuotaWindow[], usageEvents: readonly PricedUsageEvent[]): object => {
  const windowsByKey = new Map<string, QuotaWindow[]>()
  for (const window of observedWindows) {
    const key = quotaWindowKey(window)
    const values = windowsByKey.get(key) ?? []
    values.push(window)
    windowsByKey.set(key, values)
  }
  const estimates = [...windowsByKey.values()].flatMap((windows) => {
    const ordered = [...windows].sort((left, right) => left.observedAt.localeCompare(right.observedAt))
    const segments = ordered.reduce<QuotaWindow[][]>((result, window) => {
      const current = result.at(-1)
      const previous = current?.at(-1)
      if (current === undefined || previous === undefined || window.usedPercent >= previous.usedPercent) return [...result.slice(0, -1), [...(current ?? []), window]]
      return [...result, [window]]
    }, [])
    return segments.flatMap((segment) => {
      const first = segment.reduce((lowest, window) => window.usedPercent < lowest.usedPercent ? window : lowest)
      const last = segment.reduce((highest, window) => window.usedPercent >= highest.usedPercent ? window : highest)
      if (last.observedAt < first.observedAt || (last.usedPercent <= first.usedPercent && !(first.usedPercent === 100 && last.usedPercent === 100))) return []
      return [{
        provider: first.provider,
        accountAlias: first.accountAlias,
        kind: first.kind,
        resetAt: last.resetAt,
        ...createQuotaInterval(first, last, usageEvents),
        intervals: [],
      }]
    })
  })
  return { estimates: estimates.sort((left, right) =>
    [left.provider, left.accountAlias, left.kind, left.resetAt ?? ""].join("\u0000").localeCompare(
      [right.provider, right.accountAlias, right.kind, right.resetAt ?? ""].join("\u0000"),
    ),
  ) }
}

const toOutputDay = (daily: DailyAggregate): object => ({
  quota: {
    observationCount: daily.quotaObservationCount,
    windows: [...daily.quotaWindows.values()]
      .sort((left, right) =>
        [left.provider, left.accountAlias, left.kind, left.resetAt ?? ""].join("\u0000").localeCompare(
          [right.provider, right.accountAlias, right.kind, right.resetAt ?? ""].join("\u0000"),
        ),
      )
      .map((window) => window),
  },
  usage: {
    requestCount: daily.requestCount,
    pricedRequestCount: daily.pricedRequestCount,
    tokens: daily.tokens,
    pricedRetailCostUsd: daily.retailCostUsd,
    pricedQuotaEquivalentCostUsd: daily.quotaEquivalentCostUsd,
    retailCostUsd: daily.pricedRequestCount === daily.requestCount ? daily.retailCostUsd : null,
    quotaEquivalentCostUsd: daily.pricedRequestCount === daily.requestCount ? daily.quotaEquivalentCostUsd : null,
    models: [...daily.models.values()]
      .sort((left, right) => left.modelIdentifier.localeCompare(right.modelIdentifier))
      .map((model) => ({
        modelIdentifier: model.modelIdentifier,
        requestCount: model.requestCount,
        pricedRequestCount: model.pricedRequestCount,
        tokens: model.tokens,
        pricedRetailCostUsd: model.retailCostUsd,
        pricedQuotaEquivalentCostUsd: model.quotaEquivalentCostUsd,
        retailCostUsd: model.pricedRequestCount === model.requestCount ? model.retailCostUsd : null,
        quotaEquivalentCostUsd: model.pricedRequestCount === model.requestCount ? model.quotaEquivalentCostUsd : null,
        pricingApplyFrom: [...model.pricingApplyFrom].sort(),
      })),
    unpricedModelIdentifiers: [...daily.unpricedModelIdentifiers].sort(),
  },
})

export const aggregateLlmUsage = async (options: AggregateLlmUsageOptions): Promise<readonly string[]> => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.machineId)) {
    throw new Error("machineId must contain only letters, numbers, hyphens, and underscores")
  }

  const pricingPath = path.join(options.usageRoot, "master", "pricing.json")
  const pricing = await loadPricing(pricingPath)
  const observedQuotaWindows: QuotaWindow[] = []
  const pricedUsageEvents: PricedUsageEvent[] = []
  const dailyByDate = new Map<string, DailyAggregate>()
  const daily = (date: string): DailyAggregate => {
    const current = dailyByDate.get(date)
    if (current !== undefined) return current
    const created = createDailyAggregate()
    dailyByDate.set(date, created)
    return created
  }

  const quotaFiles = await listFiles(path.join(options.usageRoot, "state", "quota"), ".jsonl")
  for (const quotaFile of quotaFiles) {
    const entries = await readJsonl(quotaFile)
    for (const [index, entry] of entries.entries()) {
      const observation = parseQuotaObservation(entry, `${quotaFile}:${index + 1}`)
      observedQuotaWindows.push(...observation.windows)
      aggregateQuota(daily(toUtcDate(observation.observedAt)), observation)
    }
  }

  const sessionFiles = await listFiles(options.sessionsRoot, ".jsonl")
  const seenUsage = new Set<string>()
  for (const sessionFile of sessionFiles) {
    const entries = await readJsonl(sessionFile)
    for (const [index, entry] of entries.entries()) {
      const event = parseUsageEvent(entry, `${sessionFile}:${index + 1}`)
      if (event === null || seenUsage.has(event.dedupeKey)) continue
      seenUsage.add(event.dedupeKey)
      const date = toUtcDate(event.occurredAt)
      const price = selectPrice(pricing, event.modelIdentifier, event.occurredAt, event.tokens)
      pricedUsageEvents.push({ event, price })
      aggregateUsage(daily(date), event, price)
    }
  }

  const months = new Map<string, Map<string, object>>()
  for (const [date, aggregate] of dailyByDate.entries()) {
    const month = date.slice(0, 7)
    const days = months.get(month) ?? new Map<string, object>()
    days.set(date, toOutputDay(aggregate))
    months.set(month, days)
  }

  const outputPaths: string[] = []
  for (const [month, days] of [...months.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [year, monthNumber] = month.split("-")
    if (year === undefined || monthNumber === undefined) throw new Error(`Invalid generated month: ${month}`)
    const outputPath = path.join(options.usageRoot, "aggregate", options.machineId, year, `${monthNumber}.json`)
    const outputDays = await readExistingDays(outputPath, options.machineId, month)
    for (const [date, aggregate] of days) outputDays.set(date, aggregate)
    const output = {
      schemaVersion: 1,
      machineId: options.machineId,
      month,
      days: Object.fromEntries([...outputDays.entries()].sort(([left], [right]) => left.localeCompare(right))),
    }
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf-8")
    outputPaths.push(outputPath)
  }

  const quotaEstimatesPath = path.join(options.usageRoot, "aggregate", options.machineId, "quota-estimates.json")
  await mkdir(path.dirname(quotaEstimatesPath), { recursive: true })
  await writeFile(quotaEstimatesPath, JSON.stringify({
    schemaVersion: 1,
    machineId: options.machineId,
    ...createQuotaEstimateOutput(observedQuotaWindows, pricedUsageEvents),
  }, null, 2) + "\n", "utf-8")
  outputPaths.push(quotaEstimatesPath)
  return outputPaths
}
