import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSkillsAuditDetail, getSkillsAuditItems, getSkillsAuditReport, updateSkillsAuditItemStatus } from '../api'
import type { AuditItemStatus, SkillsAuditDetail as AuditDetailType, SkillsAuditItem } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'
import TokenReceiptModal from '../components/TokenReceiptModal'

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

const confidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const riskCategoryLabels: Record<string, string> = {
  dangerous_command: '危险命令',
  reverse_shell: '反弹Shell',
  hardcoded_secrets: '硬编码密钥',
  prompt_injection: '提示注入',
  data_exfiltration: '数据外泄',
  sensitive_file_access: '敏感文件访问',
  dynamic_code_execution: '动态代码执行',
  privilege_escalation: '权限提升',
  weak_crypto: '弱加密',
  command_injection: '命令注入',
  supply_chain_attack: '供应链攻击',
  unauthorized_tool_use: '未授权工具使用',
  trigger_hijacking: '触发器劫持',
  skill_md_mismatch: 'SKILL.MD不匹配',
  code_quality: '代码质量',
  bytecode_tampering: '字节码篡改',
  obfuscation: '混淆',
  resource_abuse: '资源滥用',
  unicode_steganography: 'Unicode隐写',
  social_engineering: '社会工程学',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  unpacking: '解压中',
  analyzing: '分析中',
  scanning: '扫描中',
  ai_auditing: 'AI审计中',
  aggregating: '聚合中',
  reporting: '生成报告',
  completed: '已完成',
  failed: '失败',
}

const stagePercentMap: Record<string, number> = {
  pending: 0,
  unpacking: 10,
  analyzing: 25,
  scanning: 40,
  ai_auditing: 60,
  aggregating: 80,
  reporting: 90,
  completed: 100,
  failed: 0,
}

function FindingDetail({ item, onStatusChange }: { item: SkillsAuditItem; onStatusChange: (id: number, status: AuditItemStatus) => void }) {
  return (
    <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 4 }} onClick={e => e.stopPropagation()}>
      {/* 详情信息 */}
      <div style={{ padding: '0 4px' }}>
        {item.description && (
          <div style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.6 }}>{item.description}</div>
        )}
        {item.evidence && (
          <div style={{ marginBottom: 6, padding: '6px 8px', background: '#fefce8', borderRadius: 4, border: '1px solid #fef08a', fontSize: 11 }}>
            <strong>证据：</strong>{item.evidence}
          </div>
        )}
        {item.vulnerableCode && (
          <pre style={{ fontSize: 11, background: '#1e293b', color: '#e2e8f0', padding: 8, borderRadius: 4, overflow: 'auto', margin: '6px 0' }}>
            {item.vulnerableCode}
          </pre>
        )}
        {item.remediation && (
          <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0fdf4', borderRadius: 4, border: '1px solid #bbf7d0', fontSize: 11 }}>
            <strong>修复建议：</strong>{item.remediation}
          </div>
        )}
        {item.cweId && (
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            CWE: {item.cweId} {item.cweName && `- ${item.cweName}`}
          </div>
        )}
        <div className="muted" style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 12 }}>
          <span>置信度: {confidenceLabels[item.confidence] || item.confidence}</span>
          {item.lineStart && <span>行号: {item.lineStart}{item.lineEnd && item.lineEnd !== item.lineStart ? `-${item.lineEnd}` : ''}</span>}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="btn sm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); void onStatusChange(item.id, 'confirmed') }}>
          确认风险
        </button>
        <button className="btn outline sm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); void onStatusChange(item.id, 'false_positive') }}>
          标记误报
        </button>
      </div>
    </div>
  )
}

export function SkillsAuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auditId = Number(id)

  const [audit, setAudit] = useState<AuditDetailType | null>(null)
  const [items, setItems] = useState<SkillsAuditItem[]>([])
  const [selectedFinding, setSelectedFinding] = useState<SkillsAuditItem | null>(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  const isRunning = audit ? !['completed', 'failed'].includes(audit.status) : false

  async function loadData() {
    try {
      const [auditData, itemsData] = await Promise.all([
        getSkillsAuditDetail(auditId),
        getSkillsAuditItems(auditId, {
          severity: severityFilter !== 'all' ? severityFilter : undefined,
          riskCategory: categoryFilter !== 'all' ? categoryFilter : undefined,
        }),
      ])
      setAudit(auditData)
      setItems(itemsData.items)
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
  }, [auditId, severityFilter, categoryFilter])

  // 轮询：运行中时每 3 秒刷新
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => void loadData(), 3000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, auditId])

  // 过滤后的发现项
  const filteredItems = useMemo(() => {
    return items.filter(i => i.status !== 'false_positive')
  }, [items])

  // 按严重度分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, SkillsAuditItem[]> = { critical: [], high: [], medium: [], low: [], info: [] }
    for (const item of filteredItems) {
      if (groups[item.severity]) groups[item.severity].push(item)
    }
    return groups
  }, [filteredItems])

  // 按风险类别分组统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const item of filteredItems) {
      const cat = item.riskCategory
      stats[cat] = (stats[cat] || 0) + 1
    }
    return Object.entries(stats).sort((a, b) => b[1] - a[1])
  }, [filteredItems])

  // 严重度分布
  const severityStats = useMemo(() => {
    const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const item of filteredItems) {
      if (stats[item.severity] !== undefined) stats[item.severity]++
    }
    return stats
  }, [filteredItems])

  async function onStatusChange(itemId: number, status: AuditItemStatus) {
    await updateSkillsAuditItemStatus(itemId, status)
    void loadData()
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Skills 安全审计', path: '/evaluation-management?tab=skills' }, { label: '加载中...' }]} />
        <section className="card"><div style={{ padding: 32, textAlign: 'center', color: '#7f8c8d' }}>加载中...</div></section>
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Skills 安全审计', path: '/evaluation-management?tab=skills' }, { label: '错误' }]} />
        <section className="card"><div style={{ padding: 32, textAlign: 'center', color: 'var(--destructive)' }}>{error || '未找到审计记录'}</div></section>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Skills 安全审计', path: '/evaluation-management?tab=skills' }, { label: audit.name }]} />

      {/* 顶部概览 */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{audit.name}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              ID: {audit.id} | 状态: {statusLabels[audit.status] || audit.status}
              {audit.totalSkills > 0 && ` | Skills: ${audit.totalSkills}`}
              {audit.totalFiles > 0 && ` | 文件: ${audit.totalFiles}`}
              {audit.findingsCount > 0 && ` | 发现: ${audit.findingsCount}`}
            </div>
            {audit.skillManifest && (
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Manifest: {audit.skillManifest.name}
                {audit.skillManifest.permissions && audit.skillManifest.permissions.length > 0 &&
                  ` | 权限: ${audit.skillManifest.permissions.join(', ')}`
                }
              </div>
            )}
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
                  {audit.riskLevel && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: severityColors[audit.riskLevel] || '#6b7280' }}>
                      ({severityLabels[audit.riskLevel] || audit.riskLevel})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn outline sm" onClick={() => setShowReceiptModal(true)}>查看 Token 小票</button>
                  <button className="btn outline sm" onClick={() => getSkillsAuditReport(audit.id, 'pdf')}>导出 PDF</button>
                  <a href={`/api/skills-audit/${audit.id}/report?format=html`} target="_blank" rel="noopener" className="btn outline sm">导出 HTML</a>
                  <a href={`/api/skills-audit/${audit.id}/report?format=md`} target="_blank" rel="noopener" className="btn outline sm">导出 MD</a>
                  
                </div>
              </>
            )}
            <Link to="/evaluation-management?tab=skills" className="btn outline sm">返回列表</Link>
          </div>
        </div>
        {audit.errorMessage && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 4, color: '#dc2626', fontSize: 13 }}>
            {audit.errorMessage}
          </div>
        )}
      </section>

      {/* 内容区域 */}
      {audit.status === 'completed' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
          {/* 左侧：发现项列表 */}
          <div>
            {/* 筛选栏 */}
            <section className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 13 }}>筛选：</span>
                <select className="select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', height: 28 }}>
                  <option value="all">全部等级</option>
                  <option value="critical">严重</option>
                  <option value="high">高危</option>
                  <option value="medium">中危</option>
                  <option value="low">低危</option>
                  <option value="info">信息</option>
                </select>
                <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', height: 28, maxWidth: 200 }}>
                  <option value="all">全部风险类别</option>
                  {Object.entries(riskCategoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                  共 {filteredItems.length} 项发现
                </span>
              </div>
            </section>

            {/* 按严重度分组展示 */}
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
              const group = groupedItems[sev]
              if (!group || group.length === 0) return null
              return (
                <div key={sev} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: severityColors[sev], display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: severityColors[sev] }}>
                      {severityLabels[sev]}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>({group.length})</span>
                  </div>
                  <section className="card" style={{ padding: 0 }}>
                    {group.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: idx < group.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer',
                          background: selectedFinding?.id === item.id ? 'rgba(9,105,218,0.06)' : 'transparent',
                        }}
                        onClick={() => setSelectedFinding(selectedFinding?.id === item.id ? null : item)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 600,
                              color: '#fff',
                              background: severityColors[sev],
                              marginRight: 8,
                            }}>
                              {riskCategoryLabels[item.riskCategory] || item.riskCategory}
                            </span>
                            {item.title}
                          </div>
                          <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 8 }}>
                            <span>{item.filePath}</span>
                            {item.lineStart && <span>:{item.lineStart}</span>}
                          </div>
                        </div>
                        {selectedFinding?.id === item.id && (
                          <FindingDetail item={item} onStatusChange={onStatusChange} />
                        )}
                      </div>
                    ))}
                  </section>
                </div>
              )
            })}
            {filteredItems.length === 0 && (
              <section className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div className="muted">暂无发现项</div>
              </section>
            )}
          </div>

          {/* 右侧：统计面板 */}
          <div>
            {/* 风险评分 */}
            <section className="card" style={{ marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 12 }}>风险评分</div>
              <div style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                border: `6px solid ${audit.riskScore >= 50 ? '#dc2626' : audit.riskScore >= 25 ? '#f59e0b' : '#16a34a'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: audit.riskScore >= 50 ? '#dc2626' : audit.riskScore >= 25 ? '#f59e0b' : '#16a34a' }}>
                  {audit.riskScore}
                </span>
              </div>
              {audit.riskLevel && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: severityColors[audit.riskLevel] || '#6b7280' }}>
                  {severityLabels[audit.riskLevel] || audit.riskLevel}风险
                </div>
              )}
            </section>

            {/* 严重度分布 */}
            <section className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 12 }}>严重度分布</div>
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
                const count = severityStats[sev]
                const maxCount = Math.max(...Object.values(severityStats), 1)
                return (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 32, fontSize: 11, color: severityColors[sev], fontWeight: 600 }}>{severityLabels[sev]}</span>
                    <div style={{ flex: 1, height: 14, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: severityColors[sev], borderRadius: 3, transition: 'width 0.3s', minWidth: count > 0 ? 14 : 0 }} />
                    </div>
                    <span style={{ width: 20, textAlign: 'right', fontSize: 11, color: '#6b7280' }}>{count}</span>
                  </div>
                )
              })}
            </section>

            {/* 风险类别分布 */}
            <section className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 12 }}>风险类别分布</div>
              {categoryStats.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>无数据</div>
              ) : (
                categoryStats.slice(0, 10).map(([cat, count]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11 }}>{riskCategoryLabels[cat] || cat}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0969da' }}>{count}</span>
                  </div>
                ))
              )}
            </section>

            {/* 审计日志 */}
            <section className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 12 }}>审计日志</div>
              <div style={{ maxHeight: 300, overflow: 'auto', background: '#1e293b', borderRadius: 6, padding: 10 }}>
                {audit.logs.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>暂无日志</div>
                ) : (
                  audit.logs.map((log, idx) => (
                    <div key={idx} style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                      <span style={{ color: '#64748b' }}>[{new Date(log.createdAt * 1000).toLocaleTimeString('zh-CN')}]</span>{' '}
                      <span style={{ color: log.level === 'error' ? '#f87171' : log.level === 'warn' ? '#fbbf24' : '#38bdf8' }}>[{log.stage}]</span>{' '}
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : isRunning ? (
        <section className="card" style={{ padding: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              审计进行中: {statusLabels[audit.status] || audit.status}
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
                  width: `${stagePercentMap[audit.status] || 0}%`,
                }} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{stagePercentMap[audit.status] || 0}%</div>
            </div>
          </div>
          {/* 审计日志 */}
          <div style={{ marginTop: 24, maxHeight: 300, overflow: 'auto', background: '#1e293b', borderRadius: 6, padding: 12 }}>
            {audit.logs.map((log, idx) => (
              <div key={idx} style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>[{new Date(log.createdAt * 1000).toLocaleTimeString('zh-CN')}]</span>{' '}
                <span style={{ color: log.level === 'error' ? '#f87171' : log.level === 'warn' ? '#fbbf24' : '#38bdf8' }}>[{log.stage}]</span>{' '}
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
                  <span style={{ color: '#64748b' }}>[{new Date(log.createdAt * 1000).toLocaleTimeString('zh-CN')}]</span>{' '}
                  <span style={{ color: log.level === 'error' ? '#f87171' : '#38bdf8' }}>[{log.stage}]</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <TokenReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        taskId={String(auditId)}
        module="skills-audit"
      />
    </div>
  )
}