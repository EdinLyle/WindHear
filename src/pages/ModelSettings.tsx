import { useEffect, useState } from 'react'
import {
  getModelEvalSettings,
  getMcpEvalSettings,
  getCodeAuditSettings,
  getSkillsAuditSettings,
  saveModelEvalSettings,
  saveMcpEvalSettings,
  saveCodeAuditSettings,
  saveSkillsAuditSettings,
  testModelEvalConnection,
  testMcpEvalConnection,
  testCodeAuditConnection,
  testSkillsAuditConnection,
} from '../api'
import type { ModelTabSettings, Provider } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const TABS = [
  { key: 'model-eval', label: '模型评估', desc: '用于模型评估的风险判定模型', settingsKey: 'modelEval' as const },
  { key: 'mcp-eval', label: 'MCP评估', desc: '用于MCP评估的AI审计模型', settingsKey: 'mcpEval' as const },
  { key: 'code-audit', label: '代码审计', desc: '用于代码安全审计的AI分析引擎', settingsKey: 'codeAudit' as const },
  { key: 'skills-audit', label: 'Skills审计', desc: '用于Skills安全审计的AI分析引擎', settingsKey: 'skillsAudit' as const },
] as const

/** 系统提示词说明信息：功能定位 + 影响说明 + 生效流程 + 内容建议 */
const PROMPT_INFO: Record<string, {
  role: string
  withoutDesc: string
  withDesc: string
  flowSteps: string[]
  contentTip: string
  example: string
}> = {
  'model-eval': {
    role: '定义AI裁判的评分标准和判定逻辑',
    withoutDesc: '使用内置默认评分规则，对模型输出进行通用的安全判定。',
    withDesc: '替代默认评分规则，按你自定义的标准判定模型输出是否违规。',
    flowSteps: ['系统提示词', '评分裁判', '0/1判定'],
    contentTip: '可自定义判定边界，如针对特定业务场景调整敏感词容忍度、对隐私/偏见/合规类风险收紧或放宽判定阈值。',
    example: '判定中额外关注个人隐私与合规红线，对涉及身份证号、手机号等PII信息的输出一律判1；对创意写作中的虚构暴力场景放宽判定。',
  },
  'mcp-eval': {
    role: '定义MCP风险评估的关注方向和判定偏好',
    withoutDesc: '使用内置风险评估策略，评估MCP Server的已知安全风险。',
    withDesc: '在内置策略基础上增强，聚焦你关注的风险类型和判定标准。',
    flowSteps: ['系统提示词', '风险识别', '可利用性复核', '风险评估报告'],
    contentTip: '可限定评估范围（如权限边界、数据流转、工具链注入、数据外带、Prompt 注入），或调整风险定级敏感度（收紧/放宽特定等级的判定条件）。',
    example: '聚焦权限提升与工具链恶意调用风险，对非敏感配置信息泄露降级处理；对涉及用户隐私数据的接口响应一律按高危判定。',
  },
  'code-audit': {
    role: '定义代码安全审计的分析策略和关注重点',
    withoutDesc: '3个Agent(Parser/Hunter/Validator)使用内置角色和规则，进行通用安全审计。',
    withDesc: '在Agent角色基础上追加审计策略，引导分析方向聚焦特定风险。',
    flowSteps: ['系统提示词', 'Parser(标记)', 'Hunter(挖掘)', 'Validator(验证)', '审计报告'],
    contentTip: '可指定重点审查的漏洞类型、忽略的目录、代码复杂度阈值，或调整审计粒度（如仅关注高危漏洞、忽略风格问题）。',
    example: '重点审查SQL注入和XSS，忽略测试目录和示例代码中的问题；对涉及支付/认证模块的代码提高审计粒度，按高危处理。',
  },
  'skills-audit': {
    role: '定义Skills安全审计的风险关注点和审查偏好',
    withoutDesc: '10个专业Agent使用内置风险类别规则，扫描20种Skills安全风险。',
    withDesc: '在Agent规则基础上追加策略，聚焦特定风险或降低某类误报。',
    flowSteps: ['系统提示词', '专业Agent集群', '风险发现'],
    contentTip: '可指定重点关注的风险类别、降低特定类型的误报率，或调整风险等级映射（如将某类风险统一升级/降级）。',
    example: '重点关注反向Shell和硬编码密钥，降低代码质量类的误报；对涉及外部网络请求和文件系统操作的Skills一律按高危审计。',
  },
}

function normalizeBaseUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return v
  if (!/^https?:\/\//i.test(v)) return `http://${v}`
  return v
}

function isValidUrl(raw: string): boolean {
  if (!raw.trim()) return true
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname
    if (!h) return false
    if (h === 'localhost') return true
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
    if (h.includes('.') && !h.startsWith('.') && !h.endsWith('.')) return true
    return false
  } catch {
    return false
  }
}

export function ModelSettings() {
  const [activeTab, setActiveTab] = useState<string>('model-eval')
  const [initialLoading, setInitialLoading] = useState(true)

  // 各选项卡默认超时（秒）
  const defaultTimeouts: Record<string, number> = {
    'model-eval': 90,
    'mcp-eval': 120,
    'code-audit': 90,
    'skills-audit': 90,
  }

  // 各选项卡状态（systemPrompt: null=未配置, 非null字符串=已配置）
  const [configs, setConfigs] = useState<Record<string, ModelTabSettings>>({
    'model-eval': { provider: 'openai', baseUrl: '', apiKey: '', model: '', systemPrompt: null, timeoutMs: 90 },
    'mcp-eval': { provider: 'openai', baseUrl: '', apiKey: '', model: '', systemPrompt: null, timeoutMs: 120 },
    'code-audit': { provider: 'openai', baseUrl: '', apiKey: '', model: '', systemPrompt: null, timeoutMs: 90 },
    'skills-audit': { provider: 'openai', baseUrl: '', apiKey: '', model: '', systemPrompt: null, timeoutMs: 90 },
  })

  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<Record<string, string>>({})
  const [ok, setOk] = useState<Record<string, string>>({})
  const [testMsg, setTestMsg] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [baseUrlError, setBaseUrlError] = useState<Record<string, string>>({})
  const [editSystemPrompt, setEditSystemPrompt] = useState<Record<string, boolean>>({})
  const [newSystemPrompt, setNewSystemPrompt] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      getModelEvalSettings(),
      getMcpEvalSettings(),
      getCodeAuditSettings(),
      getSkillsAuditSettings(),
    ])
      .then(([me, mcp, ca, sa]) => {
        setConfigs({
          'model-eval': { ...me, systemPrompt: me.systemPrompt || null, timeoutMs: Math.round((me.timeoutMs ?? 90000) / 1000) },
          'mcp-eval': { ...mcp, systemPrompt: mcp.systemPrompt || null, timeoutMs: Math.round((mcp.timeoutMs ?? 120000) / 1000) },
          'code-audit': { ...ca, systemPrompt: ca.systemPrompt || null, timeoutMs: Math.round((ca.timeoutMs ?? 90000) / 1000) },
          'skills-audit': { ...sa, systemPrompt: sa.systemPrompt || null, timeoutMs: Math.round((sa.timeoutMs ?? 90000) / 1000) },
        })
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))
  }, [])

  function updateConfig(tab: string, field: keyof ModelTabSettings, value: string) {
    setConfigs(prev => {
      const updated = { ...prev, [tab]: { ...prev[tab], [field]: field === 'timeoutMs' ? (parseInt(value) || defaultTimeouts[tab]) : value } }
      // 当 provider 切换时，自动填充默认 baseUrl
      if (field === 'provider') {
        const currentBaseUrl = prev[tab].baseUrl.trim()
        const defaultUrls: Record<string, string> = {
          ollama: 'http://localhost:11434',
          openai: 'https://api.openai.com',
          anthropic: 'https://api.anthropic.com',
          zhipu: 'https://open.bigmodel.cn/api/paas',
        }
        // 如果当前 baseUrl 为空，或者是某个 provider 的默认值，则自动切换
        const isDefaultUrl = Object.values(defaultUrls).includes(currentBaseUrl)
        if (!currentBaseUrl || isDefaultUrl) {
          updated[tab].baseUrl = defaultUrls[value] || ''
        }
      }
      return updated
    })
    clearMsgs(tab)
  }

  function clearMsgs(tab: string) {
    setTestMsg(prev => ({ ...prev, [tab]: '' }))
    setError(prev => ({ ...prev, [tab]: '' }))
    setOk(prev => ({ ...prev, [tab]: '' }))
  }

  async function onClearSystemPrompt(tab: string) {
    if (!window.confirm('确定要清空系统提示词吗？清空后将使用内置默认规则。')) return
    const cfg = configs[tab]
    setLoading(prev => ({ ...prev, [tab]: true }))
    try {
      const payload: ModelTabSettings = {
        provider: cfg.provider,
        baseUrl: cfg.baseUrl.trim(),
        apiKey: cfg.apiKey.trim(),
        model: cfg.model?.trim() || undefined,
        systemPrompt: '',
        timeoutMs: (cfg.timeoutMs ?? defaultTimeouts[tab]) * 1000,
      }
      const saveFns: Record<string, (s: ModelTabSettings) => Promise<{ ok: true }>> = {
        'model-eval': saveModelEvalSettings,
        'mcp-eval': saveMcpEvalSettings,
        'code-audit': saveCodeAuditSettings as (s: ModelTabSettings) => Promise<{ ok: true }>,
        'skills-audit': saveSkillsAuditSettings,
      }
      await saveFns[tab](payload)
      setConfigs(prev => ({ ...prev, [tab]: { ...prev[tab], systemPrompt: null } }))
      setEditSystemPrompt(prev => ({ ...prev, [tab]: false }))
      setNewSystemPrompt(prev => ({ ...prev, [tab]: '' }))
      setOk(prev => ({ ...prev, [tab]: '系统提示词已清空' }))
    } catch (e: unknown) {
      setError(prev => ({ ...prev, [tab]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }))
    }
  }

  async function onSave(tab: string) {
    const cfg = configs[tab]
    setError(prev => ({ ...prev, [tab]: '' }))
    setOk(prev => ({ ...prev, [tab]: '' }))
    setTestMsg(prev => ({ ...prev, [tab]: '' }))

    if (!cfg.provider.trim()) { setError(prev => ({ ...prev, [tab]: '模型类型不能为空' })); return }
    if (!cfg.baseUrl.trim()) { setError(prev => ({ ...prev, [tab]: 'Base URL 不能为空' })); return }
    if (!cfg.model?.trim()) { setError(prev => ({ ...prev, [tab]: '模型名称不能为空' })); return }
    if (editSystemPrompt[tab] && !newSystemPrompt[tab]?.trim()) {
      setError(prev => ({ ...prev, [tab]: '请输入新的系统提示词' }))
      return
    }

    setLoading(prev => ({ ...prev, [tab]: true }))
    try {
      const payload: ModelTabSettings = {
        provider: cfg.provider,
        baseUrl: cfg.baseUrl.trim(),
        apiKey: cfg.apiKey.trim(),
        model: cfg.model?.trim() || undefined,
        systemPrompt: editSystemPrompt[tab]
          ? newSystemPrompt[tab].trim()
          : cfg.systemPrompt ?? '',
        timeoutMs: (cfg.timeoutMs ?? defaultTimeouts[tab]) * 1000,
      }

      const saveFns: Record<string, (s: ModelTabSettings) => Promise<{ ok: true }>> = {
        'model-eval': saveModelEvalSettings,
        'mcp-eval': saveMcpEvalSettings,
        'code-audit': saveCodeAuditSettings as (s: ModelTabSettings) => Promise<{ ok: true }>,
        'skills-audit': saveSkillsAuditSettings,
      }
      await saveFns[tab](payload)
      setOk(prev => ({ ...prev, [tab]: '保存成功' }))
      setEditSystemPrompt(prev => ({ ...prev, [tab]: false }))

      if (editSystemPrompt[tab]) {
        setConfigs(prev => ({
          ...prev,
          [tab]: { ...prev[tab], systemPrompt: payload.systemPrompt },
        }))
        setNewSystemPrompt(prev => ({ ...prev, [tab]: '' }))
      }
    } catch (e: unknown) {
      setError(prev => ({ ...prev, [tab]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }))
    }
  }

  async function onTest(tab: string) {
    const cfg = configs[tab]
    setTesting(prev => ({ ...prev, [tab]: true }))
    setError(prev => ({ ...prev, [tab]: '' }))
    setOk(prev => ({ ...prev, [tab]: '' }))
    setTestMsg(prev => ({ ...prev, [tab]: '' }))

    if (!cfg.baseUrl.trim()) {
      setTestMsg(prev => ({ ...prev, [tab]: 'Base URL 不能为空' }))
      setTesting(prev => ({ ...prev, [tab]: false }))
      return
    }
    if (!isValidUrl(normalizeBaseUrl(cfg.baseUrl))) {
      setTestMsg(prev => ({ ...prev, [tab]: 'Base URL 格式不正确' }))
      setTesting(prev => ({ ...prev, [tab]: false }))
      return
    }
    if (!cfg.model?.trim()) {
      setTestMsg(prev => ({ ...prev, [tab]: '模型名称不能为空' }))
      setTesting(prev => ({ ...prev, [tab]: false }))
      return
    }

    try {
      const testFns: Record<string, () => Promise<{ ok: boolean; latencyMs?: number; error?: string }>> = {
        'model-eval': testModelEvalConnection,
        'mcp-eval': testMcpEvalConnection,
        'code-audit': testCodeAuditConnection,
        'skills-audit': testSkillsAuditConnection,
      }
      const resp = await testFns[tab]()
      if (resp.ok) {
        setTestMsg(prev => ({ ...prev, [tab]: `连通测试：OK（${resp.latencyMs ?? 0}ms）` }))
      } else {
        const errMsg = resp.error ?? 'unknown'
        const display = errMsg.toLowerCase().includes('model is required') && cfg.model?.trim() ? '模型不存在' : errMsg
        setTestMsg(prev => ({ ...prev, [tab]: `连通测试：失败（${display}）` }))
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const display = errMsg.toLowerCase().includes('model is required') && cfg.model?.trim() ? '模型不存在' : errMsg
      setTestMsg(prev => ({ ...prev, [tab]: `连通测试：失败（${display}）` }))
    } finally {
      setTesting(prev => ({ ...prev, [tab]: false }))
    }
  }

  if (initialLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: '模型设置' }]} />
        <section className="card">
          <div style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>加载中...</div>
        </section>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '模型设置' }]} />

      {/* Tab 选项卡 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e8ecf1', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 24px',
              border: 'none',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#2c3e50' : '#7f8c8d',
              borderBottom: activeTab === tab.key ? '2px solid #3498db' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 选项卡内容 */}
      {TABS.map(tab => {
        if (activeTab !== tab.key) return null
        const cfg = configs[tab.key]
        return (
          <section className="card" key={tab.key}>
            <div className="cardHeader">
              <div>{tab.desc}</div>
              <div className="row">
                <button className="btn secondary" type="button" onClick={() => onTest(tab.key)} disabled={loading[tab.key] || testing[tab.key]}>
                  {testing[tab.key] ? '测试中…' : '测试连通性'}
                </button>
                <button className="btn" onClick={() => onSave(tab.key)} disabled={loading[tab.key]}>
                  {loading[tab.key] ? '保存中…' : '保存'}
                </button>
              </div>
            </div>

            <div className="cardGrid">
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>模型类型</div>
                <select
                  className="select"
                  value={cfg.provider}
                  onChange={(e) => { updateConfig(tab.key, 'provider', e.target.value as Provider) }}
                >
                  <option value="ollama">Ollama（/api/chat）</option>
                  <option value="openai">OpenAI（/v1/chat/completions）</option>
                  <option value="anthropic">Anthropic（/v1/messages）</option>
                  <option value="zhipu">智谱GLM（/v4/chat/completions）</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>Base URL</div>
                <input
                  className="input"
                  value={cfg.baseUrl}
                  onChange={(e) => { updateConfig(tab.key, 'baseUrl', e.target.value); setBaseUrlError(prev => ({ ...prev, [tab.key]: '' })) }}
                  onBlur={() => {
                    const normalized = normalizeBaseUrl(cfg.baseUrl)
                    if (normalized !== cfg.baseUrl) {
                      setConfigs(prev => ({ ...prev, [tab.key]: { ...prev[tab.key], baseUrl: normalized } }))
                    }
                    if (normalized && !isValidUrl(normalized)) {
                      setBaseUrlError(prev => ({ ...prev, [tab.key]: 'URL 格式不正确，示例：http://localhost:11434' }))
                    } else {
                      setBaseUrlError(prev => ({ ...prev, [tab.key]: '' }))
                    }
                  }}
                />
                {baseUrlError[tab.key] && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>{baseUrlError[tab.key]}</div>}
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>模型名称（model）</div>
                <input
                  className="input"
                  maxLength={30}
                  value={cfg.model || ''}
                  onChange={(e) => updateConfig(tab.key, 'model', e.target.value)}
                />
                {(cfg.model?.length ?? 0) >= 30 && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>模型名称不能超过 30 个字符</div>}
              </div>
              {(cfg.provider === 'openai' || cfg.provider === 'anthropic' || cfg.provider === 'zhipu') && (
                <div style={{ gridColumn: 'span 6' }}>
                  <div className="muted" style={{ marginBottom: 6 }}>API Key</div>
                  <input
                    type="password"
                    className="input"
                    value={cfg.apiKey}
                    onChange={(e) => updateConfig(tab.key, 'apiKey', e.target.value)}
                  />
                </div>
              )}
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>请求超时(秒)</div>
                <input
                  className="input"
                  type="number"
                  min={10}
                  max={600}
                  value={cfg.timeoutMs ?? defaultTimeouts[tab.key]}
                  onChange={(e) => updateConfig(tab.key, 'timeoutMs', e.target.value)}
                />
                <div style={{ color: '#95a5a6', fontSize: 12, marginTop: 4 }}>范围 10~600 秒，默认 {defaultTimeouts[tab.key]} 秒</div>
              </div>
              <div style={{ gridColumn: 'span 12' }}>
                {/* 系统提示词说明卡片 */}
                {(() => {
                  const info = PROMPT_INFO[tab.key]
                  if (!info) return null
                  return (
                    <div style={{
                      background: '#f8f9fb',
                      border: '1px solid #e8ecf1',
                      borderRadius: 8,
                      padding: '14px 18px',
                      marginBottom: 14,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2c3e50', marginBottom: 8 }}>
                        系统提示词作用：{info.role}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#555' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#95a5a6', fontWeight: 600 }}>未配置：</span>
                          {info.withoutDesc}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#3498db', fontWeight: 600 }}>已配置：</span>
                          {info.withDesc}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10, flexWrap: 'wrap' }}>
                        {info.flowSteps.map((step, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: i === 0 ? 90 : 70,
                              height: 26,
                              padding: '0 10px',
                              borderRadius: 13,
                              fontSize: 11,
                              fontWeight: 500,
                              background: i === 0 ? '#3498db' : i === info.flowSteps.length - 1 ? '#27ae60' : '#ecf0f1',
                              color: i === 0 || i === info.flowSteps.length - 1 ? '#fff' : '#555',
                              whiteSpace: 'nowrap',
                            }}>
                              {step}
                            </span>
                            {i < info.flowSteps.length - 1 && (
                              <span style={{ color: '#bdc3c7', fontSize: 16, margin: '0 4px' }}>→</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#7f8c8d' }}>
                        <span style={{ fontWeight: 600 }}>内容建议：</span>{info.contentTip}
                        <span style={{ display: 'block', marginTop: 4, fontStyle: 'italic', color: '#95a5a6' }}>
                          示例：{info.example}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="muted" style={{ marginBottom: 6 }}>系统提示词</div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="badge" style={cfg.systemPrompt ? {} : { background: '#ecf0f1', color: '#95a5a6' }}>{cfg.systemPrompt ? '已配置' : '未配置'}</span>
                  <div className="row" style={{ gap: 8 }}>
                    {cfg.systemPrompt && (
                      <button
                        className="btn secondary"
                        onClick={() => onClearSystemPrompt(tab.key)}
                        disabled={loading[tab.key]}
                        type="button"
                        style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
                      >
                        清空提示词
                      </button>
                    )}
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setEditSystemPrompt(prev => {
                          const nextVal = !prev[tab.key]
                          if (nextVal) {
                            setNewSystemPrompt(pp => ({ ...pp, [tab.key]: cfg.systemPrompt || '' }))
                          }
                          return { ...prev, [tab.key]: nextVal }
                        })
                        setError(prev => ({ ...prev, [tab.key]: '' }))
                        setOk(prev => ({ ...prev, [tab.key]: '' }))
                      }}
                      type="button"
                    >
                      {editSystemPrompt[tab.key] ? '取消修改' : '修改系统提示词'}
                    </button>
                  </div>
                </div>
                {editSystemPrompt[tab.key] ? (
                  <textarea
                    className="textarea"
                    value={newSystemPrompt[tab.key] || ''}
                    onChange={(e) => setNewSystemPrompt(prev => ({ ...prev, [tab.key]: e.target.value }))}
                    placeholder="请输入新的系统提示词"
                  />
                ) : null}
              </div>
            </div>

            {testMsg[tab.key] ? <div className="muted" style={{ marginTop: 10 }}>{testMsg[tab.key]}</div> : null}
            {error[tab.key] ? <div className="muted" style={{ marginTop: 10, color: '#e74c3c' }}>{error[tab.key]}</div> : null}
            {ok[tab.key] ? <div className="muted" style={{ marginTop: 10, color: '#27ae60' }}>{ok[tab.key]}</div> : null}
          </section>
        )
      })}
    </div>
  )
}