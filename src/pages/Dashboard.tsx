import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getOverview } from '../api'
import type { Overview } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const COLORS = ['#5d8fff', '#48d18f', '#ffa94d', '#a78bfa', '#f472b6', '#22d3ee', '#facc15', '#818cf8']

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getOverview()
      .then((next) => {
        setData(next)
        setError('')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const arsenalData = useMemo(() => {
    const counts = data?.arsenalCounts ?? {}
    return [
      { key: 'tc260', name: 'TC260 测试集', value: counts.tc260 ?? 0 },
      { key: 'general', name: '通用测试集', value: counts.general ?? 0 },
      { key: 'custom', name: '自定义测试集', value: counts.custom ?? 0 },
    ]
  }, [data])

  const recentAll = useMemo(() => {
    const recent = data?.recentEvaluations ?? []
    const recentMcp = data?.recentMcpScans ?? []
    const recentCodeAudits = data?.recentCodeAudits ?? []
    const recentSkillsAudits = data?.recentSkillsAudits ?? []
    const merged: Array<{ id: string; name: string; status: string; createdAt: number; type: 'model' | 'mcp' | 'audit' | 'skills' }> = [
      ...recent.map((it) => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'model' as const })),
      ...recentMcp.map((it) => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'mcp' as const })),
      ...recentCodeAudits.map((it) => ({ id: String(it.id), name: it.name, status: it.status, createdAt: it.createdAt, type: 'audit' as const })),
      ...recentSkillsAudits.map((it) => ({ id: String(it.id), name: it.name, status: it.status, createdAt: it.createdAt, type: 'skills' as const })),
    ]
    return merged.sort((a, b) => b.createdAt - a.createdAt)
  }, [data?.recentEvaluations, data?.recentMcpScans, data?.recentCodeAudits, data?.recentSkillsAudits])

  const combinedTrend = useMemo(() => {
    const trend = data?.trend ?? []
    const mcpTrend = data?.mcpTrend ?? []
    const codeAuditTrend = data?.codeAuditTrend ?? []
    const skillsAuditTrend = data?.skillsAuditTrend ?? []
    const days: string[] = []
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayUTC - i * 86400000)
      days.push(d.toISOString().slice(0, 10))
    }

    const map = new Map<string, { day: string; modelCnt: number; mcpCnt: number; auditCnt: number; skillsCnt: number; passRate: number }>()
    days.forEach((day) => {
      map.set(day, { day, modelCnt: 0, mcpCnt: 0, auditCnt: 0, skillsCnt: 0, passRate: 0 })
    })

    trend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.modelCnt = item.cnt
        existing.passRate = Math.round(item.passRate * 100)
      }
    })

    mcpTrend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.mcpCnt = item.cnt
      }
    })

    codeAuditTrend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.auditCnt = item.cnt
      }
    })

    skillsAuditTrend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.skillsCnt = item.cnt
      }
    })

    return days.map((day) => map.get(day)!)
  }, [data?.trend, data?.mcpTrend, data?.codeAuditTrend, data?.skillsAuditTrend])

  const severityData = useMemo(() => {
    const dist = data?.severityDistribution ?? []
    if (dist.length === 0) return []
    const order = ['critical', 'high', 'medium', 'low', 'info']
    return order
      .filter((s) => dist.some((d) => d.severity === s))
      .map((s) => {
        const item = dist.find((d) => d.severity === s)!
        return { key: s, name: SEVERITY_LABELS[s] ?? s, value: item.cnt }
      })
  }, [data])

  const cweData = useMemo(() => {
    const dist = data?.cweDistribution ?? []
    if (dist.length === 0) return []
    return dist.map((d) => ({ key: d.cweId, name: d.cweName, value: d.cnt }))
  }, [data])

  const mcpSevData = useMemo(() => {
    const dist = data?.mcpSeverityDistribution ?? []
    if (dist.length === 0) return []
    const order = ['critical', 'high', 'medium', 'low', 'info']
    return order
      .filter((s) => dist.some((d) => d.severity === s))
      .map((s) => {
        const item = dist.find((d) => d.severity === s)!
        return { key: s, name: SEVERITY_LABELS[s] ?? s, value: item.cnt, fill: SEVERITY_COLORS[s] ?? '#6b7280' }
      })
  }, [data])

  const skillsSevData = useMemo(() => {
    const dist = data?.skillsSeverityDistribution ?? []
    if (dist.length === 0) return []
    const order = ['critical', 'high', 'medium', 'low', 'info']
    return order
      .filter((s) => dist.some((d) => d.severity === s))
      .map((s) => {
        const item = dist.find((d) => d.severity === s)!
        return { key: s, name: SEVERITY_LABELS[s] ?? s, value: item.cnt }
      })
  }, [data])

  const skillsCategoryData = useMemo(() => {
    const dist = data?.skillsRiskCategoryDistribution ?? []
    if (dist.length === 0) return []
    const categoryLabels: Record<string, string> = {
      dangerous_command: '危险命令', data_exfiltration: '数据泄露', unauthorized_access: '未授权访问',
      privilege_escalation: '权限提升', code_injection: '代码注入', path_traversal: '路径穿越',
      social_engineering: '社会工程学', resource_abuse: '资源滥用', information_disclosure: '信息泄露',
      denial_of_service: '拒绝服务', credential_exposure: '凭证暴露', insecure_communication: '不安全通信',
      insufficient_validation: '输入验证不足', insecure_defaults: '不安全默认配置',
      dependency_confusion: '依赖混淆', prompt_injection: '提示注入', tool_poisoning: '工具投毒',
      context_manipulation: '上下文操控', supply_chain: '供应链攻击', other: '其他',
    }
    return dist.map((d) => ({
      name: categoryLabels[d.riskCategory] ?? d.riskCategory,
      size: d.cnt,
    }))
  }, [data])

  function getItemLink(item: { id: string; type: 'model' | 'mcp' | 'audit' | 'skills' }) {
    if (item.type === 'model') return `/evaluation-management/model/${item.id}`
    if (item.type === 'mcp') return `/evaluation-management/mcp/${item.id}`
    if (item.type === 'skills') return `/evaluation-management/skills/${item.id}`
    return `/code-audit/${item.id}`
  }

  function getTypeBadge(item: { type: 'model' | 'mcp' | 'audit' | 'skills' }) {
    if (item.type === 'model') return <span className="badge info">LLM 模型评估</span>
    if (item.type === 'mcp') return <span className="badge warning">MCP 风险评估</span>
    if (item.type === 'skills') return <span className="badge" style={{ background: '#a78bfa', color: '#fff' }}>Skills 安全审计</span>
    return <span className="badge danger">代码安全审计</span>
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '数据面板' }]} />
      {error ? (
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="muted">加载失败：{error}</div>
        </div>
      ) : null}

      <div className="cardGrid">
        <section className="card" style={{ gridColumn: 'span 4' }}>
          <div className="cardHeader">
            <div>测试集占比</div>
            <Link className="btn secondary" to="/arsenal">
              管理测试集
            </Link>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={arsenalData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {arsenalData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 8' }}>
          <div className="cardHeader">
            <div>评估趋势（近 14 天）</div>
            <Link className="btn secondary" to="/evaluation-management">
              查看任务
            </Link>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={combinedTrend} margin={{ left: -20, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tick={{ fill: '#374151', fontSize: 12 }} interval={0} textAnchor="end" height={60} tickFormatter={(value) => value.slice(5)} />
                <YAxis tick={{ fill: '#374151', fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="modelCnt" stroke="#5d8fff" strokeWidth={2} name="LLM 模型评估" />
                <Line type="monotone" dataKey="mcpCnt" stroke="#ffa94d" strokeWidth={2} name="MCP 风险评估" />
                <Line type="monotone" dataKey="auditCnt" stroke="#a78bfa" strokeWidth={2} name="代码安全审计" />
                <Line type="monotone" dataKey="skillsCnt" stroke="#f472b6" strokeWidth={2} name="Skills 安全审计" />
                <Line type="monotone" dataKey="passRate" stroke="#48d18f" strokeWidth={2} name="通过率" unit="%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            蓝线：LLM 模型评估 | 橙线：MCP 风险评估 | 紫线：代码安全审计 | 粉线：Skills 安全审计 | 绿线：通过率（%）
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 6' }}>
          <div className="cardHeader">
            <div>漏洞严重度占比</div>
            <Link className="btn secondary" to="/code-audit">
              代码安全审计
            </Link>
          </div>
          {severityData.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: '60px 0' }}>暂无数据</div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {severityData.map((entry) => (
                      <Cell key={`sev-${entry.key}`} fill={SEVERITY_COLORS[entry.key] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ gridColumn: 'span 6' }}>
          <div className="cardHeader">
            <div>漏洞类型占比</div>
            <Link className="btn secondary" to="/code-audit">
              代码安全审计
            </Link>
          </div>
          {cweData.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: '60px 0' }}>暂无数据</div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={cweData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {cweData.map((_, index) => (
                      <Cell key={`cwe-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ gridColumn: 'span 6' }}>
          <div className="cardHeader">
            <div>MCP 漏洞严重度分布</div>
            <Link className="btn secondary" to="/evaluation-management?tab=mcp">
              MCP 风险评估
            </Link>
          </div>
          {mcpSevData.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: '60px 0' }}>暂无数据</div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={mcpSevData} layout="vertical" margin={{ left: 50, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.08)" />
                  <XAxis type="number" tick={{ fill: '#374151', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#374151', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="数量" animationBegin={0} animationDuration={800}>
                    {mcpSevData.map((entry) => (
                      <Cell key={`mcp-sev-${entry.key}`} fill={SEVERITY_COLORS[entry.key] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ gridColumn: 'span 6' }}>
          <div className="cardHeader">
            <div>Skills 安全审计严重度分布</div>
            <Link className="btn secondary" to="/evaluation-management?tab=skills">
              Skills 安全审计
            </Link>
          </div>
          {skillsSevData.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: '60px 0' }}>暂无数据</div>
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <RadarChart data={skillsSevData} cx="50%" cy="50%" outerRadius={80}>
                  <PolarGrid stroke="rgba(0,0,0,0.08)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#374151', fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: '#374151', fontSize: 10 }} />
                  <Radar name="数量" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.4} animationBegin={0} animationDuration={800} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ gridColumn: 'span 6' }}>
          <div className="cardHeader">
            <div>Skills 风险类别分布</div>
            <Link className="btn secondary" to="/evaluation-management?tab=skills">
              Skills 安全审计
            </Link>
          </div>
          {skillsCategoryData.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: '60px 0' }}>暂无数据</div>
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={skillsCategoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fill: '#374151', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#374151', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="size" radius={[0, 4, 4, 0]} animationBegin={0} animationDuration={800}>
                    {skillsCategoryData.map((_, index) => (
                      <Cell key={`cat-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ gridColumn: 'span 12' }}>
          <div className="cardHeader">
            <div>最近评估任务</div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn secondary" to="/evaluation/model">
                新建LLM 模型评估
              </Link>
              <Link className="btn secondary" to="/evaluation/mcp">
                新建 MCP 风险评估
              </Link>
              <Link className="btn secondary" to="/code-audit/create">
                新建代码安全审计
              </Link>
              <Link className="btn secondary" to="/evaluation/skills">
                新建 Skills 安全审计
              </Link>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {recentAll.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    暂无数据
                  </td>
                </tr>
              ) : (
                recentAll.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>
                      <Link to={getItemLink(item)} style={{ color: '#000000', textDecoration: 'none' }}>
                        {item.name.length > 50 ? (
                          expandedIds.has(item.id) ? (
                            <>
                              <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', maxWidth: '730px' }}>{item.name}</div>
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={(e) => { e.preventDefault(); setExpandedIds((s) => { const n = new Set(s); n.delete(item.id); return n }) }}>收起</span>
                            </>
                          ) : (
                            <>
                              {item.name.slice(0, 50)}...
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={(e) => { e.preventDefault(); setExpandedIds((s) => new Set(s).add(item.id)) }}>详情</span>
                            </>
                          )
                        ) : item.name}
                      </Link>
                    </td>
                    <td>{getTypeBadge(item)}</td>
                    <td>
                      <span className={`badge ${getStatusVariant(item.status)}`}>{formatStatus(item.status)}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    queued: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    parsing: '解析中',
    slicing: '切片中',
    auditing: '审计中',
    aggregating: '聚合中',
  }
  return map[status] || status
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
    case 'parsing':
    case 'slicing':
    case 'auditing':
    case 'aggregating':
      return 'info'
    case 'failed':
      return 'danger'
    case 'pending':
    case 'queued':
      return 'warning'
    default:
      return ''
  }
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}