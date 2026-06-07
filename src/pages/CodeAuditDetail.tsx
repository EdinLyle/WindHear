import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCodeAuditDetail, getCodeAuditItems, getCodeAuditSlices, updateCodeAuditItemStatus } from '../api'
import type { AuditItemStatus, AuditSeverity, CodeAuditDetail as AuditDetailType, CodeAuditItem, CodeAuditSlice } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const severityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#6b7280',
}

const severityLabels: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  parsing: '解析中',
  slicing: '切片中',
  auditing: '审计中',
  aggregating: '聚合中',
  completed: '已完成',
  failed: '失败',
}

type FileNode = {
  name: string
  path: string
  isDir: boolean
  children: FileNode[]
  hasVulnerability: boolean
  maxSeverity: AuditSeverity | null
}

function buildFileTree(files: string[], vulnerableFiles: Map<string, AuditSeverity>): FileNode {
  const root: FileNode = { name: '', path: '', isDir: true, children: [], hasVulnerability: false, maxSeverity: null }

  for (const filePath of files) {
    const parts = filePath.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
      const isDir = i < parts.length - 1
      const existing = current.children.find(c => c.name === parts[i])

      if (existing) {
        current = existing
      } else {
        const node: FileNode = {
          name: parts[i],
          path: currentPath,
          isDir,
          children: [],
          hasVulnerability: isDir ? false : vulnerableFiles.has(currentPath),
          maxSeverity: isDir ? null : (vulnerableFiles.get(currentPath) ?? null),
        }
        current.children.push(node)
        current = node
      }
    }
  }

  // Sort: dirs first, then files, alphabetically
  const sortNodes = (node: FileNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const child of node.children) sortNodes(child)
  }
  sortNodes(root)

  return root
}

function FileTreeNode({ node, depth, selectedFile, onSelect }: {
  node: FileNode
  depth: number
  selectedFile: string
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (node.isDir) {
    return (
      <div>
        <div
          style={{
            paddingLeft: depth * 20 + 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            color: node.hasVulnerability ? '#dc2626' : 'var(--foreground)',
            background: 'transparent',
            transition: 'background 0.15s',
          }}
          onClick={() => setExpanded(!expanded)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 9, width: 12, textAlign: 'center', color: '#9ca3af', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
          <span style={{ flexShrink: 0 }}>{expanded ? '📂' : '📁'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        </div>
        {expanded && (
          <div style={{ position: 'relative' }}>
            {depth >= 0 && (
              <div style={{
                position: 'absolute',
                left: depth * 20 + 14,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--border)',
              }} />
            )}
            {node.children.map((child) => (
              <FileTreeNode key={child.path} node={child} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = selectedFile === node.path
  const sevDot = node.maxSeverity === 'critical' || node.maxSeverity === 'high'
    ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: severityColors[node.maxSeverity!], flexShrink: 0 }} />
    : node.maxSeverity === 'medium'
      ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
      : <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />

  return (
    <div
      style={{
        paddingLeft: depth * 20 + 12,
        cursor: 'pointer',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 13,
        background: isSelected ? 'rgba(9,105,218,0.08)' : 'transparent',
        fontWeight: isSelected ? 600 : 400,
        color: node.hasVulnerability ? severityColors[node.maxSeverity!] : 'var(--foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.15s',
      }}
      onClick={() => onSelect(node.path)}
      onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
      title={node.path}
    >
      {sevDot}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>📄</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
    </div>
  )
}

function CodeViewer({ content, highlights, onLineClick }: {
  content: string
  language: string
  highlights: Array<{ lineStart: number; lineEnd: number; severity: AuditSeverity; findingId: number }>
  onLineClick: (line: number) => void
}) {
  const lines = content.split('\n')

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, overflow: 'auto', flex: 1 }}>
      {lines.map((line, idx) => {
        const lineNum = idx + 1
        const highlight = highlights.find(h => lineNum >= h.lineStart && lineNum <= h.lineEnd)
        const bgColor = highlight
          ? highlight.severity === 'critical' ? 'rgba(220,38,38,0.08)'
          : highlight.severity === 'high' ? 'rgba(234,88,12,0.08)'
          : highlight.severity === 'medium' ? 'rgba(245,158,11,0.08)'
          : 'rgba(59,130,246,0.06)'
          : 'transparent'

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              background: bgColor,
              cursor: highlight ? 'pointer' : 'default',
              borderLeft: highlight ? `3px solid ${severityColors[highlight.severity]}` : '3px solid transparent',
            }}
            onClick={() => highlight && onLineClick(lineNum)}
          >
            <span style={{ width: 48, textAlign: 'right', paddingRight: 12, color: '#9ca3af', userSelect: 'none', flexShrink: 0 }}>{lineNum}</span>
            <span style={{ whiteSpace: 'pre', flex: 1 }}>{line}</span>
          </div>
        )
      })}
    </div>
  )
}

type FindingTab = 'overview' | 'poc' | 'reproduce' | 'fix'

function FindingDetail({ item, onStatusChange }: { item: CodeAuditItem; onStatusChange: (id: number, status: AuditItemStatus) => void }) {
  const [tab, setTab] = useState<FindingTab>('overview')

  const hasPoc = !!(item.pocDescription || item.pocCode)
  const hasSteps = !!item.reproduceSteps
  const hasFixCode = !!item.fixCode

  const tabs: Array<{ key: FindingTab; label: string; disabled: boolean }> = [
    { key: 'overview', label: '概览', disabled: false },
    { key: 'poc', label: 'PoC', disabled: !hasPoc },
    { key: 'reproduce', label: '复现步骤', disabled: !hasSteps },
    { key: 'fix', label: '修复代码', disabled: !hasFixCode },
  ]

  return (
    <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 4 }} onClick={e => e.stopPropagation()}>
      {/* Tab 栏 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              border: 'none',
              background: 'transparent',
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              color: t.disabled ? '#d1d5db' : tab === t.key ? '#0969da' : '#6b7280',
              fontWeight: tab === t.key ? 600 : 400,
              borderBottom: tab === t.key ? '2px solid #0969da' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div style={{ padding: '0 4px' }}>
        {tab === 'overview' && (
          <>
            {item.description && <div style={{ marginBottom: 6, fontSize: 12 }}>{item.description}</div>}
            {item.vulnerableCode && (
              <pre style={{ fontSize: 11, background: '#1e293b', color: '#e2e8f0', padding: 8, borderRadius: 4, overflow: 'auto', margin: '6px 0' }}>
                {item.vulnerableCode}
              </pre>
            )}
            {item.fixSuggestion && !item.fixCode && (
              <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0fdf4', borderRadius: 4, border: '1px solid #bbf7d0', fontSize: 11 }}>
                <strong>修复建议：</strong>{item.fixSuggestion}
              </div>
            )}
            {item.dataFlow && (
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                数据流: {item.dataFlow}
              </div>
            )}
          </>
        )}

        {tab === 'poc' && hasPoc && (
          <>
            {item.pocDescription && (
              <div style={{ fontSize: 12, marginBottom: 8, color: '#374151' }}>{item.pocDescription}</div>
            )}
            {item.pocCode && (
              <pre style={{ fontSize: 11, background: '#1e293b', color: '#e2e8f0', padding: 8, borderRadius: 4, overflow: 'auto', margin: '4px 0' }}>
                {item.pocCode}
              </pre>
            )}
          </>
        )}

        {tab === 'reproduce' && hasSteps && (
          <div style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-line', color: '#374151' }}>
            {item.reproduceSteps}
          </div>
        )}

        {tab === 'fix' && hasFixCode && (
          <>
            <pre style={{ fontSize: 11, background: '#1e293b', color: '#22c55e', padding: 8, borderRadius: 4, overflow: 'auto', margin: '4px 0' }}>
              {item.fixCode}
            </pre>
            {item.fixSuggestion && (
              <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0fdf4', borderRadius: 4, border: '1px solid #bbf7d0', fontSize: 11 }}>
                <strong>修复建议：</strong>{item.fixSuggestion}
              </div>
            )}
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="btn sm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); void onStatusChange(item.id, 'confirmed') }}>
          确认漏洞
        </button>
        <button className="btn outline sm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); void onStatusChange(item.id, 'false_positive') }}>
          标记误报
        </button>
      </div>
    </div>
  )
}

export function CodeAuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auditId = Number(id)

  const [audit, setAudit] = useState<AuditDetailType | null>(null)
  const [items, setItems] = useState<CodeAuditItem[]>([])
  const [slices, setSlices] = useState<CodeAuditSlice[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<CodeAuditItem | null>(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isRunning = audit ? !['completed', 'failed'].includes(audit.status) : false

  async function loadData() {
    try {
      const [auditData, itemsData, slicesData] = await Promise.all([
        getCodeAuditDetail(auditId),
        getCodeAuditItems(auditId, { severity: severityFilter !== 'all' ? severityFilter : undefined }),
        getCodeAuditSlices(auditId),
      ])
      setAudit(auditData)
      setItems(itemsData.items)
      setSlices(slicesData.items)
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, severityFilter])

  // 轮询：运行中时每 3 秒刷新
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => void loadData(), 3000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, auditId])

  // 漏洞文件映射
  const vulnerableFiles = useMemo(() => {
    const map = new Map<string, AuditSeverity>()
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    for (const item of items) {
      if (item.status === 'false_positive') continue
      const existing = map.get(item.filePath)
      if (!existing || severityOrder[item.severity] < severityOrder[existing]) {
        map.set(item.filePath, item.severity)
      }
    }
    return map
  }, [items])

  // 文件树
  const fileTree = useMemo(() => {
    const allFiles = [...new Set(slices.map(s => s.filePath))]
    return buildFileTree(allFiles, vulnerableFiles)
  }, [slices, vulnerableFiles])

  // 当前文件内容
  const currentFileContent = useMemo(() => {
    if (!selectedFile) return ''
    const fileSlices = slices.filter(s => s.filePath === selectedFile).sort((a, b) => a.lineStart - b.lineStart)
    return fileSlices.map(s => s.content).join('\n')
  }, [selectedFile, slices])

  // 当前文件高亮
  const currentHighlights = useMemo(() => {
    if (!selectedFile) return []
    return items
      .filter(i => i.filePath === selectedFile && i.status !== 'false_positive' && i.lineStart)
      .map(i => ({
        lineStart: i.lineStart!,
        lineEnd: i.lineEnd || i.lineStart!,
        severity: i.severity,
        findingId: i.id,
      }))
  }, [selectedFile, items])

  // 当前文件漏洞
  const currentFileItems = useMemo(() => {
    if (!selectedFile) return items.filter(i => i.status !== 'false_positive')
    return items.filter(i => i.filePath === selectedFile && i.status !== 'false_positive')
  }, [selectedFile, items])

  // 按严重度分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, CodeAuditItem[]> = { critical: [], high: [], medium: [], low: [], info: [] }
    for (const item of currentFileItems) {
      if (groups[item.severity]) groups[item.severity].push(item)
    }
    return groups
  }, [currentFileItems])

  async function onStatusChange(itemId: number, status: AuditItemStatus) {
    await updateCodeAuditItemStatus(itemId, status)
    void loadData()
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb items={[{ label: '代码安全审计', path: '/code-audit' }, { label: '加载中...' }]} />
        <section className="card"><div style={{ padding: 32, textAlign: 'center', color: '#7f8c8d' }}>加载中...</div></section>
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div>
        <Breadcrumb items={[{ label: '代码安全审计', path: '/code-audit' }, { label: '错误' }]} />
        <section className="card"><div style={{ padding: 32, textAlign: 'center', color: 'var(--destructive)' }}>{error || '未找到审计记录'}</div></section>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '代码安全审计', path: '/code-audit' }, { label: audit.name }]} />

      {/* 顶部概览 */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{audit.name}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              ID: {audit.id} | 状态: {statusLabels[audit.status] || audit.status}
              {audit.language && ` | 语言: ${audit.language}`}
              {audit.totalFiles > 0 && ` | 文件: ${audit.totalFiles}`}
              {audit.totalSlices > 0 && ` | 切片: ${audit.totalSlices}`}
              {audit.findingsCount > 0 && ` | 漏洞: ${audit.findingsCount}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isRunning && (
              <div className="muted" style={{ fontSize: 12 }}>
                {audit.logs.length > 0 && audit.logs[audit.logs.length - 1].message}
              </div>
            )}
            {audit.status === 'completed' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: audit.riskScore >= 50 ? '#dc2626' : audit.riskScore >= 25 ? '#f59e0b' : '#16a34a' }}>
                  风险评分: {audit.riskScore}/100
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={`/api/code-audit/${audit.id}/report?format=pdf`} target="_blank" rel="noopener" className="btn outline sm">导出 PDF</a>
                  <a href={`/api/code-audit/${audit.id}/report?format=html`} target="_blank" rel="noopener" className="btn outline sm">导出 HTML</a>
                  <a href={`/api/code-audit/${audit.id}/report?format=md`} target="_blank" rel="noopener" className="btn outline sm">导出 MD</a>
                  <a href={`/api/code-audit/${audit.id}/report?format=json`} target="_blank" rel="noopener" className="btn outline sm">导出 JSON</a>
                </div>
              </>
            )}
            <Link to="/code-audit" className="btn outline sm">返回列表</Link>
          </div>
        </div>
        {audit.errorMessage && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 4, color: '#dc2626', fontSize: 13 }}>
            {audit.errorMessage}
          </div>
        )}
      </section>

      {/* 三栏布局 */}
      {audit.status === 'completed' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 0, height: 'calc(100vh - 220px)', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* 左栏：文件树 */}
          <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto', padding: '8px 0' }}>
            <div style={{ padding: '4px 12px 8px', fontWeight: 600, fontSize: 13, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
              项目文件
            </div>
            {fileTree.children.map((child) => (
              <FileTreeNode key={child.path} node={child} depth={0} selectedFile={selectedFile || ''} onSelect={setSelectedFile} />
            ))}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', marginTop: 8, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#dc2626', marginRight: 3 }} />高危</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', marginRight: 3 }} />中危</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', marginRight: 3 }} />安全</span>
            </div>
          </div>

          {/* 中栏：代码查看器 */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>
              {selectedFile || '请选择文件'}
            </div>
            {selectedFile ? (
              <CodeViewer
                content={currentFileContent}
                language={slices.find(s => s.filePath === selectedFile)?.language || 'text'}
                highlights={currentHighlights}
                onLineClick={() => {}}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                点击左侧文件查看代码
              </div>
            )}
          </div>

          {/* 右栏：漏洞面板 */}
          <div style={{ borderLeft: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>漏洞面板</span>
              <select className="select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{ fontSize: 12, padding: '2px 6px', height: 26 }}>
                <option value="all">全部等级</option>
                <option value="critical">严重</option>
                <option value="high">高危</option>
                <option value="medium">中危</option>
                <option value="low">低危</option>
              </select>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
                const group = groupedItems[sev]
                if (!group || group.length === 0) return null
                return (
                  <div key={sev} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: severityColors[sev], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: severityColors[sev], display: 'inline-block' }} />
                      {severityLabels[sev]} ({group.length})
                    </div>
                    {group.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '8px 10px',
                          marginBottom: 6,
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: selectedFinding?.id === item.id ? 'rgba(9,105,218,0.06)' : '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                        onClick={() => {
                          setSelectedFinding(item)
                          setSelectedFile(item.filePath)
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {item.cweId && <span style={{ color: severityColors[sev], marginRight: 4 }}>{item.cweId}</span>}
                          {item.title}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {item.filePath}:{item.lineStart}
                        </div>
                        {item === selectedFinding && (
                          <FindingDetail item={item} onStatusChange={onStatusChange} />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
              {currentFileItems.length === 0 && (
                <div className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>
                  {selectedFile ? '当前文件无漏洞发现' : '共 ' + items.filter(i => i.status !== 'false_positive').length + ' 个漏洞'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isRunning ? (
        <section className="card" style={{ padding: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              审计进行中: {statusLabels[audit.status]}
            </div>
            <div className="muted" style={{ marginBottom: 16 }}>
              {audit.logs.length > 0 && audit.logs[audit.logs.length - 1].message}
            </div>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 3,
                  transition: 'width 0.5s',
                  width: audit.status === 'parsing' ? '15%' : audit.status === 'slicing' ? '35%' : audit.status === 'auditing' ? '65%' : '85%',
                }} />
              </div>
            </div>
          </div>
          {/* 审计日志 */}
          <div style={{ marginTop: 24, maxHeight: 300, overflow: 'auto', background: '#1e293b', borderRadius: 6, padding: 12 }}>
            {audit.logs.map((log, idx) => (
              <div key={idx} style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>[{new Date(log.createdAt * 1000).toLocaleTimeString('zh-CN')}]</span>{' '}
                <span style={{ color: log.stage.includes('error') || log.stage.includes('fail') ? '#f87171' : '#38bdf8' }}>[{log.stage}]</span>{' '}
                {log.message}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ color: 'var(--destructive)', fontSize: 16, fontWeight: 600 }}>审计失败</div>
          <div className="muted" style={{ marginTop: 8 }}>{audit.errorMessage}</div>
          {audit.logs.length > 0 && (
            <div style={{ marginTop: 16, maxHeight: 200, overflow: 'auto', background: '#1e293b', borderRadius: 6, padding: 12, textAlign: 'left' }}>
              {audit.logs.map((log, idx) => (
                <div key={idx} style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                  <span style={{ color: '#64748b' }}>[{new Date(log.createdAt * 1000).toLocaleTimeString('zh-CN')}]</span> {log.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}