import { chatCompletion, type ModelConfig } from '../../modelClients.js'
import type { ScanOptions } from '../types.js'

export async function callLlm(input: {
  roleSystem: string
  user: string
  modelHint: 'default' | 'thinking' | 'coding' | 'fast'
  temperature: number
  options?: ScanOptions
  taskId?: string
  module?: string
}): Promise<string> {
  const { roleSystem, user, options, taskId, module } = input

  const modelConfig: ModelConfig = {
    provider: options?.provider || (options?.baseUrl?.includes('ollama') ? 'ollama' : 'openai'),
    baseUrl: options?.baseUrl || 'https://api.openai.com/v1',
    apiKey: options?.apiKey,
    model: options?.model || 'gpt-4o',
    timeoutMs: options?.timeoutMs ?? 60000,
    taskId,
    module: module || 'mcp',
  }

  const response = await chatCompletion(modelConfig, [
    { role: 'system', content: roleSystem },
    { role: 'user', content: user }
  ])

  return response.content
}
