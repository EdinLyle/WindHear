import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteCodeAudit, listCodeAudits } from '../api'
import type { CodeAuditListItem } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const PAGE_SIZE = 10

const statusLabels: Record<string, string> = {
  pending: '待处理',
  parsing: '解析中',
  slicing: '切片中',
  auditing: '审计中',
  aggregating: '聚合中',
  completed: '已完成',
  failed: '失败',
}

const statusVariants: Record<string, string> = {
  pending: 'warning',
  parsing: 'info',
  slicing: 'info',
  auditing: 'info',
  aggregating: 'info',
  completed: 'success',
  failed: 'danger',
}

function StatusBadge({ status }: { status: string }) {
  const variant = statusVariants[status] || 'warning'
  const label = statusLabels[status] || status
  return <span className={`badge ${variant}`}>{label}</span>
}

function RiskScoreBadge({ score }: { score: number }) {
  const color = score >= 50 ? '#dc2626' : score >= 25 ? '#f59e0b' : '#16a34a'
  return (
    <span style={{ fontWeight: 600, color, fontSize: 13 }}>
      {score}
    </span>
  )
}

export function CodeAuditList({ hideBreadcrumb }: { hideBreadcrumb?: boolean } = {}) {
  const [items, setItems] = useState<CodeAuditListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const refresh = useCallback(async (nextPage?: number, nextQuery?: string, nextLanguage?: string) => {
    const p = nextPage ?? page
    const q = nextQuery ?? query
    const lang = nextLanguage ?? language
    setLoading(true)
    try {
      const resp = await listCodeAudits(p, PAGE_SIZE, { query: q || undefined, language: lang !== 'all' ? lang : undefined })
      setItems(resp.items)
      setTotal(resp.total)
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, query, language])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh() }, [refresh])

  function onQueryChange(value: string) {
    setQuery(value)
    setPage(1)
    void refresh(1, value)
  }

  function onLanguageChange(value: string) {
    setLanguage(value)
    setPage(1)
    void refresh(1, undefined, value)
  }

  async function onDelete(id: number) {
    if (!confirm('确定要删除这条审计记录吗？')) return
    await deleteCodeAudit(id)
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
      {!hideBreadcrumb && <Breadcrumb items={[{ label: '代码安全审计' }]} />}

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
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{ minWidth: 100, padding: '6px 10px', height: 32 }}
            >
              <option value="all">全部语言</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
              <option value="csharp">C#</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
            </select>
            <Link to="/code-audit/create" className="btn">
              新建代码安全审计
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
              <th style={{ width: 80 }}>来源</th>
              <th style={{ width: 80 }}>语言</th>
              <th style={{ width: 80 }}>状态</th>
              <th style={{ width: 60 }}>评分</th>
              <th style={{ width: 60 }}>漏洞</th>
              <th style={{ width: 100, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                暂无审计数据，<Link to="/code-audit/create">创建第一个审计任务</Link>
              </td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {formatTimestamp(item.createdAt)}
                  </td>
                  <td>
                    <Link to={`/code-audit/${item.id}`} style={{ fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none' }}>
                      {item.name}
                    </Link>
                    {item.errorMessage && (
                      <div style={{ color: 'var(--destructive)', fontSize: 11, marginTop: 2 }} title={item.errorMessage}>
                        {item.errorMessage.slice(0, 60)}{item.errorMessage.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {item.sourceType === 'zip' ? 'ZIP' : 'Git'}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {item.language || '-'}
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    {item.status === 'completed' ? <RiskScoreBadge score={item.riskScore} /> : '-'}
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
    </div>
  )
}

function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  // Unix timestamp (seconds) - convert to ms
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}