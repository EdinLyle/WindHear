import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteSkillsAudit, listSkillsAudits } from '../api'
import type { SkillsAuditListItem } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'
import { ConfirmDialog } from '../components/ConfirmDialog'

const PAGE_SIZE = 10

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

const statusVariants: Record<string, string> = {
  pending: 'warning',
  unpacking: 'info',
  analyzing: 'info',
  scanning: 'info',
  ai_auditing: 'info',
  aggregating: 'info',
  reporting: 'info',
  completed: 'success',
  failed: 'danger',
}

const riskLevelLabels: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
}

const riskLevelColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#f59e0b',
  low: '#16a34a',
}

function StatusBadge({ status }: { status: string }) {
  const variant = statusVariants[status] || 'warning'
  const label = statusLabels[status] || status
  return <span className={`badge ${variant}`}>{label}</span>
}

function RiskScoreBadge({ score, riskLevel }: { score: number; riskLevel: string | null }) {
  const color = score >= 50 ? '#dc2626' : score >= 25 ? '#f59e0b' : '#16a34a'
  return (
    <span style={{ fontWeight: 600, color, fontSize: 13 }}>
      {score}
      {riskLevel && (
        <span style={{ fontSize: 11, marginLeft: 4, color: riskLevelColors[riskLevel] || '#6b7280' }}>
          ({riskLevelLabels[riskLevel] || riskLevel})
        </span>
      )}
    </span>
  )
}

export function SkillsAuditList({ hideBreadcrumb }: { hideBreadcrumb?: boolean } = {}) {
  const [items, setItems] = useState<SkillsAuditListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [riskLevel, setRiskLevel] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const refresh = useCallback(async (nextPage?: number, nextQuery?: string, nextRiskLevel?: string) => {
    const p = nextPage ?? page
    const q = nextQuery ?? query
    const rl = nextRiskLevel ?? riskLevel
    setLoading(true)
    try {
      const resp = await listSkillsAudits(p, PAGE_SIZE, { query: q || undefined, riskLevel: rl !== 'all' ? rl : undefined })
      setItems(resp.items)
      setTotal(resp.total)
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, query, riskLevel])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh() }, [refresh])

  function onQueryChange(value: string) {
    setQuery(value)
    setPage(1)
    void refresh(1, value)
  }

  function onRiskLevelChange(value: string) {
    setRiskLevel(value)
    setPage(1)
    void refresh(1, undefined, value)
  }

  async function onDelete(id: number) {
    setPendingDeleteId(id)
    setDialogOpen(true)
  }

  async function onConfirmDelete() {
    if (pendingDeleteId == null) return
    await deleteSkillsAudit(pendingDeleteId)
    setDialogOpen(false)
    setPendingDeleteId(null)
    void refresh()
  }

  const stats = useMemo(() => {
    const completed = items.filter(i => i.status === 'completed').length
    const failed = items.filter(i => i.status === 'failed').length
    const running = items.filter(i => !['completed', 'failed'].includes(i.status)).length
    return { completed, failed, running }
  }, [items])

  return (
    <div>
      {!hideBreadcrumb && <Breadcrumb items={[{ label: 'Skills 安全审计' }]} />}

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>总任务</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{total}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>运行中</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0969da' }}>{stats.running}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>已完成</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{stats.completed}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>失败</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{stats.failed}</div>
        </div>
      </div>

      {/* 操作栏 */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: 13 }}>
            共 {total} 条记录
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 220, flexShrink: 0 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => onQueryChange(e.target.value.trimStart())}
                placeholder="搜索任务名称..."
                style={{ width: '100%', minWidth: 'unset' }}
              />
            </div>
            <select
              className="select"
              value={riskLevel}
              onChange={(e) => onRiskLevelChange(e.target.value)}
              style={{ minWidth: 100, padding: '6px 10px', height: 32 }}
            >
              <option value="all">全部风险</option>
              <option value="critical">严重</option>
              <option value="high">高危</option>
              <option value="medium">中危</option>
              <option value="low">低危</option>
            </select>
            <Link to="/evaluation/skills" className="btn">
              新建Skills 安全审计
            </Link>
            <button className="btn outline" onClick={() => void refresh()} disabled={loading}>
              <span style={{ marginRight: 6 }}>↻</span>刷新
            </button>
          </div>
        </div>

        {/* 表格 */}
        <table className="table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>创建时间</th>
              <th>任务名称</th>
              <th style={{ width: 100 }}>来源文件</th>
              <th style={{ width: 60 }}>Skills</th>
              <th style={{ width: 80 }}>状态</th>
              <th style={{ width: 100 }}>风险评分</th>
              <th style={{ width: 60 }}>发现</th>
              <th style={{ width: 100, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                暂无Skills 安全审计数据，<Link to="/evaluation/skills">创建第一个审计任务</Link>
              </td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {formatTimestamp(item.createdAt)}
                  </td>
                  <td>
                    <Link to={`/evaluation-management/skills/${item.id}`} style={{ fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none' }}>
                      {item.name}
                    </Link>
                    {item.errorMessage && (
                      <div style={{ color: 'var(--destructive)', fontSize: 11, marginTop: 2 }} title={item.errorMessage}>
                        {item.errorMessage.slice(0, 60)}{item.errorMessage.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {item.originalFilename || '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {item.totalSkills || 0}
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    {item.status === 'completed' ? <RiskScoreBadge score={item.riskScore} riskLevel={item.riskLevel} /> : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {item.findingsCount || 0}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn danger sm" onClick={() => onDelete(item.id)}>删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 分页 */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="muted" style={{ fontSize: 13 }}>第 {page}/{totalPages} 页</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(1)}>首页</button>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页</button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={dialogOpen}
        message="确定要删除这条Skills 安全审计记录吗？"
        onConfirm={onConfirmDelete}
        onCancel={() => { setDialogOpen(false); setPendingDeleteId(null) }}
      />
    </div>
  )
}

function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}