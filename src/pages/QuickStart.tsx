import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getOverview } from '../api'
import type { Overview } from '../types'
import './QuickStart.css'

function triggerFireworks() {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = []

  function createFirework(x: number, y: number) {
    const colors = ['#5d8fff', '#48d18f', '#ffa94d', '#ff6b9d', '#c084fc', '#fbbf24', '#f87171']
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80
      const speed = 3 + Math.random() * 5
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1
      p.life -= 0.01

      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }

      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    if (particles.length > 0) {
      requestAnimationFrame(animate)
    } else {
      document.body.removeChild(canvas)
    }
  }

  createFirework(window.innerWidth / 2, window.innerHeight / 3)
  setTimeout(() => createFirework(window.innerWidth / 3, window.innerHeight / 2), 200)
  setTimeout(() => createFirework((window.innerWidth * 2) / 3, window.innerHeight / 2), 400)
  animate()
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', running: '运行中', completed: '已完成', failed: '失败',
  parsing: '解析中', slicing: '切片中', auditing: '审计中', aggregating: '聚合中',
}

const STATUS_VARIANTS: Record<string, string> = {
  pending: 'warning', running: 'info', completed: 'success', failed: 'danger',
  parsing: 'info', slicing: 'info', auditing: 'info', aggregating: 'info',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function QuickStart() {
  const [data, setData] = useState<Overview | null>(null)

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const evalCount = (data?.trend ?? []).reduce((s, t) => s + t.cnt, 0)
    const mcpCount = (data?.mcpTrend ?? []).reduce((s, t) => s + t.cnt, 0)
    const auditCount = (data?.codeAuditTrend ?? []).reduce((s, t) => s + t.cnt, 0)
    const skillsCount = (data?.skillsAuditTrend ?? []).reduce((s, t) => s + t.cnt, 0)
    const passRate = data?.passRate30d != null ? Math.round(data.passRate30d * 100) : null
    return { evalCount, mcpCount, auditCount, skillsCount, passRate }
  }, [data])

  const recentActivities = useMemo(() => {
    const items: Array<{ id: string; name: string; status: string; createdAt: number; type: 'model' | 'mcp' | 'audit' | 'skills' }> = [
      ...(data?.recentEvaluations ?? []).map(it => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'model' as const })),
      ...(data?.recentMcpScans ?? []).map(it => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'mcp' as const })),
      ...(data?.recentCodeAudits ?? []).map(it => ({ id: String(it.id), name: it.name, status: it.status, createdAt: it.createdAt, type: 'audit' as const })),
      ...(data?.recentSkillsAudits ?? []).map(it => ({ id: String(it.id), name: it.name, status: it.status, createdAt: it.createdAt, type: 'skills' as const })),
    ]
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  }, [data])

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('quickStartTourSeen')
    if (!hasSeenTour) {
      const driverObj = driver({
        showProgress: true,
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        steps: [
          {
            element: 'a[href="/"]',
            popover: {
              title: '欢迎使用听风',
              description: 'AI 安全评估系统，让我们快速了解主要功能模块'
            }
          },
          {
            element: '[data-tour="feature-eval"]',
            popover: {
              title: '模型安全评测',
              description: '基于 TC260 等标准对大模型进行安全合规评估，支持自动化评测流程'
            }
          },
          {
            element: '[data-tour="feature-mcp"]',
            popover: {
              title: 'MCP 扫描',
              description: '上传项目源码，AI 驱动识别漏洞并生成安全评分报告'
            }
          },
          {
            element: '[data-tour="feature-audit"]',
            popover: {
              title: '代码安全审计',
              description: 'AI 驱动的多阶段代码安全审计流水线，从预处理到漏洞验证'
            }
          },
          {
            element: '[data-tour="feature-skills"]',
            popover: {
              title: 'Skills 安全审计',
              description: '对 AI Skills 进行安全审计，分析触发器、权限和风险类别，生成评分报告'
            }
          },
          {
            element: 'a[href="/arsenal"]',
            popover: {
              title: '测试集',
              description: '管理测试集，支持 TC260、通用和自定义测试集'
            }
          },
          {
            element: 'a[href="/dashboard"]',
            popover: {
              title: '数据面板',
              description: '查看评估趋势、漏洞分布等统计数据'
            }
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem('quickStartTourSeen', 'true')
          driverObj.destroy()
          triggerFireworks()
        }
      })
      setTimeout(() => driverObj.drive(), 500)
    }
  }, [])

  function getItemLink(item: { id: string; type: 'model' | 'mcp' | 'audit' | 'skills' }) {
    if (item.type === 'model') return `/evaluation-management/model/${item.id}`
    if (item.type === 'mcp') return `/evaluation-management/mcp/${item.id}`
    if (item.type === 'skills') return `/evaluation-management/skills/${item.id}`
    return `/code-audit/${item.id}`
  }

  function getTypeBadge(type: 'model' | 'mcp' | 'audit' | 'skills') {
    if (type === 'model') return <span className="qs-badge qs-badge-info">模型评测</span>
    if (type === 'mcp') return <span className="qs-badge qs-badge-warning">MCP 扫描</span>
    if (type === 'skills') return <span className="qs-badge qs-badge-skills">Skills 安全审计</span>
    return <span className="qs-badge qs-badge-success">代码安全审计</span>
  }

  return (
    <div className="qs-page">
      {/* Hero 区域 */}
      <section className="qs-hero">
        <div className="qs-hero-text">
          <h1 className="qs-hero-title">欢迎使用 <b>听风</b> — AI 安全评估系统</h1>
          <p className="qs-hero-desc">
           覆盖LLM 模型评估、MCP 风险评估、代码安全审计、Skills 安全审计四大核心模块，为安全团队提供体系化的 AI 风险发现与修复能力，护航 AI 应用安全落地。
          </p>
        </div>
        <div className="qs-hero-stats">
          <div className="qs-stat-card">
            <div className="qs-stat-value">{stats.evalCount}</div>
            <div className="qs-stat-label">模型评测</div>
            {stats.passRate != null && <div className="qs-stat-sub">通过率 {stats.passRate}%</div>}
          </div>
          <div className="qs-stat-card">
            <div className="qs-stat-value">{stats.mcpCount}</div>
            <div className="qs-stat-label">MCP 扫描</div>
          </div>
          <div className="qs-stat-card">
            <div className="qs-stat-value">{stats.auditCount}</div>
            <div className="qs-stat-label">代码安全审计</div>
          </div>
          <div className="qs-stat-card">
            <div className="qs-stat-value">{stats.skillsCount}</div>
            <div className="qs-stat-label">Skills 安全审计</div>
          </div>
        </div>
      </section>

      {/* 核心功能入口 */}
      <div className="qs-features">
        <Link to="/evaluation/model" className="qs-feature-card qs-feature-eval" data-tour="feature-eval">
          <div className="qs-feature-icon qs-icon-eval">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div className="qs-feature-body">
            <div className="qs-feature-name">模型安全评测</div>
            <div className="qs-feature-desc">基于 TC260、通用、自定义测试集，自动化评测大模型安全合规性，生成通过率与风险报告</div>
          </div>
          <div className="qs-feature-action">
            <span className="qs-feature-btn">开始评测</span>
          </div>
        </Link>

        <Link to="/evaluation/mcp" className="qs-feature-card qs-feature-mcp" data-tour="feature-mcp">
          <div className="qs-feature-icon qs-icon-mcp">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="qs-feature-body">
            <div className="qs-feature-name">MCP 扫描</div>
            <div className="qs-feature-desc">上传项目源码，AI 驱动识别技术栈与漏洞，进行可利用性评审并生成安全评分报告</div>
          </div>
          <div className="qs-feature-action">
            <span className="qs-feature-btn">开始扫描</span>
          </div>
        </Link>

        <Link to="/code-audit/create" className="qs-feature-card qs-feature-audit" data-tour="feature-audit">
          <div className="qs-feature-icon qs-icon-audit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="qs-feature-body">
            <div className="qs-feature-name">代码安全审计</div>
            <div className="qs-feature-desc">多阶段 Pipeline 审计流水线：预处理、切片、Parser、Hunter、Validator，基于 CWE 分类漏洞</div>
          </div>
          <div className="qs-feature-action">
            <span className="qs-feature-btn">开始审计</span>
          </div>
        </Link>

        <Link to="/evaluation/skills" className="qs-feature-card qs-feature-skills" data-tour="feature-skills">
          <div className="qs-feature-icon qs-icon-skills">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="qs-feature-body">
            <div className="qs-feature-name">Skills 安全审计</div>
            <div className="qs-feature-desc">AI 驱动的 Skills 安全审计，分析触发器、权限与风险类别，生成安全评分与修复建议</div>
          </div>
          <div className="qs-feature-action">
            <span className="qs-feature-btn">开始审计</span>
          </div>
        </Link>
      </div>

      {/* 辅助功能 + 最近动态 */}
      <div className="qs-bottom">
        <div className="qs-quick-links">
          <h3 className="qs-section-title">快速链接</h3>
          <Link to="/arsenal" className="qs-link-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
            <span>测试集管理</span>
            <span className="qs-link-arrow">→</span>
          </Link>
          <Link to="/settings/model" className="qs-link-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>模型设置</span>
            <span className="qs-link-arrow">→</span>
          </Link>
          <Link to="/dashboard" className="qs-link-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            <span>数据面板</span>
            <span className="qs-link-arrow">→</span>
          </Link>
        </div>

        <div className="qs-recent">
          <h3 className="qs-section-title">最近动态</h3>
          {recentActivities.length === 0 ? (
            <div className="qs-recent-empty">暂无动态，开始您的第一次评估吧</div>
          ) : (
            <div className="qs-recent-list">
              {recentActivities.map(item => (
                <Link key={`${item.type}-${item.id}`} to={getItemLink(item)} className="qs-recent-item">
                  <div className="qs-recent-left">
                    {getTypeBadge(item.type)}
                    <span className="qs-recent-name">{item.name}</span>
                  </div>
                  <div className="qs-recent-right">
                    <span className={`qs-badge qs-badge-${STATUS_VARIANTS[item.status] ?? 'warning'}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <span className="qs-recent-time">{timeAgo(item.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 版权说明 */}
      <div className="qs-footer">
        © 2026 听风 · 0x八月.
      </div>
    </div>
  )
}