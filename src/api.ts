import type {
  EvaluationListItem,
  EvaluationReport,
  EvaluatorSettings,
  CodeAuditModelSettings,
  ModelTabSettings,
  LibraryType,
  McpScanListItem,
  McpScanReport,
  Overview,
  PromptCollection,
  PromptItem,
  Provider,
  CodeAuditListItem,
  CodeAuditDetail,
  CodeAuditItem,
  CodeAuditSlice,
  VulnKbEntry,
  SkillsAuditListItem,
  SkillsAuditDetail,
  SkillsAuditItem,
} from './types'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export function getOverview() {
  return apiFetch<Overview>('/api/overview')
}

export function listEvaluations(query: string, standard: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('query', query.trim())
  if (standard && standard !== 'all') params.set('standard', standard)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiFetch<{
    items: EvaluationListItem[]
    total: number
    stats: { total: number; completed: number; failed: number; avgPassRate: number }
    typeCounts: Record<string, number>
  }>(`/api/evaluations?${params.toString()}`)
}

export function createEvaluation(input: {
  name: string
  standard: Exclude<LibraryType, 'all'>
  collectionId?: string
  count: number
  target: { provider: Provider; baseUrl: string; apiKey?: string; model?: string; timeoutMs?: number }
}) {
  return apiFetch<{ id: string }>('/api/evaluations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getEvaluationReport(id: string) {
  return apiFetch<EvaluationReport>(`/api/evaluations/${encodeURIComponent(id)}`)
}

export function getEvaluationReportUrl(id: string, format: 'pdf' | 'html' | 'md') {
  return `/api/evaluations/${encodeURIComponent(id)}/report?format=${format}`
}

export function deleteEvaluation(id: string) {
  return apiFetch<{ ok: true }>(`/api/evaluations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function bulkDeleteEvaluations(ids: string[]) {
  return apiFetch<{ ok: true }>('/api/evaluations/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

// ===== Prompt Collections API =====

export function listCollections(library?: string) {
  const params = new URLSearchParams()
  if (library && library !== 'all') params.set('library', library)
  return apiFetch<PromptCollection[]>(`/api/prompt-collections?${params.toString()}`)
}

export function createCollection(input: { name: string; library: Exclude<LibraryType, 'all'>; description?: string }) {
  return apiFetch<{ id: string }>('/api/prompt-collections', { method: 'POST', body: JSON.stringify(input) })
}

export function updateCollection(id: string, input: { name?: string; description?: string }) {
  return apiFetch<{ ok: true }>(`/api/prompt-collections/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteCollection(id: string, cascade = false) {
  return apiFetch<{ ok: true }>(`/api/prompt-collections/${encodeURIComponent(id)}?cascade=${cascade}`, { method: 'DELETE' })
}

export function getPromptCounts() {
  return apiFetch<Record<string, number>>('/api/prompts/count')
}

export function listPrompts(library: LibraryType, query: string, page: number, pageSize: number, collectionId?: string) {
  const params = new URLSearchParams()
  params.set('library', library)
  if (query.trim()) params.set('query', query.trim())
  if (collectionId) params.set('collectionId', collectionId)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiFetch<{ items: PromptItem[]; total: number }>(`/api/prompts?${params.toString()}`)
}

export function createPrompt(input: { library: Exclude<LibraryType, 'all'>; riskType: string; prompt: string; collectionId?: string }) {
  return apiFetch<{ id: string }>('/api/prompts', { method: 'POST', body: JSON.stringify(input) })
}

export function deletePrompt(id: string) {
  return apiFetch<{ ok: true }>(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function bulkDeletePrompts(ids: string[]) {
  return apiFetch<{ ok: true }>('/api/prompts/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function importPrompts(input: { library: Exclude<LibraryType, 'all'>; csv: string; collectionId?: string }) {
  return apiFetch<{ inserted: number }>('/api/prompts/import', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getEvaluatorSettings() {
  return apiFetch<EvaluatorSettings>('/api/settings/evaluator')
}

export function saveEvaluatorSettings(settings: EvaluatorSettings) {
  return apiFetch<{ ok: true }>('/api/settings/evaluator', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testModelConnection(input: { provider: Provider; baseUrl: string; apiKey?: string; model?: string }) {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>('/api/models/test', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function testEvaluatorConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/evaluator/test',
  )
}

// ===== 代码安全审计模型设置 API =====

export function getCodeAuditSettings() {
  return apiFetch<CodeAuditModelSettings>('/api/settings/code-audit')
}

export function saveCodeAuditSettings(settings: CodeAuditModelSettings) {
  return apiFetch<{ ok: true }>('/api/settings/code-audit', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testCodeAuditConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/code-audit/test',
  )
}

// ===== 模型评估模型设置 API =====

export function getModelEvalSettings() {
  return apiFetch<ModelTabSettings>('/api/settings/model-eval')
}

export function saveModelEvalSettings(settings: ModelTabSettings) {
  return apiFetch<{ ok: true }>('/api/settings/model-eval', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testModelEvalConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/model-eval/test',
  )
}

// ===== MCP 评估模型设置 API =====

export function getMcpEvalSettings() {
  return apiFetch<ModelTabSettings>('/api/settings/mcp-eval')
}

export function saveMcpEvalSettings(settings: ModelTabSettings) {
  return apiFetch<{ ok: true }>('/api/settings/mcp-eval', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testMcpEvalConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/mcp-eval/test',
  )
}

// ===== Skills 审计模型设置 API =====

export function getSkillsAuditSettings() {
  return apiFetch<ModelTabSettings>('/api/settings/skills-audit')
}

export function saveSkillsAuditSettings(settings: ModelTabSettings) {
  return apiFetch<{ ok: true }>('/api/settings/skills-audit', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testSkillsAuditConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/skills-audit/test',
  )
}

export function testEvaluationConnections(id: string) {
  return apiFetch<{
    target: { ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }
    evaluator: { ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }
  }>(`/api/evaluations/${encodeURIComponent(id)}/conn-test`)
}

// MCP 扫描 API
export function listMcpScans(query = '', page = 1, pageSize = 10) {
  return apiFetch<{ items: McpScanListItem[]; total: number }>(`/api/mcp-scans?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`)
}

export async function uploadMcpScan(file: File, options?: { name?: string; model?: string; apiKey?: string; baseUrl?: string; provider?: string; timeoutMs?: number }) {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.name) formData.append('name', options.name)
  if (options?.model) formData.append('model', options.model)
  if (options?.apiKey) formData.append('apiKey', options.apiKey)
  if (options?.baseUrl) formData.append('baseUrl', options.baseUrl)
  if (options?.provider) formData.append('provider', options.provider)

  const res = await fetch('/api/mcp-scans/upload', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { scanId: string }
}

export function getMcpScanReport(scanId: string) {
  return apiFetch<McpScanReport>(`/api/mcp-scans/${encodeURIComponent(scanId)}/report`)
}

export function getMcpScanReportUrl(scanId: string, format: 'pdf' | 'html' | 'md') {
  return `/api/mcp-scans/${encodeURIComponent(scanId)}/report?format=${format}`
}

export function getMcpScanStatus(scanId: string) {
  return apiFetch<McpScanListItem>(`/api/mcp-scans/${encodeURIComponent(scanId)}`)
}

export function deleteMcpScan(scanId: string) {
  return apiFetch<{ ok: true }>(`/api/mcp-scans/${encodeURIComponent(scanId)}`, { method: 'DELETE' })
}

export function startMcpScan(scanId: string, fileId: string) {
  return apiFetch<{ ok: true }>(`/api/mcp-scans/${encodeURIComponent(scanId)}/start`, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  })
}

// ===== CodeAudit API =====

export async function uploadCodeAuditFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/code-audit/upload', { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { fileId: string; filename: string; size: number }
}

export function createCodeAudit(input: {
  name: string
  sourceType: 'zip' | 'git'
  fileId?: string
  sourceUrl?: string
  language?: string
  provider?: Provider
  baseUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
}) {
  return apiFetch<{ id: number; name: string; status: string }>('/api/code-audit', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listCodeAudits(page = 1, pageSize = 10, options?: { query?: string; language?: string }) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (options?.query) params.set('query', options.query)
  if (options?.language && options.language !== 'all') params.set('language', options.language)
  return apiFetch<{ items: CodeAuditListItem[]; total: number }>(
    `/api/code-audit?${params.toString()}`,
  )
}

export function getCodeAuditDetail(id: number) {
  return apiFetch<CodeAuditDetail>(`/api/code-audit/${id}`)
}

export function getCodeAuditItems(id: number, options?: { severity?: string; confidence?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams()
  if (options?.severity && options.severity !== 'all') params.set('severity', options.severity)
  if (options?.confidence && options.confidence !== 'all') params.set('confidence', options.confidence)
  if (options?.page) params.set('page', String(options.page))
  if (options?.pageSize) params.set('pageSize', String(options.pageSize))
  return apiFetch<{ items: CodeAuditItem[]; total: number; page: number; pageSize: number }>(
    `/api/code-audit/${id}/items?${params.toString()}`,
  )
}

export function getCodeAuditSlices(id: number, filePath?: string) {
  const params = filePath ? `?filePath=${encodeURIComponent(filePath)}` : ''
  return apiFetch<{ items: CodeAuditSlice[] }>(`/api/code-audit/${id}/slices${params}`)
}

export function updateCodeAuditItemStatus(itemId: number, status: 'confirmed' | 'false_positive' | 'pending') {
  return apiFetch<{ ok: true }>(`/api/code-audit/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteCodeAudit(id: number) {
  return apiFetch<{ ok: true }>(`/api/code-audit/${id}`, { method: 'DELETE' })
}

export function getCodeAuditReport(id: number, format: 'json' | 'html' | 'pdf' = 'json') {
  if (format === 'pdf') {
    window.open(`/api/code-audit/${id}/report?format=pdf`, '_blank')
    return
  }
  if (format === 'html') {
    return apiFetch<string>(`/api/code-audit/${id}/report?format=html`)
  }
  return apiFetch<{
    audit: {
      id: number; name: string; status: string; language: string | null
      riskScore: number; totalFiles: number; totalSlices: number; findingsCount: number
      severityCount: Record<string, number>; cweCount: Record<string, number>
      createdAt: number; completedAt: number | null
    }
    items: CodeAuditItem[]
  }>(`/api/code-audit/${id}/report`)
}

export function listVulnKb() {
  return apiFetch<VulnKbEntry[]>('/api/code-audit/kb')
}

export function createVulnKb(input: {
  cweId: string; cweName: string; description?: string; riskPattern?: string
  fixPattern?: string; severity?: string; tags?: string; examples?: string
}) {
  return apiFetch<{ ok: true }>('/api/code-audit/kb', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteVulnKb(cweId: string) {
  return apiFetch<{ ok: true }>(`/api/code-audit/kb/${encodeURIComponent(cweId)}`, { method: 'DELETE' })
}

// ===== SkillsAudit API =====

export async function uploadSkillsAuditFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/skills-audit/upload', { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { fileId: string; filename: string; size: number }
}

export function createSkillsAudit(input: {
  name: string
  fileId: string
  provider?: Provider
  baseUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
}) {
  return apiFetch<{ id: number; name: string; status: string }>('/api/skills-audit', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listSkillsAudits(page = 1, pageSize = 10, options?: { query?: string; riskLevel?: string }) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (options?.query) params.set('query', options.query)
  if (options?.riskLevel && options.riskLevel !== 'all') params.set('riskLevel', options.riskLevel)
  return apiFetch<{ items: SkillsAuditListItem[]; total: number }>(
    `/api/skills-audit?${params.toString()}`,
  )
}

export function getSkillsAuditDetail(id: number) {
  return apiFetch<SkillsAuditDetail>(`/api/skills-audit/${id}`)
}

export function getSkillsAuditItems(id: number, options?: { riskCategory?: string; severity?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams()
  if (options?.riskCategory && options.riskCategory !== 'all') params.set('riskCategory', options.riskCategory)
  if (options?.severity && options.severity !== 'all') params.set('severity', options.severity)
  if (options?.page) params.set('page', String(options.page))
  if (options?.pageSize) params.set('pageSize', String(options.pageSize))
  return apiFetch<{ items: SkillsAuditItem[]; total: number; page: number; pageSize: number }>(
    `/api/skills-audit/${id}/items?${params.toString()}`,
  )
}

export function updateSkillsAuditItemStatus(itemId: number, status: 'confirmed' | 'false_positive' | 'pending') {
  return apiFetch<{ ok: true }>(`/api/skills-audit/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function getSkillsAuditReport(id: number, format: 'json' | 'html' | 'md' | 'pdf' = 'json') {
  if (format === 'pdf') {
    window.open(`/api/skills-audit/${id}/report?format=pdf`, '_blank')
    return
  }
  if (format === 'html') {
    return apiFetch<string>(`/api/skills-audit/${id}/report?format=html`)
  }
  if (format === 'md') {
    return apiFetch<string>(`/api/skills-audit/${id}/report?format=md`)
  }
  return apiFetch<{
    auditId: number
    generatedAt: number
    projectInfo: { totalFiles: number; totalSkills: number; skills: string[]; manifest: string | null }
    findings: SkillsAuditItem[]
    scoreTotal: number
    scoreRiskLevel: string
  }>(`/api/skills-audit/${id}/report?format=${format}`)
}

export function deleteSkillsAudit(id: number) {
  return apiFetch<{ ok: true }>(`/api/skills-audit/${id}`, { method: 'DELETE' })
}
