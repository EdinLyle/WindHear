// ===== SkillsAudit 类型定义 =====

/** Skills 安全审计流水线阶段 */
export type SkillsAuditStage = 'pending' | 'unpacking' | 'analyzing' | 'scanning' | 'ai_auditing' | 'aggregating' | 'reporting' | 'completed' | 'failed'

/** 风险类别：20种AI Skills特有风险 */
export type RiskCategory =
  | 'dangerous_command'
  | 'reverse_shell'
  | 'hardcoded_secrets'
  | 'prompt_injection'
  | 'data_exfiltration'
  | 'sensitive_file_access'
  | 'dynamic_code_execution'
  | 'privilege_escalation'
  | 'weak_crypto'
  | 'command_injection'
  | 'supply_chain_attack'
  | 'unauthorized_tool_use'
  | 'trigger_hijacking'
  | 'skill_md_mismatch'
  | 'code_quality'
  | 'bytecode_tampering'
  | 'obfuscation'
  | 'resource_abuse'
  | 'unicode_steganography'
  | 'social_engineering'

/** 严重程度 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** 置信度 */
export type Confidence = 'high' | 'medium' | 'low'

/** 发现项状态 */
export type ItemStatus = 'confirmed' | 'false_positive' | 'pending'

/** 风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** 项目文件信息 */
export interface ProjectFile {
  path: string
  language: string
  size: number
  content?: string
}

/** Skill解析结果 */
export interface ParsedSkill {
  name: string
  description?: string
  triggers?: string[]
  entryFile?: string
  files: ProjectFile[]
  manifest?: Record<string, unknown>
}

/** SKILL.MD 解析结果 */
export interface SkillManifest {
  name: string
  version?: string
  description?: string
  triggers: Array<{
    type: string
    pattern: string
  }>
  entryPoint?: string
  permissions?: string[]
  dependencies?: string[]
}

/** 正则扫描匹配结果 */
export interface RegexMatch {
  riskCategory: RiskCategory
  filePath: string
  lineStart: number
  lineEnd: number
  matchText: string
  pattern: string
}

/** Agent发现项 */
export interface AgentFinding {
  riskCategory: RiskCategory
  title: string
  description: string
  severity: Severity
  confidence: Confidence
  filePath: string
  lineStart?: number
  lineEnd?: number
  vulnerableCode?: string
  evidence: string
  remediation: string
  cweId?: string
  cweName?: string
}

/** Agent接口 */
export interface SkillsAuditAgent {
  /** Agent名称 */
  name: string
  /** 负责的风险类别 */
  riskCategories: RiskCategory[]
  /** 执行审计 */
  audit(ctx: AgentContext): Promise<AgentFinding[]>
}

/** Agent执行上下文 */
export interface AgentContext {
  /** 审计ID */
  auditId: number
  /** 解压目录 */
  extractDir: string
  /** 项目文件列表 */
  projectFiles: ProjectFile[]
  /** 解析到的Skills */
  skills: ParsedSkill[]
  /** SKILL.MD清单 */
  manifest: SkillManifest | null
  /** 正则扫描初步匹配 */
  regexMatches: RegexMatch[]
  /** 模型配置 */
  modelConfig: {
    provider: 'ollama' | 'openai' | 'anthropic' | 'zhipu'
    baseUrl: string
    apiKey?: string
    model?: string
    systemPrompt?: string
    timeoutMs?: number
  }
  /** 漏洞知识库 */
  vulnKbPatterns: Array<{ cweId: string; cweName: string; riskPattern: string; severity: string }>
}

/** 流水线上下文 */
export interface PipelineContext {
  auditId: number
  extractDir: string
  store: import('../skillsAuditStore.js').SkillsAuditStore
  zipBuffer: Buffer
  modelConfig: {
    provider: 'ollama' | 'openai' | 'anthropic' | 'zhipu'
    baseUrl: string
    apiKey?: string
    model?: string
    systemPrompt?: string
    timeoutMs?: number
  }
  // 以下字段在流水线各阶段填充
  projectFiles: ProjectFile[]
  totalFiles: number
  skills: ParsedSkill[]
  manifest: SkillManifest | null
  totalSkills: number
  regexMatches: RegexMatch[]
  agentFindings: AgentFinding[]
  vulnKbPatterns: Array<{ cweId: string; cweName: string; riskPattern: string; severity: string }>
}