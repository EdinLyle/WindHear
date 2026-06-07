export type SliceType = 'function' | 'class' | 'api_call' | 'config' | 'route' | 'other'

export interface CodeSlice {
  filePath: string
  language: string
  sliceType: SliceType
  content: string
  contextSummary?: string
  lineStart: number
  lineEnd: number
}

export interface ParserResult {
  sliceIndex: number
  trustBoundary: 'safe' | 'suspicious' | 'dangerous'
  sensitiveTags: string[]
  reason: string
}

export interface RawFinding {
  cweId: string
  cweName: string
  title: string
  description: string
  filePath: string
  lineStart: number
  lineEnd: number
  vulnerableCode: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  confidence: 'high' | 'medium' | 'low'
  exploitability: number
  dataFlow: string
  fixSuggestion: string
  /** PoC描述：说明该漏洞的验证思路和方法 */
  pocDescription: string
  /** PoC代码：可直接执行的漏洞验证代码片段 */
  pocCode: string
  /** 复现步骤：逐步描述如何复现该漏洞 */
  reproduceSteps: string
  /** 参考修复代码：可直接使用的修复代码片段 */
  fixCode: string
}

export interface ValidatedFinding extends RawFinding {
  validated: boolean
  validationReason: string
}

export interface AuditReport {
  riskScore: number
  summary: string
  findings: ValidatedFinding[]
}

export interface PipelineContext {
  auditId: number
  extractDir: string
  slices: CodeSlice[]
  parserResults: ParserResult[]
  rawFindings: RawFinding[]
  validatedFindings: ValidatedFinding[]
  vulnKbPatterns: Array<{ cweId: string; cweName: string; riskPattern: string; severity: string }>
  modelConfig: {
    provider: 'ollama' | 'openai' | 'anthropic' | 'zhipu'
    baseUrl: string
    apiKey?: string
    model?: string
    systemPrompt?: string
    timeoutMs?: number
  }
}