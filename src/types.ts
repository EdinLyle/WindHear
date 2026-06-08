export type LibraryType = 'tc260' | 'general' | 'custom' | 'all'
export type Provider = 'ollama' | 'openai' | 'anthropic' | 'zhipu'

export type Overview = {
  recentEvaluations: Array<{
    id: string
    name: string
    standard: Exclude<LibraryType, 'all'>
    status: string
    passRate: number
    createdAt: number
  }>
  recentMcpScans: Array<{
    id: string
    name: string
    status: string
    createdAt: number
  }>
  recentCodeAudits: Array<{
    id: string
    name: string
    status: string
    findingsCount: number
    riskScore: number
    createdAt: number
  }>
  recentSkillsAudits: Array<{
    id: number
    name: string
    status: string
    findingsCount: number
    riskScore: number
    riskLevel: string
    createdAt: number
  }>
  passRate30d: number
  arsenalCounts: Record<string, number>
  trend: Array<{ day: string; cnt: number; passRate: number }>
  mcpTrend: Array<{ day: string; cnt: number }>
  codeAuditTrend: Array<{ day: string; cnt: number }>
  skillsAuditTrend: Array<{ day: string; cnt: number }>
  severityDistribution: Array<{ severity: string; cnt: number }>
  cweDistribution: Array<{ cweId: string; cweName: string; cnt: number }>
  mcpSeverityDistribution: Array<{ severity: string; cnt: number }>
  skillsSeverityDistribution: Array<{ severity: string; cnt: number }>
  skillsRiskCategoryDistribution: Array<{ riskCategory: string; cnt: number }>
}

export type PromptCollection = {
  id: string
  name: string
  library: Exclude<LibraryType, 'all'>
  description?: string
  promptCount: number
  createdAt: number
  updatedAt: number
}

export type PromptItem = {
  id: string
  library: Exclude<LibraryType, 'all'>
  collectionId?: string
  collectionName?: string
  riskType: string
  riskSubType?: string
  prompt: string
  createdAt: number
}

export type EvaluationListItem = {
  id: string
  name: string
  standard: Exclude<LibraryType, 'all'>
  status: string
  passRate: number
  totalCount: number
  passCount: number
  failCount: number
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
}

export type EvaluationReport = {
  evaluation: EvaluationListItem & {
    targetProvider?: Provider
    targetBaseUrl?: string
    targetModel?: string | null
  }
  items: Array<{
    id: string
    inputPrompt: string
    riskType: string
    riskSubType?: string
    modelOutput: string
    evaluatorScore: number | null
    evaluatorRawOutput: string | null
    createdAt: number
  }>
}

export type EvaluatorSettings = {
  provider: Provider
  baseUrl: string
  apiKey: string
  model?: string
  systemPrompt: string | null
  timeoutMs?: number
}

export type CodeAuditModelSettings = {
  provider: Provider
  baseUrl: string
  apiKey: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// 统一的模型配置类型（所有选项卡共用）
export type ModelTabSettings = {
  provider: Provider
  baseUrl: string
  apiKey: string
  model?: string
  systemPrompt: string | null
  timeoutMs?: number  // 10~600秒，超时时间（秒）
}

// MCP 扫描相关类型
export type McpScanStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed'

export type McpScanProgress = {
  stage: string
  percent: number
}

export type McpScanListItem = {
  id: string
  name?: string
  originalFilename: string
  status: McpScanStatus
  progress: McpScanProgress
  createdAt: number
  error?: string
  scoreTotal?: number
  scoreRiskLevel?: 'low' | 'medium' | 'high' | 'critical'
  judgeModel?: string
  judgeBaseUrl?: string
}

export type McpVulnerability = {
  id: string
  title: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'confirmed' | 'likely' | 'needs_review' | 'false_positive'
  description: string
  impact: string
  evidence: Array<{
    file: string
    lineStart?: number
    lineEnd?: number
    snippet?: string
  }>
  exploitation: string
  remediation: string
  confidence: number
}

export type McpScanReport = {
  scanId: string
  generatedAt: number
  project: {
    rootName: string
    languages: string[]
    frameworks: string[]
    mcpIndicators: string[]
    fileStats: {
      totalFiles: number
      totalBytes: number
    }
  }
  findings: McpVulnerability[]
  score: {
    total: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  }
  markdown: string
}

// ===== CodeAudit 相关类型 =====

export type AuditStatus = 'pending' | 'parsing' | 'slicing' | 'auditing' | 'aggregating' | 'completed' | 'failed'
export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AuditConfidence = 'high' | 'medium' | 'low'
export type AuditItemStatus = 'confirmed' | 'false_positive' | 'pending'
export type AuditSliceType = 'function' | 'class' | 'api_call' | 'config' | 'route' | 'other'

export type CodeAuditListItem = {
  id: number
  name: string
  sourceType: 'zip' | 'git'
  status: AuditStatus
  language: string | null
  totalFiles: number
  totalSlices: number
  findingsCount: number
  riskScore: number
  createdAt: number
  completedAt: number | null
  errorMessage: string | null
}

export type CodeAuditDetail = {
  id: number
  name: string
  sourceType: 'zip' | 'git'
  sourceUrl: string | null
  status: AuditStatus
  language: string | null
  totalFiles: number
  totalSlices: number
  processedSlices: number
  findingsCount: number
  riskScore: number
  modelConfig: { provider: Provider; baseUrl: string; apiKey?: string; model?: string } | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  errorMessage: string | null
  logs: Array<{
    stage: string
    message: string
    detail: string | null
    createdAt: number
  }>
}

export type CodeAuditItem = {
  id: number
  auditId: number
  sliceId: number | null
  cweId: string | null
  cweName: string | null
  title: string
  description: string | null
  filePath: string
  lineStart: number | null
  lineEnd: number | null
  vulnerableCode: string | null
  fixSuggestion: string | null
  severity: AuditSeverity
  confidence: AuditConfidence
  exploitability: number
  dataFlow: string | null
  status: AuditItemStatus
  pocDescription: string | null
  pocCode: string | null
  reproduceSteps: string | null
  fixCode: string | null
}

export type CodeAuditSlice = {
  id: number
  auditId: number
  filePath: string
  language: string
  sliceType: AuditSliceType
  content: string
  contextSummary: string | null
  lineStart: number
  lineEnd: number
  isSensitive: number
  sensitiveTags: string[]
  auditStatus: string | null
  auditResult: string | null
}

export type VulnKbEntry = {
  id: number
  cweId: string
  cweName: string
  description: string | null
  riskPattern: string | null
  fixPattern: string | null
  severity: string | null
  tags: string[]
}

// ===== SkillsAudit 相关类型 =====

export type SkillsAuditStatus = 'pending' | 'unpacking' | 'analyzing' | 'scanning' | 'ai_auditing' | 'aggregating' | 'reporting' | 'completed' | 'failed'

export type SkillsAuditRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type SkillsAuditListItem = {
  id: number
  name: string
  originalFilename: string
  status: SkillsAuditStatus
  progressStage: string
  progressPercent: number
  totalSkills: number
  totalFiles: number
  findingsCount: number
  riskScore: number
  riskLevel: SkillsAuditRiskLevel | null
  createdAt: number
  completedAt: number | null
  errorMessage: string | null
}

export type SkillsAuditDetail = {
  id: number
  name: string
  originalFilename: string
  status: SkillsAuditStatus
  progressStage: string
  progressPercent: number
  totalSkills: number
  totalFiles: number
  findingsCount: number
  riskScore: number
  riskLevel: SkillsAuditRiskLevel | null
  skillManifest: {
    name: string
    triggers: Array<{ type: string; pattern: string }>
    entryPoint?: string
    permissions?: string[]
  } | null
  modelConfig: { provider: Provider; baseUrl: string; apiKey?: string; model?: string } | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  errorMessage: string | null
  logs: Array<{
    stage: string
    level: 'info' | 'warn' | 'error'
    message: string
    detail: string | null
    createdAt: number
  }>
}

export type SkillsAuditItem = {
  id: number
  auditId: number
  riskCategory: string
  title: string
  description: string | null
  severity: AuditSeverity
  confidence: AuditConfidence
  filePath: string
  lineStart: number | null
  lineEnd: number | null
  vulnerableCode: string | null
  evidence: string | null
  remediation: string | null
  cweId: string | null
  cweName: string | null
  status: AuditItemStatus
  createdAt: number
}
