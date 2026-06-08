import pricingData from '../../data/pricing.json' with { type: 'json' }
import type { PricingData, ModelPricing, CostEstimate, TokenUsage } from '../types.js'

const pricing = pricingData as PricingData

/** 获取完整价格表 */
export function getPricingData(): PricingData {
  return pricing
}

/** 获取指定 provider + model 的定价 */
export function getModelPricing(provider: string, model: string): ModelPricing | null {
  const providerPricing = pricing[provider]
  if (!providerPricing) return null
  return providerPricing[model] ?? null
}

/** 估算成本 */
export function estimateCost(usage: TokenUsage, customPricing?: PricingData): CostEstimate {
  const data = customPricing ?? pricing
  const providerPricing = data[usage.provider]
  if (!providerPricing) {
    return { amount: null, currency: 'UNMAPPED' }
  }

  const modelPricing = providerPricing[usage.model]
  if (!modelPricing) {
    return { amount: null, currency: 'UNMAPPED' }
  }

  let inputCost: number

  // DeepSeek 特殊处理：缓存命中/未命中分别计价
  if (modelPricing.input_cache_hit != null && modelPricing.input_cache_miss != null && usage.cachedInputTokens != null && usage.cachedInputTokens > 0) {
    const nonCachedTokens = Math.max(0, usage.inputTokens - usage.cachedInputTokens)
    inputCost = (usage.cachedInputTokens * modelPricing.input_cache_hit + nonCachedTokens * modelPricing.input_cache_miss) / 1000
  } else {
    inputCost = (usage.inputTokens * modelPricing.input) / 1000
  }

  const outputCost = (usage.outputTokens * modelPricing.output) / 1000
  const totalCost = parseFloat((inputCost + outputCost).toFixed(6))

  return {
    amount: totalCost,
    currency: modelPricing.currency,
    breakdown: {
      inputCost: parseFloat(inputCost.toFixed(6)),
      outputCost: parseFloat(outputCost.toFixed(6)),
    },
  }
}

/** 获取支持的模型列表 */
export function getSupportedModels(): Array<{
  provider: string
  model: string
  inputPrice: number
  outputPrice: number
  currency: string
}> {
  const models: Array<{ provider: string; model: string; inputPrice: number; outputPrice: number; currency: string }> = []
  for (const [provider, providerModels] of Object.entries(pricing)) {
    for (const [model, pricing] of Object.entries(providerModels)) {
      models.push({
        provider,
        model,
        inputPrice: pricing.input,
        outputPrice: pricing.output,
        currency: pricing.currency,
      })
    }
  }
  return models
}