import { createServer } from "node:http"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const LOOPBACK_HOST = "127.0.0.1"

export type DashboardTokens = {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
}

export type DashboardModel = {
  readonly modelIdentifier: string
  readonly requestCount: number
  readonly pricedRequestCount: number
  readonly tokens: DashboardTokens
  readonly pricedRetailCostUsd: number
  readonly pricedQuotaEquivalentCostUsd: number
  readonly retailCostUsd: number | null
  readonly quotaEquivalentCostUsd: number | null
  readonly pricingApplyFrom: readonly string[]
}

export type DashboardQuotaWindow = {
  readonly provider: string
  readonly accountAlias: string
  readonly kind: string
  readonly resetAt: string | null
  readonly firstUsedPercent: number
  readonly lastUsedPercent: number
  readonly minUsedPercent: number
  readonly maxUsedPercent: number
}

export type DashboardDay = {
  readonly machineId: string
  readonly date: string
  readonly quotaObservationCount: number
  readonly quotaWindows: readonly DashboardQuotaWindow[]
  readonly usage: {
    readonly requestCount: number
    readonly pricedRequestCount: number
    readonly tokens: DashboardTokens
    readonly pricedRetailCostUsd: number
    readonly pricedQuotaEquivalentCostUsd: number
    readonly retailCostUsd: number | null
    readonly quotaEquivalentCostUsd: number | null
    readonly models: readonly DashboardModel[]
    readonly unpricedModelIdentifiers: readonly string[]
  }
}

export type DashboardQuotaEstimateInterval = {
  readonly estimationMethod: "at-limit-observed-usage" | "usage-percentage-delta"
  readonly usageStartAt: string
  readonly usageEndAt: string
  readonly firstObservedAt: string
  readonly lastObservedAt: string
  readonly firstUsedPercent: number
  readonly lastUsedPercent: number
  readonly usedPercentDelta: number
  readonly usage: { readonly requestCount: number; readonly pricedRequestCount: number; readonly pricedQuotaEquivalentCostUsd: number; readonly quotaEquivalentCostUsd: number | null }
  readonly estimatedQuotaBudgetUsd: number | null
}

export type DashboardQuotaEstimate = {
  readonly machineId: string
  readonly estimationMethod: "at-limit-observed-usage" | "usage-percentage-delta"
  readonly usageStartAt: string
  readonly usageEndAt: string
  readonly provider: string
  readonly accountAlias: string
  readonly kind: string
  readonly resetAt: string | null
  readonly firstObservedAt: string
  readonly lastObservedAt: string
  readonly firstUsedPercent: number
  readonly lastUsedPercent: number
  readonly usedPercentDelta: number
  readonly usage: {
    readonly requestCount: number
    readonly pricedRequestCount: number
    readonly pricedQuotaEquivalentCostUsd: number
    readonly quotaEquivalentCostUsd: number | null
  }
  readonly estimatedQuotaBudgetUsd: number | null
  readonly intervals: readonly DashboardQuotaEstimateInterval[]
}

type TokenRange = { readonly min: number; readonly max: number }
type TokenRangeLabels = { readonly min: string; readonly max: string }
type TokenCapacityRange = TokenRangeLabels & { readonly minQuotaMultiplier: number; readonly maxQuotaMultiplier: number }

export type DashboardSubscriptionModel = {
  readonly modelIdentifier: string
  readonly availableTokensPerMonth: TokenRange | null
  readonly tokenRangeLabels: TokenRangeLabels | null
  readonly tokenCapacityRange: TokenCapacityRange | null
  readonly tokenBasis: string
  readonly computedTokensPerMonth: TokenRange | null
  readonly computedTokenBasis: string | null
}

export type DashboardSubscription = {
  readonly provider: string
  readonly planName: string
  readonly active: boolean
  readonly applyFrom: string
  readonly monthlyPriceUsd: number | null
  readonly weeklyCredits: number | null
  readonly monthlyQuotaUsd: number | null
  readonly monthlyQuotaBasis: string
  readonly compressionRatio: number | null
  readonly quotaMeasurement: { readonly provider: string; readonly kind: string; readonly monthlyFactor: number } | null
  readonly scaleFrom: string | null
  readonly quotaScale: number | null
  readonly computedMonthlyQuotaUsd: number | null
  readonly computedCompressionRatio: number | null
  readonly computedQuotaBasis: string
  readonly models: readonly DashboardSubscriptionModel[]
}

export type DashboardData = {
  readonly generatedAt: string
  readonly machines: readonly string[]
  readonly months: readonly string[]
  readonly days: readonly DashboardDay[]
  readonly quotaEstimates: readonly DashboardQuotaEstimate[]
  readonly subscriptions: readonly DashboardSubscription[]
}

type JsonObject = object

const requiredObject = (value: unknown, source: string): JsonObject => {
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

const nullableNumber = (value: JsonObject, key: string, source: string): number | null => {
  const candidate = property(value, key)
  if (candidate === null || candidate === undefined) return null
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
    throw new Error(`${source}.${key} must be null or a non-negative finite number`)
  }
  return candidate
}

const nullableString = (value: JsonObject, key: string, source: string): string | null => {
  const candidate = property(value, key)
  if (candidate === null || candidate === undefined) return null
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error(`${source}.${key} must be null or a non-empty string`)
  }
  return candidate
}

const requiredArray = (value: JsonObject, key: string, source: string): readonly unknown[] => {
  const candidate = property(value, key)
  if (!Array.isArray(candidate)) throw new Error(`${source}.${key} must be an array`)
  return candidate
}

const parseTokens = (value: unknown, source: string): DashboardTokens => {
  const tokens = requiredObject(value, source)
  return {
    input: requiredNumber(tokens, "input", source),
    output: requiredNumber(tokens, "output", source),
    cacheRead: requiredNumber(tokens, "cacheRead", source),
    cacheWrite: requiredNumber(tokens, "cacheWrite", source),
  }
}

const parseStringArray = (value: JsonObject, key: string, source: string): readonly string[] =>
  requiredArray(value, key, source).map((entry, index) => {
    if (typeof entry !== "string") throw new Error(`${source}.${key}[${index}] must be a string`)
    return entry
  })

const parseModel = (value: unknown, source: string): DashboardModel => {
  const model = requiredObject(value, source)
  return {
    modelIdentifier: requiredString(model, "modelIdentifier", source),
    requestCount: requiredNumber(model, "requestCount", source),
    pricedRequestCount: requiredNumber(model, "pricedRequestCount", source),
    tokens: parseTokens(property(model, "tokens"), `${source}.tokens`),
    pricedRetailCostUsd: requiredNumber(model, "pricedRetailCostUsd", source),
    pricedQuotaEquivalentCostUsd: requiredNumber(model, "pricedQuotaEquivalentCostUsd", source),
    retailCostUsd: nullableNumber(model, "retailCostUsd", source),
    quotaEquivalentCostUsd: nullableNumber(model, "quotaEquivalentCostUsd", source),
    pricingApplyFrom: parseStringArray(model, "pricingApplyFrom", source),
  }
}

const parseQuotaWindow = (value: unknown, source: string): DashboardQuotaWindow => {
  const window = requiredObject(value, source)
  return {
    provider: requiredString(window, "provider", source),
    accountAlias: requiredString(window, "accountAlias", source),
    kind: requiredString(window, "kind", source),
    resetAt: nullableString(window, "resetAt", source),
    firstUsedPercent: requiredNumber(window, "firstUsedPercent", source),
    lastUsedPercent: requiredNumber(window, "lastUsedPercent", source),
    minUsedPercent: requiredNumber(window, "minUsedPercent", source),
    maxUsedPercent: requiredNumber(window, "maxUsedPercent", source),
  }
}

const parseAggregate = (value: unknown, source: string): readonly DashboardDay[] => {
  const aggregate = requiredObject(value, source)
  if (property(aggregate, "schemaVersion") !== 1) throw new Error(`${source}.schemaVersion must be 1`)
  const machineId = requiredString(aggregate, "machineId", source)
  const days = requiredObject(property(aggregate, "days"), `${source}.days`)
  return Object.entries(days).map(([date, rawDay]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${source}.days has an invalid date: ${date}`)
    const day = requiredObject(rawDay, `${source}.days.${date}`)
    const quota = requiredObject(property(day, "quota"), `${source}.days.${date}.quota`)
    const usage = requiredObject(property(day, "usage"), `${source}.days.${date}.usage`)
    return {
      machineId,
      date,
      quotaObservationCount: requiredNumber(quota, "observationCount", `${source}.days.${date}.quota`),
      quotaWindows: requiredArray(quota, "windows", `${source}.days.${date}.quota`).map((window, index) =>
        parseQuotaWindow(window, `${source}.days.${date}.quota.windows[${index}]`),
      ),
      usage: {
        requestCount: requiredNumber(usage, "requestCount", `${source}.days.${date}.usage`),
        pricedRequestCount: requiredNumber(usage, "pricedRequestCount", `${source}.days.${date}.usage`),
        tokens: parseTokens(property(usage, "tokens"), `${source}.days.${date}.usage.tokens`),
        pricedRetailCostUsd: requiredNumber(usage, "pricedRetailCostUsd", `${source}.days.${date}.usage`),
        pricedQuotaEquivalentCostUsd: requiredNumber(usage, "pricedQuotaEquivalentCostUsd", `${source}.days.${date}.usage`),
        retailCostUsd: nullableNumber(usage, "retailCostUsd", `${source}.days.${date}.usage`),
        quotaEquivalentCostUsd: nullableNumber(usage, "quotaEquivalentCostUsd", `${source}.days.${date}.usage`),
        models: requiredArray(usage, "models", `${source}.days.${date}.usage`).map((model, index) =>
          parseModel(model, `${source}.days.${date}.usage.models[${index}]`),
        ),
        unpricedModelIdentifiers: parseStringArray(usage, "unpricedModelIdentifiers", `${source}.days.${date}.usage`),
      },
    }
  })
}

const parseEstimationMethod = (value: JsonObject, source: string): "at-limit-observed-usage" | "usage-percentage-delta" => {
  const method = property(value, "estimationMethod")
  if (method === "at-limit-observed-usage" || method === "usage-percentage-delta") return method
  throw new Error(`${source}.estimationMethod is invalid`)
}

const parseQuotaEstimateInterval = (value: unknown, source: string): DashboardQuotaEstimateInterval => {
  const interval = requiredObject(value, source)
  const usage = requiredObject(property(interval, "usage"), `${source}.usage`)
  return {
    estimationMethod: parseEstimationMethod(interval, source),
    usageStartAt: requiredString(interval, "usageStartAt", source),
    usageEndAt: requiredString(interval, "usageEndAt", source),
    firstObservedAt: requiredString(interval, "firstObservedAt", source), lastObservedAt: requiredString(interval, "lastObservedAt", source),
    firstUsedPercent: requiredNumber(interval, "firstUsedPercent", source), lastUsedPercent: requiredNumber(interval, "lastUsedPercent", source), usedPercentDelta: requiredNumber(interval, "usedPercentDelta", source),
    usage: { requestCount: requiredNumber(usage, "requestCount", `${source}.usage`), pricedRequestCount: requiredNumber(usage, "pricedRequestCount", `${source}.usage`), pricedQuotaEquivalentCostUsd: requiredNumber(usage, "pricedQuotaEquivalentCostUsd", `${source}.usage`), quotaEquivalentCostUsd: nullableNumber(usage, "quotaEquivalentCostUsd", `${source}.usage`) },
    estimatedQuotaBudgetUsd: nullableNumber(interval, "estimatedQuotaBudgetUsd", source),
  }
}

const parseSubscriptionModel = (value: unknown, source: string): DashboardSubscriptionModel => {
  const model = requiredObject(value, source)
  const rangeValue = property(model, "availableTokensPerMonth")
  let availableTokensPerMonth: DashboardSubscriptionModel["availableTokensPerMonth"] = null
  if (rangeValue !== null && rangeValue !== undefined) {
    const range = requiredObject(rangeValue, `${source}.availableTokensPerMonth`)
    availableTokensPerMonth = {
      min: requiredNumber(range, "min", `${source}.availableTokensPerMonth`),
      max: requiredNumber(range, "max", `${source}.availableTokensPerMonth`),
    }
  }
  const labelsValue = property(model, "tokenRangeLabels")
  let tokenRangeLabels: TokenRangeLabels | null = null
  if (labelsValue !== null && labelsValue !== undefined) {
    const labels = requiredObject(labelsValue, `${source}.tokenRangeLabels`)
    tokenRangeLabels = {
      min: requiredString(labels, "min", `${source}.tokenRangeLabels`),
      max: requiredString(labels, "max", `${source}.tokenRangeLabels`),
    }
  }
  const capacityValue = property(model, "tokenCapacityRange")
  let tokenCapacityRange: TokenCapacityRange | null = null
  if (capacityValue !== null && capacityValue !== undefined) {
    const capacity = requiredObject(capacityValue, `${source}.tokenCapacityRange`)
    tokenCapacityRange = {
      min: requiredString(capacity, "min", `${source}.tokenCapacityRange`),
      max: requiredString(capacity, "max", `${source}.tokenCapacityRange`),
      minQuotaMultiplier: requiredNumber(capacity, "minQuotaMultiplier", `${source}.tokenCapacityRange`),
      maxQuotaMultiplier: requiredNumber(capacity, "maxQuotaMultiplier", `${source}.tokenCapacityRange`),
    }
  }
  return {
    modelIdentifier: requiredString(model, "modelIdentifier", source),
    availableTokensPerMonth,
    tokenRangeLabels,
    tokenCapacityRange,
    tokenBasis: requiredString(model, "tokenBasis", source),
    computedTokensPerMonth: null,
    computedTokenBasis: null,
  }
}

const parseSubscriptions = (value: unknown, source: string): readonly DashboardSubscription[] => {
  const root = requiredObject(value, source)
  if (property(root, "schemaVersion") !== 2) throw new Error(`${source}.schemaVersion must be 2`)
  return requiredArray(root, "subscriptions", source).map((raw, index) => {
    const itemSource = `${source}.subscriptions[${index}]`
    const item = requiredObject(raw, itemSource)
    const measurementValue = property(item, "quotaMeasurement")
    const measurement = measurementValue === null || measurementValue === undefined ? null : (() => {
      const value = requiredObject(measurementValue, `${itemSource}.quotaMeasurement`)
      return {
        provider: requiredString(value, "provider", `${itemSource}.quotaMeasurement`),
        kind: requiredString(value, "kind", `${itemSource}.quotaMeasurement`),
        monthlyFactor: requiredNumber(value, "monthlyFactor", `${itemSource}.quotaMeasurement`),
      }
    })()
    return {
      provider: requiredString(item, "provider", itemSource),
      planName: requiredString(item, "planName", itemSource),
      active: property(item, "active") === true,
      applyFrom: requiredString(item, "applyFrom", itemSource),
      monthlyPriceUsd: nullableNumber(item, "monthlyPriceUsd", itemSource),
      weeklyCredits: nullableNumber(item, "weeklyCredits", itemSource),
      monthlyQuotaUsd: nullableNumber(item, "monthlyQuotaUsd", itemSource),
      monthlyQuotaBasis: requiredString(item, "monthlyQuotaBasis", itemSource),
      compressionRatio: nullableNumber(item, "compressionRatio", itemSource),
      quotaMeasurement: measurement,
      scaleFrom: nullableString(item, "scaleFrom", itemSource),
      quotaScale: nullableNumber(item, "quotaScale", itemSource),
      computedMonthlyQuotaUsd: null,
      computedCompressionRatio: null,
      computedQuotaBasis: "未計算",
      models: requiredArray(item, "models", itemSource).map((model, modelIndex) =>
        parseSubscriptionModel(model, `${itemSource}.models[${modelIndex}]`),
      ),
    }
  })
}

const parseQuotaEstimate = (value: unknown, source: string): readonly DashboardQuotaEstimate[] => {
  const output = requiredObject(value, source)
  if (property(output, "schemaVersion") !== 1) throw new Error(`${source}.schemaVersion must be 1`)
  const machineId = requiredString(output, "machineId", source)
  return requiredArray(output, "estimates", source).map((raw, index) => {
    const estimateSource = `${source}.estimates[${index}]`
    const estimate = requiredObject(raw, estimateSource)
    const usage = requiredObject(property(estimate, "usage"), `${estimateSource}.usage`)
    return {
      machineId,
      estimationMethod: parseEstimationMethod(estimate, estimateSource),
      usageStartAt: requiredString(estimate, "usageStartAt", estimateSource),
      usageEndAt: requiredString(estimate, "usageEndAt", estimateSource),
      provider: requiredString(estimate, "provider", estimateSource),
      accountAlias: requiredString(estimate, "accountAlias", estimateSource),
      kind: requiredString(estimate, "kind", estimateSource),
      resetAt: nullableString(estimate, "resetAt", estimateSource),
      firstObservedAt: requiredString(estimate, "firstObservedAt", estimateSource),
      lastObservedAt: requiredString(estimate, "lastObservedAt", estimateSource),
      firstUsedPercent: requiredNumber(estimate, "firstUsedPercent", estimateSource),
      lastUsedPercent: requiredNumber(estimate, "lastUsedPercent", estimateSource),
      usedPercentDelta: requiredNumber(estimate, "usedPercentDelta", estimateSource),
      usage: {
        requestCount: requiredNumber(usage, "requestCount", `${estimateSource}.usage`),
        pricedRequestCount: requiredNumber(usage, "pricedRequestCount", `${estimateSource}.usage`),
        pricedQuotaEquivalentCostUsd: requiredNumber(usage, "pricedQuotaEquivalentCostUsd", `${estimateSource}.usage`),
        quotaEquivalentCostUsd: nullableNumber(usage, "quotaEquivalentCostUsd", `${estimateSource}.usage`),
      },
      estimatedQuotaBudgetUsd: nullableNumber(estimate, "estimatedQuotaBudgetUsd", estimateSource),
      intervals: requiredArray(estimate, "intervals", estimateSource).map((interval, intervalIndex) => parseQuotaEstimateInterval(interval, `${estimateSource}.intervals[${intervalIndex}]`)),
    }
  })
}

const selectMeasurementEstimate = (
  subscription: DashboardSubscription,
  estimates: readonly DashboardQuotaEstimate[],
): DashboardQuotaEstimate | undefined => estimates
  .filter((estimate) => estimate.provider === subscription.quotaMeasurement?.provider && estimate.kind === subscription.quotaMeasurement?.kind && estimate.estimatedQuotaBudgetUsd !== null)
  .sort((left, right) => {
    const priority = (estimate: DashboardQuotaEstimate): number => estimate.usedPercentDelta >= 50 ? 3 : estimate.usedPercentDelta >= 20 ? 2 : estimate.usedPercentDelta > 0 || estimate.estimationMethod === "at-limit-observed-usage" ? 1 : 0
    return priority(right) - priority(left) || right.lastObservedAt.localeCompare(left.lastObservedAt)
  })[0]

const resolveSubscriptionModels = (
  subscriptions: readonly DashboardSubscription[],
  days: readonly DashboardDay[],
): readonly DashboardSubscription[] => subscriptions.map((subscription) => ({
  ...subscription,
  models: subscription.models.map((model) => {
    if (model.availableTokensPerMonth !== null) {
      return { ...model, computedTokensPerMonth: model.availableTokensPerMonth, computedTokenBasis: null }
    }
    const observed = days
      .filter((day) => day.date >= subscription.applyFrom)
      .flatMap((day) => day.usage.models)
      .filter((candidate) => candidate.modelIdentifier === model.modelIdentifier)
      .reduce((totals, candidate) => ({
        tokens: totals.tokens + candidate.tokens.input + candidate.tokens.output + candidate.tokens.cacheRead + candidate.tokens.cacheWrite,
        retailCostUsd: totals.retailCostUsd + candidate.pricedRetailCostUsd,
        quotaCostUsd: totals.quotaCostUsd + candidate.pricedQuotaEquivalentCostUsd,
      }), { tokens: 0, retailCostUsd: 0, quotaCostUsd: 0 })
    if (observed.tokens <= 0 || observed.quotaCostUsd <= 0 || observed.retailCostUsd <= 0 || subscription.computedMonthlyQuotaUsd === null) return model
    const tokenCapacity = model.tokenCapacityRange === null
      ? { min: observed.tokens / observed.quotaCostUsd * subscription.computedMonthlyQuotaUsd, max: observed.tokens / observed.quotaCostUsd * subscription.computedMonthlyQuotaUsd }
      : {
          min: observed.tokens / observed.retailCostUsd * subscription.computedMonthlyQuotaUsd / model.tokenCapacityRange.minQuotaMultiplier,
          max: observed.tokens / observed.retailCostUsd * subscription.computedMonthlyQuotaUsd / model.tokenCapacityRange.maxQuotaMultiplier,
        }
    return {
      ...model,
      computedTokensPerMonth: tokenCapacity,
      computedTokenBasis: "Pi aggregate の実測 input / output / cache read 比率による単独モデル換算",
    }
  }),
}))

const resolveSubscriptionQuotas = (
  subscriptions: readonly DashboardSubscription[],
  estimates: readonly DashboardQuotaEstimate[],
): readonly DashboardSubscription[] => {
  const byName = new Map(subscriptions.map((subscription) => [subscription.planName, subscription]))
  const resolve = (subscription: DashboardSubscription, resolving: ReadonlySet<string>): DashboardSubscription => {
    if (resolving.has(subscription.planName)) throw new Error(`Circular subscription scaleFrom: ${subscription.planName}`)
    const nextResolving = new Set([...resolving, subscription.planName])
    let quota = subscription.monthlyQuotaUsd
    let basis = subscription.monthlyQuotaUsd === null ? "推定不可" : subscription.monthlyQuotaBasis
    if (subscription.quotaMeasurement !== null) {
      const measured = selectMeasurementEstimate(subscription, estimates)
      if (measured?.estimatedQuotaBudgetUsd !== null && measured !== undefined) {
        quota = measured.estimatedQuotaBudgetUsd * subscription.quotaMeasurement.monthlyFactor
        basis = measured.estimationMethod === "at-limit-observed-usage"
          ? `検算: reset 起点から 100% 到達までの usage ${measured.usage.pricedQuotaEquivalentCostUsd.toFixed(2)} USD × ${subscription.quotaMeasurement.monthlyFactor.toFixed(3)}（使用率差分からの逆算ではない）`
          : `実測 ${measured.estimatedQuotaBudgetUsd.toFixed(2)} USD × ${subscription.quotaMeasurement.monthlyFactor.toFixed(3)}（${measured.firstUsedPercent.toFixed(1)}% → ${measured.lastUsedPercent.toFixed(1)}%）`
      }
    } else if (subscription.scaleFrom !== null && subscription.quotaScale !== null) {
      const source = byName.get(subscription.scaleFrom)
      if (source !== undefined) {
        const resolvedSource = resolve(source, nextResolving)
        if (resolvedSource.computedMonthlyQuotaUsd !== null) {
          quota = resolvedSource.computedMonthlyQuotaUsd * subscription.quotaScale
          basis = `${subscription.scaleFrom} の値 × ${subscription.quotaScale}`
        }
      }
    }
    return {
      ...subscription,
      computedMonthlyQuotaUsd: quota,
      computedCompressionRatio: quota !== null && subscription.monthlyPriceUsd !== null ? quota / subscription.monthlyPriceUsd : null,
      computedQuotaBasis: basis,
    }
  }
  return subscriptions.map((subscription) => resolve(subscription, new Set()))
}

const listAggregateFiles = async (aggregateRoot: string): Promise<readonly string[]> => {
  try {
    const machines = await readdir(aggregateRoot, { withFileTypes: true })
    const files = await Promise.all(machines.filter((machine) => machine.isDirectory()).map(async (machine) => {
      const machineRoot = path.join(aggregateRoot, machine.name)
      const years = await readdir(machineRoot, { withFileTypes: true })
      const months = await Promise.all(years.filter((year) => year.isDirectory()).map(async (year) => {
        const yearRoot = path.join(machineRoot, year.name)
        const entries = await readdir(yearRoot, { withFileTypes: true })
        return entries
          .filter((entry) => entry.isFile() && /^\d{2}\.json$/.test(entry.name))
          .map((entry) => path.join(yearRoot, entry.name))
      }))
      return months.flat()
    }))
    return files.flat().sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT") return []
    throw error
  }
}

export const loadDashboardData = async (usageRoot: string): Promise<DashboardData> => {
  const files = await listAggregateFiles(path.join(usageRoot, "aggregate"))
  const subscriptionsPath = path.join(usageRoot, "master", "subscriptions.json")
  let subscriptions: readonly DashboardSubscription[] = []
  try {
    subscriptions = parseSubscriptions(JSON.parse(await readFile(subscriptionsPath, "utf-8")), subscriptionsPath)
  } catch (error) {
    if (!(error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT")) throw error
  }
  const parsed = await Promise.all(files.map(async (file) => parseAggregate(JSON.parse(await readFile(file, "utf-8")), file)))
  const days = parsed.flat().sort((left, right) =>
    [left.date, left.machineId].join("\u0000").localeCompare([right.date, right.machineId].join("\u0000")),
  )
  const machines = [...new Set(days.map((day) => day.machineId))].sort()
  const quotaEstimates = (await Promise.all(machines.map(async (machineId) => {
    const estimatePath = path.join(usageRoot, "aggregate", machineId, "quota-estimates.json")
    try {
      return parseQuotaEstimate(JSON.parse(await readFile(estimatePath, "utf-8")), estimatePath)
    } catch (error) {
      if (error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT") return []
      throw error
    }
  }))).flat()
  return {
    generatedAt: new Date().toISOString(),
    machines,
    months: [...new Set(days.map((day) => day.date.slice(0, 7)))].sort(),
    days,
    quotaEstimates,
    subscriptions: resolveSubscriptionModels(resolveSubscriptionQuotas(subscriptions, quotaEstimates), days),
  }
}

const dashboardHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LLM Usage Ledger</title>
  <style>
    :root { --ink:#19201b; --muted:#626b61; --paper:#f3efe5; --sheet:#fbf9f2; --line:#d8d0bf; --green:#255c47; --mint:#9dd2ba; --orange:#e7653f; --yellow:#e7bd42; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--paper); font-family:"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "BIZ UDPGothic", sans-serif; line-height:1.65; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.16; background-image:radial-gradient(#625d50 .55px,transparent .55px); background-size:5px 5px; }
    main { position:relative; max-width:1280px; margin:0 auto; padding:30px 24px 64px; }
    header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid var(--ink); padding:0 0 12px; gap:18px; }
    h1,h2,p { margin:0; } h1 { font:900 clamp(1.3rem,3vw,2rem)/1 "Hiragino Mincho ProN", "Yu Mincho", serif; letter-spacing:-.04em; }
    h1 span { color:var(--orange); } .kicker { color:var(--green); font-size:.72rem; letter-spacing:.12em; margin-bottom:10px; font-weight:800; }
    .stamp { border:2px solid var(--green); color:var(--green); padding:7px 9px; font-size:.68rem; font-weight:800; transform:rotate(-2deg); white-space:nowrap; }
    .controls { display:flex; flex-wrap:wrap; gap:11px; margin:14px 0; align-items:end; }
    .tabs { display:flex; gap:0; margin:18px 0 0; border-bottom:1px solid var(--line); } .tab { appearance:none; border:0; border-bottom:3px solid transparent; background:transparent; color:var(--muted); padding:10px 15px 8px; font:800 .76rem "Hiragino Sans", sans-serif; cursor:pointer; } .tab[aria-selected="true"] { color:var(--green); border-bottom-color:var(--green); background:#e6f1e9; } .panel[hidden] { display:none; } .subtabs { display:flex; gap:8px; margin:0 0 18px; } .subtab { border:1px solid var(--line); background:transparent; color:var(--muted); padding:7px 12px; font:700 .72rem "Hiragino Sans",sans-serif; cursor:pointer; } .subtab[aria-selected="true"] { border-color:var(--green); color:var(--green); background:#e6f1e9; } .comparison-heading { margin-top:28px; } .comparison-table table { min-width:900px; } .comparison-table td { line-height:1.5; } .comparison-table .basis { color:var(--muted); font-size:.68rem; }
    label { display:grid; gap:5px; font-size:.68rem; font-weight:800; color:var(--muted); letter-spacing:.06em; }
    select { appearance:none; min-width:185px; color:var(--ink); background:var(--sheet); border:1.5px solid var(--ink); border-radius:0; padding:9px 30px 9px 10px; font:inherit; font-size:.78rem; background-image:linear-gradient(45deg,transparent 50%,var(--ink) 50%),linear-gradient(135deg,var(--ink) 50%,transparent 50%); background-position:calc(100% - 14px) 50%,calc(100% - 9px) 50%; background-size:5px 5px,5px 5px; background-repeat:no-repeat; }
    .note { border-left:4px solid var(--yellow); padding:8px 11px; background:#f5e7ac8c; font-size:.72rem; line-height:1.55; margin:0 0 22px; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .metric { min-height:118px; background:var(--sheet); border:1px solid var(--line); padding:13px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:3px 3px 0 #d8d0bf; }
    .metric:nth-child(2) { border-color:var(--green); background:#e6f1e9; } .metric:nth-child(2) .value { color:var(--green); }
    .metric .label { font-size:.64rem; color:var(--muted); font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
    .value { font:800 clamp(1.25rem,2.5vw,2rem)/1 "Hiragino Mincho ProN", "Yu Mincho", serif; letter-spacing:-.04em; }
    section { margin-top:34px; } h2 { font:800 1.12rem/1.3 "Hiragino Mincho ProN", "Yu Mincho", serif; letter-spacing:.03em; display:flex; align-items:center; gap:10px; } h2::after { content:""; height:1px; background:var(--ink); flex:1; opacity:.4; }
    .section-sub { font-size:.7rem; color:var(--muted); margin:8px 0 13px; } .price-band { margin:18px 0 7px; font-size:.82rem; color:var(--green); letter-spacing:.02em; }
    .timeline { display:grid; grid-template-columns:repeat(auto-fit,minmax(82px,1fr)); gap:6px; align-items:end; min-height:146px; }
    .day { min-width:0; background:var(--sheet); padding:8px 7px; border:1px solid var(--line); } .day-top { display:flex; justify-content:space-between; gap:5px; font-size:.61rem; color:var(--muted); } .bar { margin:8px 0 6px; height:68px; display:flex; align-items:end; background:repeating-linear-gradient(to top,transparent 0 16px,#d8d0bf 17px 18px); } .fill { width:100%; min-height:3px; background:var(--orange); } .day .cost { font-size:.75rem; font-weight:800; white-space:nowrap; }
    .table-wrap { overflow:auto; border:1px solid var(--ink); background:var(--sheet); } table { border-collapse:collapse; width:100%; min-width:760px; font-size:.72rem; } th { text-align:left; color:#fff; background:var(--ink); font-size:.62rem; letter-spacing:.06em; text-transform:uppercase; padding:9px; position:sticky; top:0; } td { padding:10px 9px; border-top:1px solid var(--line); vertical-align:top; } tr:hover td { background:#e6f1e9; } .model { font-weight:800; color:var(--green); } .numeric { text-align:right; font-variant-numeric:tabular-nums; } .muted { color:var(--muted); } .warning { color:#a84327; }
    .quota-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:10px; } .quota { padding:13px; border:1px solid var(--line); background:var(--sheet); } .quota header { border:0; padding:0; display:block; } .quota-name { color:var(--green); font-size:.75rem; font-weight:800; } .quota-kind { color:var(--muted); font-size:.67rem; margin-top:5px; } .percent { font:900 2.1rem/1 "Hiragino Mincho ProN", "Yu Mincho", serif; margin:13px 0 7px; } .meter { height:8px; background:#e0dacb; } .meter > i { display:block; height:100%; background:var(--orange); } .quota small { display:block; color:var(--muted); margin-top:8px; font-size:.62rem; } #estimates { grid-template-columns:1fr; } .estimate-lane { padding:16px; border:1px solid var(--ink); background:var(--sheet); } .lane-head { display:flex; justify-content:space-between; gap:16px; padding-bottom:11px; border-bottom:1px solid var(--line); } .lane-title { font-weight:800; color:var(--green); } .lane-summary { color:var(--muted); font-size:.72rem; text-align:right; } .intervals { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:8px; margin-top:12px; } .interval { padding:10px; background:#f3efe5; border-left:3px solid var(--green); } .interval-name { color:var(--muted); font-size:.65rem; font-weight:800; } .interval-value { font:800 1.45rem/1.2 "Hiragino Mincho ProN", "Yu Mincho", serif; margin:5px 0; } .interval-meta { font-size:.65rem; line-height:1.55; color:var(--muted); } .lane-graph { display:flex; align-items:end; gap:8px; height:104px; padding:14px 0 0; border-bottom:1px solid var(--line); } .lane-bar { flex:1; min-width:70px; height:100%; display:flex; flex-direction:column; justify-content:end; align-items:stretch; gap:4px; text-align:center; font-size:.62rem; color:var(--muted); } .lane-bar i { display:block; min-height:3px; background:var(--orange); } .lane-bar b { color:var(--ink); font-size:.68rem; } @media(max-width:700px) { .lane-head{flex-direction:column}.lane-summary{text-align:left} }
    #empty { display:none; padding:42px 0; color:var(--muted); text-align:center; border:1px dashed var(--muted); } footer { margin-top:36px; color:var(--muted); font-size:.65rem; line-height:1.6; border-top:1px solid var(--line); padding-top:12px; }
    @media(max-width:700px) { main{padding:20px 15px 48px} header{align-items:start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.metric{min-height:102px}.controls label{width:100%}select{width:100%}.tab{flex:1;padding-inline:5px;font-size:.68rem} }
  </style>
</head>
<body><main>
  <header><div><p class="kicker">LOCAL / READ ONLY / UTC LEDGER</p><h1>LLM <span>利用状況</span></h1></div><p class="stamp" id="stamp">loading…</p></header>
  <p class="note"><strong>quota 換算額</strong> は、API 定価ではなく subscription quota が減る係数を反映した推定利用額です。推定利用枠は、十分な使用率差分（例: 20% → 40%）がある cycle ではその差分から逆算します。100% 到達後に差分がない場合は検算値として別表示します。複数マシンの同一 session がコピーされている場合、合計は重複する可能性があります。</p>
  <div id="empty">該当する aggregate data がありません。<br><code>node internal/src/cli.ts llm-usage aggregate</code> を実行してください。</div>
  <div class="tabs" role="tablist" aria-label="表示内容"><button class="tab" role="tab" aria-selected="true" aria-controls="usage-panel" id="usage-tab">Usage</button><button class="tab" role="tab" aria-selected="false" aria-controls="estimate-panel" id="estimate-tab">利用枠推定</button><button class="tab" role="tab" aria-selected="false" aria-controls="monthly-panel" id="monthly-tab">マンスリーサマリー</button></div>
  <div id="report"><section class="panel" id="usage-panel" role="tabpanel" aria-labelledby="usage-tab"><h2>現在の利用枠状況</h2><p class="section-sub">provider / account / quota window ごとの最大使用率です。</p><div class="quota-grid" id="quotas"></div></section><section class="panel" id="estimate-panel" role="tabpanel" aria-labelledby="estimate-tab" hidden><div class="subtabs" role="tablist" aria-label="利用枠推定の表示"><button class="subtab" role="tab" aria-selected="true" aria-controls="estimate-view" id="estimate-view-tab">観測から推定</button><button class="subtab" role="tab" aria-selected="false" aria-controls="comparison-view" id="comparison-view-tab">サブスク比較</button></div><div id="estimate-view"><h2>推定利用枠</h2><p class="section-sub">使用率差分（例: 20% → 40%）と、その間の quota 換算利用額から逆算します。差分がない 100% 到達 cycle は検算値として表示します。</p><div class="quota-grid" id="estimates"></div></div><div id="comparison-view" hidden><h2>サブスクリプション比較</h2><p class="section-sub">月次推定利用枠は、直近で十分な差分が取れた quota の実測値を優先します。公開利用枠は provider の公表値です。</p><p class="note">※ 推定値は、aggregate に取り込まれた Pi usage と quota observation の範囲だけです。未取り込みの端末・Pi 外の利用・未収集期間は含まれないため、公開利用枠より小さくなることがあります。</p><div class="table-wrap comparison-table"><table><thead><tr><th>Plan名</th><th class="numeric">月額</th><th class="numeric">月次推定利用枠</th><th class="numeric">公開利用枠</th><th class="numeric">圧縮率</th><th>参考 Quota</th></tr></thead><tbody id="subscription-plans"></tbody></table></div><h2 class="comparison-heading">モデル別の利用可能トークン</h2><p class="section-sub">推定 token 数は、実測できる場合は Pi aggregate の input / output / cache read 比率を優先し、ない場合は provider の典型的な cache hit 率・token pattern を使います。Peak / Off-Peak の幅は quota 係数の差です。各値はそのモデルだけで月次 quota を使い切る場合の換算であり、複数モデルを同時に使える合計枠ではありません。プラン月額を目安に、低価格帯（〜$30）・中価格帯（〜$100）・高価格帯（$101〜）で分けています。</p><div id="subscription-model-groups"></div></div></section><section class="panel" id="monthly-panel" role="tabpanel" aria-labelledby="monthly-tab" hidden><div class="controls"><label>PERIOD<select id="month"></select></label><label>MACHINE<select id="machine"></select></label></div><div class="metrics" id="metrics"></div><section><h2>日別コストとトークン</h2><p class="section-sub">日別の quota 換算額。棒の高さは表示中の最大日額に対する比率。</p><div class="timeline" id="timeline"></div></section><section><h2>Model ledger</h2><p class="section-sub" id="coverage"></p><div class="table-wrap"><table><thead><tr><th>model</th><th class="numeric">requests</th><th class="numeric">input</th><th class="numeric">cache read</th><th class="numeric">output</th><th class="numeric">retail</th><th class="numeric">quota equiv.</th></tr></thead><tbody id="models"></tbody></table></div></section></section></div>
  <footer>Source: <code>observe/llm-usage/aggregate/</code> · This server binds only to <code>127.0.0.1</code>.</footer>
</main><script>
const $=id=>document.getElementById(id); let data;
const tabs=[['usage','usage-panel'],['estimate','estimate-panel'],['monthly','monthly-panel']];
const showTab=name=>{for(const [tab,panel] of tabs){const selected=tab===name;$(tab+'-tab').setAttribute('aria-selected',String(selected));$(panel).hidden=!selected}};
const showEstimateView=name=>{const comparison=name==='comparison';$('estimate-view').hidden=comparison;$('comparison-view').hidden=!comparison;$('estimate-view-tab').setAttribute('aria-selected',String(!comparison));$('comparison-view-tab').setAttribute('aria-selected',String(comparison))};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const number=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const tokens=n=>n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':number(n);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=(items,key)=>items.reduce((total,item)=>total+key(item),0);
const addOptions=(node,values,label)=>{node.innerHTML='<option value="all">'+label+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')};
const filtered=()=>data.days.filter(day=>($('month').value==='all'||day.date.startsWith($('month').value))&&($('machine').value==='all'||day.machineId===$('machine').value));
const renderEstimates=()=>{const lanes=new Map();for(const e of data.quotaEstimates){const key=[e.provider,e.accountAlias,e.kind].join('\u0000');const lane=lanes.get(key)||[];lane.push(e);lanes.set(key,lane)}$('estimates').innerHTML=[...lanes.values()].map(cycles=>{const first=cycles[0],values=cycles.map(c=>c.estimatedQuotaBudgetUsd).filter(v=>v!==null),max=Math.max(...values,1),average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;const stats=average===null?'推定可能な cycle はまだありません':'平均 '+money(average)+' · 最小 '+money(Math.min(...values))+' · 最大 '+money(Math.max(...values));const graph=cycles.map((c,n)=>'<div class="lane-bar"><b>'+esc(c.estimatedQuotaBudgetUsd===null?'—':money(c.estimatedQuotaBudgetUsd))+'</b><i style="height:'+Math.max(3,c.estimatedQuotaBudgetUsd===null?3:c.estimatedQuotaBudgetUsd/max*100)+'%"></i><span>'+String.fromCharCode(65+n)+'</span></div>').join('');const cards=cycles.map((c,n)=>{const atLimit=c.estimationMethod==='at-limit-observed-usage';const valueLabel=atLimit?'検算値':'推定利用枠';const period=atLimit?'reset 起点 '+c.usageStartAt+' → '+c.usageEndAt+'（100%到達）':'quota 観測 '+c.firstObservedAt+' → '+c.lastObservedAt;return '<article class="interval"><div class="interval-name">quota cycle '+String.fromCharCode(65+n)+' · '+valueLabel+' · reset '+esc(c.resetAt||'unknown')+'</div><div class="interval-value">'+esc(c.estimatedQuotaBudgetUsd===null?'推定不可':money(c.estimatedQuotaBudgetUsd))+'</div><div class="interval-meta">'+esc(period)+'<br>quota 観測: '+c.firstUsedPercent.toFixed(1)+'% → '+c.lastUsedPercent.toFixed(1)+'%（差分 '+c.usedPercentDelta.toFixed(1)+'%）<br>quota 換算額 '+esc(c.usage.quotaEquivalentCostUsd===null?'未価格設定あり':money(c.usage.quotaEquivalentCostUsd))+(atLimit?'<br>※ 使用率差分からの逆算ではなく、100%到達までに記録できた usage の検算値':'')+'</div></article>'}).join('');return '<article class="estimate-lane"><div class="lane-head"><div><div class="lane-title">'+esc(first.provider)+' / '+esc(first.accountAlias)+' / '+esc(first.kind)+'</div><div class="quota-kind">quota cycle ごとの最小 → 最大使用率で推定</div></div><div class="lane-summary">'+stats+'</div></div><div class="lane-graph">'+graph+'</div><div class="intervals">'+cards+'</div></article>'}).join('')||'<p class="muted">推定可能な quota cycle はまだありません。</p>'};
const renderComparison=()=>{const subscriptions=data.subscriptions;const tokenText=(range,labels=null)=>{if(range===null)return '—';const format=n=>tokens(n);if(labels!==null&&range.min!==range.max)return format(range.min)+' ('+labels.min+') – '+format(range.max)+' ('+labels.max+')';return range.min===range.max?format(range.min):format(range.min)+' – '+format(range.max)};const measurementEstimate=s=>data.quotaEstimates.filter(e=>e.provider===s.quotaMeasurement?.provider&&e.kind===s.quotaMeasurement?.kind&&e.estimatedQuotaBudgetUsd!==null).sort((a,b)=>{const p=e=>e.usedPercentDelta>=50?3:e.usedPercentDelta>=20?2:e.usedPercentDelta>0||e.estimationMethod==='at-limit-observed-usage'?1:0;return p(b)-p(a)||b.lastObservedAt.localeCompare(a.lastObservedAt)})[0];const reference=s=>{if(s.quotaMeasurement!==null){const match=measurementEstimate(s);if(match!==undefined){const end=match.resetAt===null?null:new Date(match.resetAt);if(end!==null){const start=new Date(end);if(s.quotaMeasurement.kind==='monthly')start.setUTCMonth(start.getUTCMonth()-1);else start.setUTCDate(start.getUTCDate()-7);const fmt=d=>d.toISOString().slice(0,10).replaceAll('-','/');const detail=match.estimationMethod==='at-limit-observed-usage'?'100%到達の検算値（差分なし）':match.firstUsedPercent.toFixed(0)+'% → '+match.lastUsedPercent.toFixed(0)+'% から逆算（'+money(match.estimatedQuotaBudgetUsd)+'）';return s.quotaMeasurement.kind+' '+fmt(start)+'–'+fmt(end)+'<br>'+detail}}}if(s.scaleFrom!==null&&s.quotaScale!==null)return esc(s.scaleFrom)+' の実測値 × '+s.quotaScale;if(s.monthlyQuotaUsd!==null)return '公開値';return '—'};$('subscription-plans').innerHTML=subscriptions.map(s=>'<tr><td class="model">'+(s.active?'● ':'')+esc(s.planName)+'</td><td class="numeric">'+(s.monthlyPriceUsd===null?'—':money(s.monthlyPriceUsd))+'</td><td class="numeric">'+(s.computedMonthlyQuotaUsd===null?'—':money(s.computedMonthlyQuotaUsd))+'</td><td class="numeric">'+(s.monthlyQuotaUsd===null?'—':money(s.monthlyQuotaUsd))+'</td><td class="numeric">'+(s.computedCompressionRatio===null?'—':s.computedCompressionRatio.toFixed(2)+'x')+'</td><td class="basis">'+reference(s)+'</td></tr>').join('')||'<tr><td colspan="6" class="muted">subscription master がありません。</td></tr>';const bands=[{label:'〜$30: 低価格帯',test:s=>s.monthlyPriceUsd!==null&&s.monthlyPriceUsd<=30},{label:'〜$100: 中価格帯',test:s=>s.monthlyPriceUsd!==null&&s.monthlyPriceUsd>30&&s.monthlyPriceUsd<=100},{label:'$101〜: 高価格帯',test:s=>s.monthlyPriceUsd!==null&&s.monthlyPriceUsd>100},{label:'価格不明',test:s=>s.monthlyPriceUsd===null}];$('subscription-model-groups').innerHTML=bands.map(b=>{const plans=subscriptions.filter(b.test);if(!plans.length)return '';const rows=plans.flatMap(s=>s.models.map(m=>{const range=m.availableTokensPerMonth??m.computedTokensPerMonth;const basis=m.availableTokensPerMonth===null&&m.computedTokenBasis!==null?'推定: '+m.computedTokenBasis:m.tokenBasis;return '<tr><td class="model">'+(s.active?'● ':'')+esc(s.planName)+'</td><td class="numeric">'+(s.monthlyPriceUsd===null?'—':money(s.monthlyPriceUsd))+'</td><td>'+esc(m.modelIdentifier)+'</td><td class="numeric">'+(range===null?'未推定':tokenText(range,m.tokenRangeLabels))+'</td><td class="basis">'+esc(basis)+'</td></tr>'})).join('');return '<h3 class="price-band">'+b.label+'</h3><div class="table-wrap comparison-table"><table><thead><tr><th>Plan名</th><th class="numeric">月額</th><th>モデル</th><th class="numeric">利用可能トークン数/月</th><th>基準</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}).join('')||'<p class="muted">比較対象モデルがありません。</p>'};
const render=()=>{const days=filtered();renderEstimates();renderComparison(); const report=$('report'),empty=$('empty'); report.style.display=days.length?'block':'none';empty.style.display=days.length?'none':'block';if(!days.length)return;
 const requests=sum(days,d=>d.usage.requestCount), priced=sum(days,d=>d.usage.pricedRequestCount), retail=sum(days,d=>d.usage.pricedRetailCostUsd), quota=sum(days,d=>d.usage.pricedQuotaEquivalentCostUsd), tokenTotal=sum(days,d=>d.usage.tokens.input+d.usage.tokens.output+d.usage.tokens.cacheRead+d.usage.tokens.cacheWrite);
 $('metrics').innerHTML=[['Quota 換算額',money(quota)],['API 定価換算',money(retail)],['リクエスト',number(requests)],['トークン',tokens(tokenTotal)]].map(([label,value])=>'<article class="metric"><span class="label">'+label+'</span><strong class="value">'+value+'</strong></article>').join('');
 const byDate=new Map();for(const day of days){const current=byDate.get(day.date)||{quota:0,retail:0,requests:0};current.quota+=day.usage.pricedQuotaEquivalentCostUsd;current.retail+=day.usage.pricedRetailCostUsd;current.requests+=day.usage.requestCount;byDate.set(day.date,current)}const entries=[...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0]));const max=Math.max(...entries.map(([,v])=>v.quota),0);$('timeline').innerHTML=entries.map(([date,v])=>'<article class="day" title="'+esc(date)+' · quota '+money(v.quota)+'"><div class="day-top"><span>'+esc(date.slice(5))+'</span><span>'+number(v.requests)+'</span></div><div class="bar"><i class="fill" style="height:'+Math.max(4,max===0?0:v.quota/max*100)+'%"></i></div><div class="cost">'+money(v.quota)+'</div></article>').join('');
 const models=new Map();for(const day of days)for(const model of day.usage.models){const current=models.get(model.modelIdentifier)||{...model,tokens:{input:0,output:0,cacheRead:0,cacheWrite:0},requestCount:0,pricedRequestCount:0,pricedRetailCostUsd:0,pricedQuotaEquivalentCostUsd:0};current.requestCount+=model.requestCount;current.pricedRequestCount+=model.pricedRequestCount;current.pricedRetailCostUsd+=model.pricedRetailCostUsd;current.pricedQuotaEquivalentCostUsd+=model.pricedQuotaEquivalentCostUsd;for(const key of ['input','output','cacheRead','cacheWrite'])current.tokens[key]+=model.tokens[key];models.set(model.modelIdentifier,current)}const rows=[...models.values()].sort((a,b)=>b.pricedQuotaEquivalentCostUsd-a.pricedQuotaEquivalentCostUsd);$('models').innerHTML=rows.map(m=>'<tr><td class="model">'+esc(m.modelIdentifier)+'</td><td class="numeric">'+number(m.requestCount)+'</td><td class="numeric">'+tokens(m.tokens.input)+'</td><td class="numeric">'+tokens(m.tokens.cacheRead)+'</td><td class="numeric">'+tokens(m.tokens.output)+'</td><td class="numeric">'+money(m.pricedRetailCostUsd)+'</td><td class="numeric">'+money(m.pricedQuotaEquivalentCostUsd)+'</td></tr>').join('');$('coverage').innerHTML='価格設定済み: <strong>'+number(priced)+' / '+number(requests)+' requests</strong>'+(priced===requests?'':' <span class="warning">— 未価格設定 usage は額から除外</span>');
 const windows=new Map();for(const day of days)for(const w of day.quotaWindows){const key=[w.provider,w.accountAlias,w.kind].join('\u0000');const current=windows.get(key);if(!current||w.maxUsedPercent>current.maxUsedPercent)windows.set(key,w)}$('quotas').innerHTML=[...windows.values()].sort((a,b)=>[a.provider,a.kind].join().localeCompare([b.provider,b.kind].join())).map(w=>'<article class="quota"><header><div class="quota-name">'+esc(w.provider)+' / '+esc(w.accountAlias)+'</div><div class="quota-kind">'+esc(w.kind)+'</div></header><div class="percent">'+w.maxUsedPercent.toFixed(1)+'%</div><div class="meter"><i style="width:'+Math.min(100,w.maxUsedPercent)+'%"></i></div><small>reset: '+esc(w.resetAt||'unknown')+'</small></article>').join('')||'<p class="muted">No quota observations in this selection.</p>';
};
fetch('/api/dashboard').then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(response=>{data=response;$('stamp').textContent='GENERATED '+new Date(data.generatedAt).toISOString().slice(0,16).replace('T',' ')+' UTC';addOptions($('month'),[...data.months].reverse(),'ALL PERIODS');addOptions($('machine'),data.machines,'ALL MACHINES');$('month').onchange=render;$('machine').onchange=render;for(const [tab] of tabs)$(tab+'-tab').onclick=()=>showTab(tab);$('estimate-view-tab').onclick=()=>showEstimateView('estimate');$('comparison-view-tab').onclick=()=>showEstimateView('comparison');render()}).catch(error=>{$('empty').style.display='block';$('empty').textContent='Unable to load aggregate data: '+error.message;});
</script></body></html>`

export type DashboardServer = {
  readonly url: string
  readonly close: () => Promise<void>
}

export const startDashboardServer = async (options: { readonly usageRoot: string; readonly port: number }): Promise<DashboardServer> => {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
    throw new Error("port must be an integer from 0 to 65535")
  }
  const server = createServer((request, response) => {
    const respondError = (status: number, message: string): void => {
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" })
      response.end(message)
    }
    if (request.method !== "GET") return respondError(405, "Method Not Allowed")
    if (request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
      response.end(dashboardHtml)
      return
    }
    if (request.url === "/api/dashboard") {
      void loadDashboardData(options.usageRoot)
        .then((data) => {
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
          response.end(JSON.stringify(data))
        })
        .catch((error: unknown) => respondError(500, error instanceof Error ? error.message : "Unable to load dashboard data"))
      return
    }
    respondError(404, "Not Found")
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, LOOPBACK_HOST, () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address()
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)))
    throw new Error("Unable to determine dashboard server port")
  }
  return {
    url: `http://${LOOPBACK_HOST}:${address.port}`,
    close: async () => new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error))),
  }
}
