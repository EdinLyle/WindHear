/**
 * Skills Audit 流水线
 * 7阶段状态机: pending → unpacking → analyzing → scanning → ai_auditing → aggregating → reporting → completed
 */
import { promises as fs } from 'fs'
import path from 'path'
import type { SkillsAuditStore } from '../skillsAuditStore.js'
import type { PipelineContext, ProjectFile, ParsedSkill, SkillManifest, AgentFinding } from './types.js'
import { unzipToDirectory } from '../mcpScan/util/unzip.js'
import { runRegexScan } from './stages/regexScan.js'
import { ALL_AGENTS } from './agents.js'

const MAX_FILES = 200

const SKILLS_EXTENSIONS: Record<string, string> = {
  '.py': 'python', '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.md': 'markdown', '.txt': 'text',
  '.env': 'env', '.cfg': 'config', '.ini': 'config',
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'out',
  '.venv', 'venv', 'vendor', '.gradle', '.idea', '.vscode', 'target',
])

export async function runSkillsAuditPipeline(input: {
  auditId: number
  store: SkillsAuditStore
  zipBuffer: Buffer
  modelConfig: {
    provider: 'ollama' | 'openai' | 'anthropic' | 'zhipu'
    baseUrl: string
    apiKey?: string
    model?: string
    systemPrompt?: string
    taskId?: string
    module?: string
  }
}) {
  const { auditId, store, modelConfig } = input
  const extractDir = path.join('temp', 'skills-audits', String(auditId))

  const ctx: PipelineContext = {
    auditId,
    extractDir,
    store,
    zipBuffer: input.zipBuffer,
    modelConfig: {
      ...modelConfig,
      taskId: String(auditId),
      module: 'skills-audit',
    },
    projectFiles: [],
    totalFiles: 0,
    skills: [],
    manifest: null,
    totalSkills: 0,
    regexMatches: [],
    agentFindings: [],
    vulnKbPatterns: [],
  }

  try {
    // ===== Phase 1: Unpacking =====
    await store.updateAuditStatus(auditId, 'unpacking')
    await store.updateProgress(auditId, 'unpacking', 10)
    await store.addLog(auditId, 'unpacking', 'info', '开始解压Skills包...')

    await fs.mkdir(extractDir, { recursive: true })
    await unzipToDirectory(input.zipBuffer, extractDir)

    await store.addLog(auditId, 'unpacking', 'info', '解压完成')

    // ===== Phase 2: Analyzing =====
    await store.updateAuditStatus(auditId, 'analyzing')
    await store.updateProgress(auditId, 'analyzing', 20)
    await store.addLog(auditId, 'analyzing', 'info', '开始解析Skills结构...')

    const { projectFiles, totalFiles } = await scanProject(extractDir)
    ctx.projectFiles = projectFiles
    ctx.totalFiles = totalFiles

    // 读取文件内容
    for (const file of projectFiles) {
      try {
        file.content = await fs.readFile(path.join(extractDir, file.path), 'utf-8')
      } catch { /* ignore binary */ }
    }

    // 解析Skills结构
    const { skills, manifest } = await parseSkills(projectFiles, extractDir)
    ctx.skills = skills
    ctx.manifest = manifest
    ctx.totalSkills = skills.length

    await store.updateAuditStatus(auditId, 'analyzing', {
      total_files: totalFiles,
      total_skills: skills.length,
      skill_manifest: manifest ? JSON.stringify(manifest) : null,
    })

    await store.addLog(auditId, 'analyzing', 'info', `解析到 ${skills.length} 个Skills, ${totalFiles} 个文件`)

    // ===== Phase 3: Regex Scanning =====
    await store.updateAuditStatus(auditId, 'scanning')
    await store.updateProgress(auditId, 'scanning', 40)
    await store.addLog(auditId, 'scanning', 'info', '开始正则扫描...')

    ctx.regexMatches = runRegexScan(projectFiles)

    await store.addLog(auditId, 'scanning', 'info', `正则扫描完成，发现 ${ctx.regexMatches.length} 个初步匹配`)

    // ===== Phase 4: AI Auditing =====
    await store.updateAuditStatus(auditId, 'ai_auditing')
    await store.updateProgress(auditId, 'ai_auditing', 50)
    await store.addLog(auditId, 'ai_auditing', 'info', `开始AI审计，启动 ${ALL_AGENTS.length} 个Agent...`)

    // 获取漏洞知识库
    ctx.vulnKbPatterns = []

    // 并行执行所有Agent（带超时控制）
    const agentContext = {
      auditId: ctx.auditId,
      extractDir: ctx.extractDir,
      projectFiles: ctx.projectFiles,
      skills: ctx.skills,
      manifest: ctx.manifest,
      regexMatches: ctx.regexMatches,
      modelConfig: ctx.modelConfig,
      vulnKbPatterns: ctx.vulnKbPatterns,
    }

    const agentPromises = ALL_AGENTS.map(async (agent, idx) => {
      try {
        const findings = await Promise.race([
          agent.audit(agentContext),
          new Promise<AgentFinding[]>((_, reject) =>
            setTimeout(() => reject(new Error('Agent timeout')), 90_000)
          ),
        ])
        const percent = 50 + Math.round(((idx + 1) / ALL_AGENTS.length) * 30)
        await store.updateProgress(auditId, 'ai_auditing', percent)
        await store.addLog(auditId, 'ai_auditing', 'info', `${agent.name}审计完成，发现 ${findings.length} 个问题`)
        return findings
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        await store.addLog(auditId, 'ai_auditing', 'warn', `${agent.name}审计超时或失败: ${errMsg}`)
        return [] as AgentFinding[]
      }
    })

    const agentResults = await Promise.all(agentPromises)
    for (const findings of agentResults) {
      ctx.agentFindings.push(...findings)
    }

    await store.addLog(auditId, 'ai_auditing', 'info', `AI审计完成，共发现 ${ctx.agentFindings.length} 个问题`)

    // ===== Phase 5: Aggregating =====
    await store.updateAuditStatus(auditId, 'aggregating')
    await store.updateProgress(auditId, 'aggregating', 85)
    await store.addLog(auditId, 'aggregating', 'info', '开始结果聚合...')

    // 去重：按 filePath + lineStart + riskCategory 合并
    const deduped = dedupFindings(ctx.agentFindings)
    ctx.agentFindings = deduped

    // 确定严重程度：正则+LLM双重确认 → 提升置信度
    for (const finding of ctx.agentFindings) {
      const hasRegexMatch = ctx.regexMatches.some(
        m => m.filePath === finding.filePath && m.riskCategory === finding.riskCategory
      )
      if (hasRegexMatch && finding.confidence === 'medium') {
        finding.confidence = 'high'
      }
    }

    // 写入发现项到数据库
    for (const finding of ctx.agentFindings) {
      await store.createItem({
        auditId,
        riskCategory: finding.riskCategory,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        confidence: finding.confidence,
        filePath: finding.filePath,
        lineStart: finding.lineStart,
        lineEnd: finding.lineEnd,
        vulnerableCode: finding.vulnerableCode,
        evidence: finding.evidence,
        remediation: finding.remediation,
        cweId: finding.cweId,
        cweName: finding.cweName,
        status: 'confirmed',
      })
    }

    // 计算评分
    const { total: riskScore, riskLevel } = store.calcRiskScore(ctx.agentFindings)

    await store.addLog(auditId, 'aggregating', 'info', `结果聚合完成，去重后 ${ctx.agentFindings.length} 个发现项，风险评分: ${riskScore} (${riskLevel})`)

    // ===== Phase 6: Reporting =====
    await store.updateAuditStatus(auditId, 'reporting')
    await store.updateProgress(auditId, 'reporting', 95)
    await store.addLog(auditId, 'reporting', 'info', '生成审计报告...')

    const markdown = generateMarkdownReport(ctx, riskScore, riskLevel)
    await store.createReport({
      auditId,
      projectInfo: JSON.stringify({
        totalFiles: ctx.totalFiles,
        totalSkills: ctx.totalSkills,
        skills: ctx.skills.map(s => s.name),
        manifest: ctx.manifest?.name ?? null,
      }),
      findings: JSON.stringify(ctx.agentFindings),
      scoreTotal: riskScore,
      scoreRiskLevel: riskLevel,
      markdown,
    })

    // ===== Phase 7: Completed =====
    await store.completeAudit(auditId, riskScore, riskLevel, ctx.agentFindings.length)
    await store.updateProgress(auditId, 'completed', 100)
    await store.addLog(auditId, 'reporting', 'info', `审计完成! 风险评分: ${riskScore} (${riskLevel})`)

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await store.setAuditError(auditId, errMsg.slice(0, 500))
    await store.addLog(auditId, 'failed', 'error', `审计失败: ${errMsg.slice(0, 200)}`)
  } finally {
    // 清理临时目录
    try {
      await fs.rm(extractDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
}

// ===== 辅助函数 =====

/** 扫描项目文件 */
async function scanProject(rootDir: string): Promise<{ projectFiles: ProjectFile[]; totalFiles: number }> {
  const projectFiles: ProjectFile[] = []
  let totalFiles = 0

  async function walk(dir: string) {
    if (projectFiles.length >= MAX_FILES) return
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (projectFiles.length >= MAX_FILES) break
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(fullPath)
      } else if (entry.isFile()) {
        totalFiles++
        const ext = path.extname(entry.name).toLowerCase()
        const language = SKILLS_EXTENSIONS[ext] ?? 'unknown'
        const stat = await fs.stat(fullPath)
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/')
        projectFiles.push({ path: relativePath, language, size: stat.size })
      }
    }
  }

  await walk(rootDir)
  return { projectFiles, totalFiles }
}

/** 解析Skills结构 */
async function parseSkills(projectFiles: ProjectFile[], extractDir: string): Promise<{
  skills: ParsedSkill[]
  manifest: SkillManifest | null
}> {
  const skills: ParsedSkill[] = []
  let manifest: SkillManifest | null = null

  // 查找SKILL.MD文件
  const skillMdFiles = projectFiles.filter(f =>
    f.path.toLowerCase().includes('skill.md') || f.path.toLowerCase().includes('skill.md')
  )

  if (skillMdFiles.length > 0) {
    try {
      const content = await fs.readFile(path.join(extractDir, skillMdFiles[0].path), 'utf-8')
      manifest = parseSkillMd(content)
    } catch { /* ignore */ }
  }

  // 查找manifest.json
  const manifestJsonFiles = projectFiles.filter(f => f.path.endsWith('manifest.json'))
  if (!manifest && manifestJsonFiles.length > 0) {
    try {
      const content = await fs.readFile(path.join(extractDir, manifestJsonFiles[0].path), 'utf-8')
      const json = JSON.parse(content)
      manifest = {
        name: json.name ?? json.skillName ?? 'Unknown',
        version: json.version,
        description: json.description,
        triggers: (json.triggers ?? []).map((t: Record<string, string>) => ({
          type: t.type ?? t.triggerType ?? 'unknown',
          pattern: t.pattern ?? t.value ?? '',
        })),
        entryPoint: json.entryPoint ?? json.main ?? json.entry,
        permissions: json.permissions ?? json.capabilities,
        dependencies: json.dependencies ? Object.keys(json.dependencies) : [],
      }
    } catch { /* ignore */ }
  }

  // 按目录分组识别Skills
  const dirMap = new Map<string, ProjectFile[]>()
  for (const file of projectFiles) {
    const dir = path.dirname(file.path)
    if (!dirMap.has(dir)) dirMap.set(dir, [])
    dirMap.get(dir)!.push(file)
  }

  for (const [dir, files] of dirMap) {
    const name = dir.split('/').pop() ?? dir
    // 只识别包含代码文件的目录
    const codeFiles = files.filter(f => ['.py', '.js', '.ts', '.sh'].some(e => f.path.endsWith(e)))
    if (codeFiles.length > 0 || name.toLowerCase().includes('skill')) {
      const entryFile = codeFiles.find(f =>
        ['main.py', 'index.js', 'index.ts', 'app.py', 'handler.py', 'main.js'].some(e => f.path.endsWith(e))
      )
      skills.push({
        name,
        description: undefined,
        triggers: manifest?.triggers?.map(t => t.pattern),
        entryFile: entryFile?.path,
        files,
      })
    }
  }

  // 如果没有识别到任何Skill，把整个包作为一个Skill
  if (skills.length === 0) {
    skills.push({
      name: 'root',
      files: projectFiles,
    })
  }

  return { skills, manifest }
}

/** 解析SKILL.MD */
function parseSkillMd(content: string): SkillManifest {
  const nameMatch = content.match(/^#\s+(.+)$/m)
  const descMatch = content.match(/^##\s+(?:Description|描述)\s*\n+(.+?)(?=\n##|\n---|\n```|$)/ims)
  const triggerSection = content.match(/^##\s+(?:Triggers|触发器|Trigger)\s*\n+(.+?)(?=\n##|\n---|\n```|$)/ims)

  const triggers: Array<{ type: string; pattern: string }> = []
  if (triggerSection) {
    const lines = triggerSection[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(?:\[(\w+)\]\s*)?(.+)/)
      if (m) {
        triggers.push({ type: m[1] ?? 'keyword', pattern: m[2].trim() })
      }
    }
  }

  return {
    name: nameMatch?.[1]?.trim() ?? 'Unknown',
    description: descMatch?.[1]?.trim(),
    triggers,
  }
}

/** 去重发现项 */
function dedupFindings(findings: AgentFinding[]): AgentFinding[] {
  const result: AgentFinding[] = []
  const severityOrder = ['info', 'low', 'medium', 'high', 'critical']

  for (const f of findings) {
    const dupIdx = result.findIndex(r =>
      r.filePath === f.filePath &&
      r.riskCategory === f.riskCategory &&
      r.lineStart !== undefined && f.lineStart !== undefined &&
      Math.abs(r.lineStart - f.lineStart) <= 3
    )
    if (dupIdx === -1) {
      result.push(f)
    } else {
      const existing = result[dupIdx]
      if (severityOrder.indexOf(f.severity) > severityOrder.indexOf(existing.severity)) {
        result[dupIdx] = f
      }
    }
  }
  return result
}

/** 生成Markdown报告 */
function generateMarkdownReport(ctx: PipelineContext, riskScore: number, riskLevel: string): string {
  const severityEmoji: Record<string, string> = {
    critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪'
  }

  const lines: string[] = [
    `# Skills 安全审计报告`,
    ``,
    `**项目**: ${ctx.manifest?.name ?? 'Unknown'}`,
    `**审计时间**: ${new Date().toLocaleString('zh-CN')}`,
    `**风险评分**: ${riskScore} (${riskLevel})`,
    `**发现项**: ${ctx.agentFindings.length}`,
    `**Skills数量**: ${ctx.totalSkills}`,
    `**文件数量**: ${ctx.totalFiles}`,
    `**审计模型**: ${ctx.modelConfig.model ?? 'default'}`,
    ``,
    `---`,
    ``,
    `## 发现项`,
    ``,
  ]

  // 按严重度排序
  const sorted = [...ctx.agentFindings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
  })

  for (const f of sorted) {
    lines.push(`### ${severityEmoji[f.severity] ?? ''} [${f.severity.toUpperCase()}] ${f.title}`)
    lines.push(``)
    lines.push(`- **风险类别**: ${f.riskCategory}`)
    lines.push(`- **文件**: ${f.filePath}${f.lineStart ? `:${f.lineStart}` : ''}`)
    lines.push(`- **置信度**: ${f.confidence}`)
    if (f.cweId) lines.push(`- **CWE**: ${f.cweId} - ${f.cweName ?? ''}`)
    lines.push(``)
    lines.push(`**描述**: ${f.description}`)
    if (f.vulnerableCode) {
      lines.push(``)
      lines.push(`\`\`\``)
      lines.push(f.vulnerableCode)
      lines.push(`\`\`\``)
    }
    if (f.remediation) {
      lines.push(``)
      lines.push(`**修复建议**: ${f.remediation}`)
    }
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  }

  return lines.join('\n')
}