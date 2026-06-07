import { useEffect, useState } from 'react'
import './Changelog.css'

interface ChangelogEntry {
  version: string
  date: string
  changes: Array<{ type: string; text: string }>
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:      { label: '新增', color: '#16a34a', bg: '#f0fdf4' },
  fix:      { label: '修复', color: '#dc2626', bg: '#fef2f2' },
  improve:  { label: '优化', color: '#2563eb', bg: '#eff6ff' },
  security: { label: '安全', color: '#ea580c', bg: '#fff7ed' },
  ui:       { label: '界面', color: '#9333ea', bg: '#faf5ff' },
  refactor: { label: '重构', color: '#0891b2', bg: '#ecfeff' },
}

/** 判断是否为大版本（x.0.0） */
function isMajorVersion(v: string): boolean {
  return /^V\d+\.\d+\.0$/.test(v)
}

export function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch changelog')
        return r.json()
      })
      .then((data: ChangelogEntry[]) => {
        setEntries(data)
        // 小版本默认折叠
        const initCollapsed: Record<string, boolean> = {}
        data.forEach(e => {
          if (!isMajorVersion(e.version)) {
            initCollapsed[e.version] = true
          }
        })
        setCollapsed(initCollapsed)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  function toggleCollapse(version: string) {
    setCollapsed(prev => ({ ...prev, [version]: !prev[version] }))
  }

  if (loading) {
    return (
      <div className="changelog-page">
        <div className="changelog-loading">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="changelog-page">
        <div className="changelog-error">加载失败：{error}</div>
      </div>
    )
  }

  return (
    <div className="changelog-page">
      <div className="changelog-header">
        <h1>更新日志</h1>
        <p className="changelog-subtitle">更新日志，快速了解新增风险检测类型、优化策略及安全能力变更</p>
      </div>
      <div className="changelog-timeline">
        {entries.map((entry) => {
          const major = isMajorVersion(entry.version)
          const isCollapsed = collapsed[entry.version]
          return (
            <div
              key={entry.version}
              className={`changelog-version ${major ? 'changelog-version--major' : 'changelog-version--minor'}`}
            >
              <div
                className="changelog-version-header"
                onClick={() => toggleCollapse(entry.version)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCollapse(entry.version) }}
              >
                <span className={`changelog-version-badge ${major ? 'changelog-version-badge--major' : 'changelog-version-badge--minor'}`}>
                  {entry.version}
                </span>
                <span className="changelog-version-date">{entry.date}</span>
                <span className={`changelog-collapse-icon ${isCollapsed ? '' : 'changelog-collapse-icon--open'}`}>
                  ▸
                </span>
              </div>
              <div className={`changelog-changes ${isCollapsed ? 'changelog-changes--collapsed' : ''}`}>
                {entry.changes.map((change, idx) => {
                  const cfg = TYPE_CONFIG[change.type] || TYPE_CONFIG.improve
                  return (
                    <div key={idx} className="changelog-item">
                      <span
                        className="changelog-type-tag"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                      <span className="changelog-item-text">{change.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}