import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCodeAudit, getCodeAuditSettings, testModelConnection, uploadCodeAuditFile } from '../api'
import type { Provider } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

function normalizeBaseUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return v
  if (!/^https?:\/\//i.test(v)) return `http://${v}`
  return v
}

export function NewCodeAudit() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [initialLoading, setInitialLoading] = useState(true)
  const [name, setName] = useState(`代码安全审计-${new Date().toLocaleString()}`)
  const [sourceType, setSourceType] = useState<'zip' | 'git'>('zip')
  const [file, setFile] = useState<File | null>(null)
  const [gitUrl, setGitUrl] = useState('')
  const [language, setLanguage] = useState('')
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [timeoutSec, setTimeoutSec] = useState<number>(90)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testPassed, setTestPassed] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    getCodeAuditSettings()
      .then((settings) => {
        if (!settings) return
        setProvider(settings.provider)
        setBaseUrl(settings.baseUrl)
        setModel(settings.model || '')
        setApiKey(settings.apiKey || '')
        if (settings.timeoutMs) {
          setTimeoutSec(Math.round(settings.timeoutMs / 1000))
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))
  }, [])

  useEffect(() => {
    setTestPassed(false)
    setTestResult('')
    setError('')
  }, [provider, baseUrl, apiKey, model])

  if (initialLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: '代码安全审计', path: '/code-audit' }, { label: '新建代码安全审计' }]} />
        <section className="card">
          <div style={{ padding: 20, textAlign: 'center', color: '#7f8c8d' }}>加载中...</div>
        </section>
      </div>
    )
  }

  async function onTestConnection() {
    setError('')
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }

    setTesting(true)
    setTestResult('')
    setTestPassed(false)

    try {
      const response = await testModelConnection({
        provider,
        baseUrl: normalizeBaseUrl(baseUrl),
        apiKey: apiKey.trim() || undefined,
        model: model.trim(),
      })
      if (response.ok) {
        setTestResult(`模型连通：OK（${response.latencyMs ?? 0}ms）`)
        setTestPassed(true)
      } else {
        setTestResult(`模型连通：失败（${response.error ?? 'unknown'}）`)
      }
    } catch (err: unknown) {
      setTestResult(`模型连通：失败（${err instanceof Error ? err.message : String(err)}）`)
    } finally {
      setTesting(false)
    }
  }

  async function onSubmit() {
    if (submitting) return
    setError('')

    if (!name.trim()) { setError('任务名称不能为空'); return }
    if (sourceType === 'zip' && !file) { setError('请上传 ZIP 文件'); return }
    if (sourceType === 'git' && !gitUrl.trim()) { setError('请输入 Git 地址'); return }
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }

    setSubmitting(true)

    try {
      let fileId: string | undefined
      if (sourceType === 'zip' && file) {
        const uploadResult = await uploadCodeAuditFile(file)
        fileId = uploadResult.fileId
      }

      const result = await createCodeAudit({
        name: name.trim(),
        sourceType,
        fileId,
        sourceUrl: sourceType === 'git' ? gitUrl.trim() : undefined,
        language: language.trim() || undefined,
        provider,
        baseUrl: normalizeBaseUrl(baseUrl),
        apiKey: apiKey.trim() || undefined,
        model: model.trim(),
        timeoutMs: timeoutSec * 1000,
        filename: sourceType === 'zip' && file ? file.name : undefined,
      })

      nav(`/code-audit/${result.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '代码安全审计', path: '/code-audit' }, { label: '新建代码安全审计' }]} />

      <div className="cardGrid">
        <section className="card" style={{ gridColumn: 'span 12' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="cardHeader"><div>创建审计任务</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!testPassed && <span className="muted" style={{ fontSize: 12 }}>请先测试模型连通性</span>}
              <button className="btn" onClick={() => void onSubmit()} disabled={!testPassed || submitting}>
                {submitting ? '创建中...' : '开始审计'}
              </button>
            </div>
          </div>

          <div className="cardGrid" style={{ marginTop: 16 }}>
            {/* 任务名称 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>任务名称</div>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="请输入任务名称" />
            </div>

            {/* 源码来源 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>源码来源</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="sourceType" checked={sourceType === 'zip'} onChange={() => setSourceType('zip')} />
                  ZIP 上传
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="sourceType" checked={sourceType === 'git'} onChange={() => setSourceType('git')} />
                  Git 地址
                </label>
              </div>
            </div>

            {/* ZIP 上传 */}
            {sourceType === 'zip' && (
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>项目文件（ZIP 格式，最大 50MB）</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (!f.name.toLowerCase().endsWith('.zip')) {
                      setError('仅支持上传 .zip 格式文件')
                      e.target.value = ''
                      return
                    }
                    setError('')
                    setFile(f)
                  }}
                />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn outline" onClick={() => fileRef.current?.click()}>选择文件</button>
                  {file && <span style={{ fontSize: 14 }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</span>}
                </div>
              </div>
            )}

            {/* Git 地址 */}
            {sourceType === 'git' && (
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>Git 地址（HTTPS）</div>
                <input className="input" value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo.git" />
              </div>
            )}

            {/* 目标语言 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>目标语言（可选，留空自动检测）</div>
              <select className="select" value={language} onChange={e => setLanguage(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">自动检测</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="go">Go</option>
              </select>
            </div>

            {/* 模型类型 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>模型类型</div>
              <select className="select" value={provider} onChange={e => setProvider(e.target.value as Provider)} style={{ minWidth: 250 }}>
                <option value="ollama">Ollama (/api/chat)</option>
                <option value="openai">OpenAI (/v1/chat/completions)</option>
                <option value="anthropic">Anthropic (/v1/messages)</option>
                <option value="zhipu">智谱GLM (/v4/chat/completions)</option>
              </select>
            </div>

            {/* 模型名称 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>模型名称</div>
              <input className="input" maxLength={50} value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o / qwen2.5:7b" />
            </div>

            {/* Base URL */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>Base URL</div>
              <input className="input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:11434" />
            </div>

            {/* API Key */}
            {(provider === 'openai' || provider === 'anthropic' || provider === 'zhipu') && (
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>API Key</div>
                <input className="input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
            )}

            {/* 请求超时 */}
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>请求超时(秒)</div>
              <input
                className="input"
                type="number"
                min={10}
                max={600}
                value={timeoutSec}
                onChange={e => setTimeoutSec(Math.max(10, Math.min(600, Number(e.target.value) || 90)))}
              />
              <div style={{ color: '#95a5a6', fontSize: 12, marginTop: 4 }}>范围 10~600 秒，默认 90 秒</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn secondary" onClick={() => void onTestConnection()} disabled={testing || submitting}>
              {testing ? '测试中...' : '测试连通性'}
            </button>
            {testResult && <div className="muted" style={{ marginTop: 8 }}>{testResult}</div>}
          </div>
        </section>

        {error && (
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <div style={{ color: 'var(--destructive)' }}>{error}</div>
          </section>
        )}
      </div>
    </div>
  )
}