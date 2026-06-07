import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Evaluations } from './Evaluations'
import { McpScans } from './McpScans'
import { CodeAuditList } from './CodeAuditList'
import { SkillsAuditList } from './SkillsAuditList'
import { Breadcrumb } from '../components/Breadcrumb'

type TabType = 'model' | 'mcp' | 'audit' | 'skills'

const tabConfig: Array<{ key: TabType; label: string; param: string }> = [
  { key: 'model', label: 'LLM 模型评估', param: '' },
  { key: 'mcp', label: 'MCP 风险评估', param: 'mcp' },
  { key: 'audit', label: '代码安全审计', param: 'audit' },
  { key: 'skills', label: 'Skills 安全审计', param: 'skills' },
]

export function EvaluationCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'mcp') return 'mcp'
    if (tab === 'audit') return 'audit'
    if (tab === 'skills') return 'skills'
    return 'model'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'mcp' || tab === 'audit' || tab === 'skills') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tab)
    }
  }, [searchParams])

  function handleTabChange(tab: TabType) {
    setActiveTab(tab)
    if (tab === 'model') {
      setSearchParams({})
    } else {
      setSearchParams({ tab })
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '评估管理' }]} />

      {/* 标签切换 */}
      <div style={{
        display: 'flex',
        gap: 4,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 4,
        background: 'var(--secondary)',
        marginBottom: 24,
        width: 'fit-content',
      }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      {activeTab === 'model' ? <Evaluations /> : activeTab === 'mcp' ? <McpScans /> : activeTab === 'audit' ? <CodeAuditList hideBreadcrumb /> : <SkillsAuditList hideBreadcrumb />}
    </div>
  )
}