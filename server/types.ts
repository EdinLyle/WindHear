// Token 消耗数据
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  model: string
  provider: string       // 'openai' | 'anthropic' | 'ollama' | 'zhipu' | 'deepseek'
  timestamp: string
  taskId: string
  module: string         // 'evaluation' | 'mcp' | 'code-audit' | 'skills-audit'
}

// chatCompletion 返回的扩展类型
export interface ChatCompletionResult {
  content: string
  usage?: TokenUsage
}

// 价格表模型定义
export interface ModelPricing {
  input: number            // 每 1000 tokens 价格
  output: number           // 每 1000 tokens 价格
  input_cache_hit?: number // DeepSeek 缓存命中价格
  input_cache_miss?: number // DeepSeek 缓存未命中价格
  currency: 'USD' | 'CNY'
}

export interface PricingData {
  [provider: string]: {
    [model: string]: ModelPricing
  }
}

// 成本估算
export interface CostEstimate {
  amount: number | null
  currency: 'USD' | 'CNY' | 'UNMAPPED'
  breakdown?: {
    inputCost: number
    outputCost: number
  }
}

// 小票数据（API 响应用）
export interface TokenReceiptData {
  taskId: string
  sessionId: string
  module: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  costAmount: number | null
  costCurrency: 'USD' | 'CNY' | 'UNMAPPED'
  timestamp: string
  receiptId: string    // 格式：TF_YYYYMMDD_HHMMSS_XXXXXX
}

// 数据库行类型
export interface TokenUsageRow {
  id: number
  task_id: string
  session_id: string | null
  module: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number | null
  reasoning_tokens: number | null
  total_tokens: number
  model: string
  provider: string
  cost_amount: number | null
  cost_currency: string | null
  timestamp: string
}