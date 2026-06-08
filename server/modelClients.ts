import { z } from 'zod'
import type { ChatCompletionResult, TokenUsage } from './types.js'
import { insertTokenUsage } from './db.js'
import { estimateCost } from './services/pricingService.js'

type OpenAIUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
type AnthropicUsage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }

export type Provider = 'ollama' | 'openai' | 'anthropic' | 'zhipu' | 'deepseek'

export type ModelConfig = {
  provider: Provider
  baseUrl: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  taskId?: string
  module?: string
  sessionId?: string
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatCompletion(config: ModelConfig, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  if (config.provider === 'ollama') {
    return ollamaChat(config, messages)
  }
  if (config.provider === 'anthropic') {
    return anthropicChat(config, messages)
  }
  if (config.provider === 'zhipu') {
    return zhipuChat(config, messages)
  }
  // openai, deepseek (both use OpenAI-compatible API)
  return openaiChat(config, messages)
}

async function ollamaChat(config: ModelConfig, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`
  const res = await fetchWithTimeout(
    url,
    {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model ?? 'llama3',
      messages,
      stream: false,
    }),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      message: z.object({ content: z.string() }),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('Ollama响应解析失败')
  }
  // Ollama 无标准 usage，返回 undefined
  const result: ChatCompletionResult = { content: parsed.data.message.content, usage: undefined }
  recordTokenUsage(config, result.usage)
  return result
}

async function openaiChat(config: ModelConfig, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
  const res = await fetchWithTimeout(
    url,
    {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model ?? 'gpt-4o-mini',
      messages,
      temperature: 0,
    }),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('OpenAI响应解析失败')
  }

  const usage: OpenAIUsage | undefined = (json as { usage?: OpenAIUsage }).usage
  const tokenUsage: TokenUsage | undefined = usage ? {
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    model: config.model ?? '',
    provider: config.provider,
    timestamp: new Date().toISOString(),
    taskId: config.taskId || '',
    module: config.module || '',
  } : undefined

  const result: ChatCompletionResult = { content: parsed.data.choices[0].message.content ?? '', usage: tokenUsage }
  recordTokenUsage(config, result.usage)
  return result
}

async function anthropicChat(config: ModelConfig, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/v1/messages`

  // Anthropic 的 system 消息不放在 messages 中，而是作为顶层 system 字段
  const systemMessage = messages.find(m => m.role === 'system')?.content
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, unknown> = {
    model: config.model ?? 'claude-sonnet-4-20250514',
    messages: chatMessages,
    max_tokens: 4096,
  }
  if (systemMessage) {
    body.system = systemMessage
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).min(1),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('Anthropic响应解析失败')
  }
  // 提取第一个 text 类型的 content block
  const textBlock = parsed.data.content.find(b => b.type === 'text' && b.text)

  // 提取 usage（Anthropic 格式）
  const usage: AnthropicUsage | undefined = (json as { usage?: AnthropicUsage }).usage
  const tokenUsage: TokenUsage | undefined = usage ? {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cachedInputTokens: usage.cache_read_input_tokens,
    totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    model: config.model ?? '',
    provider: config.provider,
    timestamp: new Date().toISOString(),
    taskId: config.taskId || '',
    module: config.module || '',
  } : undefined

  const result: ChatCompletionResult = { content: textBlock?.text ?? '', usage: tokenUsage }
  recordTokenUsage(config, result.usage)
  return result
}

async function zhipuChat(config: ModelConfig, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  // 智谱路径: /v4/chat/completions（不同于OpenAI的/v1/）
  const url = baseUrl.endsWith('/v4')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v4/chat/completions`
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model ?? 'glm-4-flash',
        messages,
        temperature: 0,
      }),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`智谱请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('智谱响应解析失败')
  }

  // 提取 usage（智谱兼容 OpenAI 格式）
  const usage: OpenAIUsage | undefined = (json as { usage?: OpenAIUsage }).usage
  const tokenUsage: TokenUsage | undefined = usage ? {
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    model: config.model ?? '',
    provider: config.provider,
    timestamp: new Date().toISOString(),
    taskId: config.taskId || '',
    module: config.module || '',
  } : undefined

  const result: ChatCompletionResult = { content: parsed.data.choices[0].message.content ?? '', usage: tokenUsage }
  recordTokenUsage(config, result.usage)
  return result
}

/** 集中式 Token 使用记录写入 */
function recordTokenUsage(config: ModelConfig, usage: TokenUsage | undefined): void {
  if (!usage) return
  if (!usage.taskId) {
    console.warn('[recordTokenUsage] Skipping: taskId is empty (model=%s, provider=%s)', config.model, config.provider)
    return
  }
  try {
    const cost = estimateCost(usage)
    insertTokenUsage({
      taskId: usage.taskId,
      sessionId: config.sessionId,
      module: usage.module,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      reasoningTokens: usage.reasoningTokens,
      totalTokens: usage.totalTokens,
      model: usage.model,
      provider: usage.provider,
      costAmount: cost.amount,
      costCurrency: cost.currency === 'UNMAPPED' ? undefined : cost.currency,
    })
  } catch (e) {
    console.error('Failed to record token usage:', e)
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number) {
  const ms = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 30_000
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort =
      e instanceof Error &&
      (e.name === 'AbortError' || /aborted/i.test(e.message) || /被中止/.test(e.message) || /中止/.test(e.message))
    const head = isAbort ? `请求超时(${ms}ms)` : '请求失败'
    throw new Error(`${head}: ${msg} (${url})`.slice(0, 300))
  } finally {
    clearTimeout(t)
  }
}