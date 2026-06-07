import { useEffect, useMemo, useRef, useState } from 'react'
import { bulkDeletePrompts, createPrompt, deletePrompt, importPrompts, listPrompts, listCollections, createCollection, deleteCollection } from '../api'
import type { LibraryType, PromptItem, PromptCollection } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const tabs: Array<{ key: LibraryType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'tc260', label: 'TC260测试集' },
  { key: 'general', label: '通用测试集' },
  { key: 'custom', label: '自定义测试集' },
]

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export function Arsenal() {
  const [library, setLibrary] = useState<LibraryType>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PromptItem[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)

  const [riskType, setRiskType] = useState('')
  const [riskSubType, setRiskSubType] = useState('')
  const [prompt, setPrompt] = useState('')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement | null>(null)
  const scrollYRef = useRef(0)
  const shouldRestoreScrollRef = useRef(false)

  // collection 相关状态
  const [collections, setCollections] = useState<PromptCollection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  const [showCreateCollection, setShowCreateCollection] = useState(false)
  const [newCollName, setNewCollName] = useState('')
  const [newCollDesc, setNewCollDesc] = useState('')
  const [addFormCollectionId, setAddFormCollectionId] = useState<string>('')

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  async function loadCollections(lib?: LibraryType) {
    const l = lib ?? library
    if (l === 'all') {
      setCollections([])
      return
    }
    try {
      const cols = await listCollections(l)
      setCollections(cols)
    } catch {
      setCollections([])
    }
  }

  async function refresh(nextLib?: LibraryType, nextPage?: number, nextPageSize?: number, nextCollectionId?: string) {
    const lib = nextLib ?? library
    const p = nextPage ?? page
    const ps = nextPageSize ?? pageSize
    const cid = nextCollectionId !== undefined ? nextCollectionId : selectedCollectionId
    setLoading(true)
    setError('')
    try {
      const resp = await listPrompts(lib, query.trim(), p, ps, cid || undefined)
      setItems(resp.items)
      setTotal(resp.total)
      setSelected({})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    listPrompts('all', '', 1, pageSize)
      .then((resp) => {
        setItems(resp.items)
        setTotal(resp.total)
        setSelected({})
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!shouldRestoreScrollRef.current) return
      shouldRestoreScrollRef.current = false
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollYRef.current)
      })
    }
  }, [loading])

  async function onAdd() {
    if (library === 'all') return
    if (!riskType.trim() || !prompt.trim()) return
    if (library === 'tc260' && !riskSubType.trim()) return
    const payload: { library: Exclude<LibraryType, 'all'>; riskType: string; prompt: string; riskSubType?: string; collectionId?: string } = {
      library: library as Exclude<LibraryType, 'all'>,
      riskType: riskType.trim(),
      prompt: prompt.trim(),
    }
    if (library === 'tc260') {
      payload.riskSubType = riskSubType.trim()
    }
    const cid = addFormCollectionId || selectedCollectionId
    if (cid) {
      payload.collectionId = cid
    }
    await createPrompt(payload)
    setRiskType('')
    setRiskSubType('')
    setPrompt('')
    setAddFormCollectionId('')
    setPage(1)
    await refresh(undefined, 1)
    void loadCollections()
  }

  async function onBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) return
    await bulkDeletePrompts(selectedIds)
    setPage(1)
    await refresh(undefined, 1)
    void loadCollections()
  }

  async function onDeleteOne(id: string) {
    if (!confirm('确定要删除这条记录吗？')) return
    await deletePrompt(id)
    await refresh()
    void loadCollections()
  }

  async function onImportFile(file: File) {
    const text = await file.text()
    if (library === 'all') return
    const cid = selectedCollectionId || undefined
    const resp = await importPrompts({ library, csv: text, collectionId: cid })
    setPage(1)
    await refresh(undefined, 1)
    void loadCollections()
    setError(`导入完成：新增 ${resp.inserted} 条`)
  }

  function onTabChange(key: LibraryType) {
    shouldRestoreScrollRef.current = false
    setLibrary(key)
    setPage(1)
    setSelectedCollectionId('')
    setAddFormCollectionId('')
    void refresh(key, 1, undefined, '')
    void loadCollections(key)
  }

  function onCollectionChange(cid: string) {
    setSelectedCollectionId(cid)
    setPage(1)
    void refresh(undefined, 1, undefined, cid)
  }

  function onSearch() {
    shouldRestoreScrollRef.current = false
    setPage(1)
    void refresh(undefined, 1)
  }

  function onPageChange(newPage: number) {
    scrollYRef.current = window.scrollY
    shouldRestoreScrollRef.current = true
    setPage(newPage)
    void refresh(undefined, newPage)
  }

  function onPageSizeChange(newSize: typeof pageSize) {
    scrollYRef.current = window.scrollY
    shouldRestoreScrollRef.current = true
    setPageSize(newSize)
    setPage(1)
    void refresh(undefined, 1, newSize)
  }

  async function onCreateCollection() {
    if (!newCollName.trim() || library === 'all') return
    try {
      const resp = await createCollection({ name: newCollName.trim(), library: library as Exclude<LibraryType, 'all'>, description: newCollDesc.trim() || undefined })
      setShowCreateCollection(false)
      setNewCollName('')
      setNewCollDesc('')
      setSelectedCollectionId(resp.id)
      void loadCollections()
      void refresh(undefined, 1, undefined, resp.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onDeleteCollection(id: string) {
    if (!confirm('确定要删除此测试集分组吗？分组下的提示词将不会被删除。')) return
    try {
      await deleteCollection(id)
      if (selectedCollectionId === id) {
        setSelectedCollectionId('')
        void refresh(undefined, 1, undefined, '')
      }
      void loadCollections()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const colSpanCount = (library === 'all' || library === 'tc260') ? 8 : 7

  return (
    <div>
      <Breadcrumb items={[{ label: '测试集' }]} />

      <section className="card">
        {/* 顶部操作栏 */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                共 {total} 条 · 当前筛选：{formatLibrary(library)}{selectedCollectionId && collections.find(c => c.id === selectedCollectionId) ? ` / ${collections.find(c => c.id === selectedCollectionId)!.name}` : ''}
              </div>
            </div>
            <div className="row">
              <button className="btn outline" onClick={() => refresh()} disabled={loading}>
                <span style={{ marginRight: 6 }}>↻</span>
                刷新
              </button>
              <a className="btn outline" href={`/api/prompts/export?library=${encodeURIComponent(library)}${selectedCollectionId ? `&collectionId=${encodeURIComponent(selectedCollectionId)}` : ''}`}>
                <span style={{ marginRight: 6 }}>↓</span>
                导出
              </a>
              {library !== 'all' && (
                <>
                  <a className="btn outline" href={`/api/prompts/template?library=${encodeURIComponent(library)}`}>
                    <span style={{ marginRight: 6 }}>↓</span>
                    下载模板
                  </a>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      if (!f.name.toLowerCase().endsWith('.csv')) {
                        setError('仅支持导入 .csv 格式文件')
                        e.target.value = ''
                        return
                      }
                      void onImportFile(f)
                      e.target.value = ''
                    }}
                  />
                  <button className="btn outline" onClick={() => fileRef.current?.click()}>
                    <span style={{ marginRight: 6 }}>↑</span>
                    导入
                  </button>
                </>
              )}
              {library !== 'all' && (
                <button className="btn" onClick={() => {
                  const addSection = document.getElementById('add-prompt-section')
                  if (addSection) addSection.scrollIntoView({ behavior: 'smooth' })
                }}>
                  <span style={{ marginRight: 6 }}>+</span>
                  新增提示词
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div style={{ paddingTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
            {/* 库类型筛选 */}
            <div className="row" style={{ gap: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 2,
                background: 'var(--secondary)'
              }}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onTabChange(t.key)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      background: library === t.key ? 'var(--primary)' : 'transparent',
                      color: library === t.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      fontWeight: library === t.key ? 600 : 400,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <button className="btn danger sm" onClick={onBulkDelete} disabled={loading}>
                  批量删除（{selectedIds.length}）
                </button>
              )}
            </div>
            {/* 搜索框 */}
            <div style={{ display: 'flex', gap: 8, width: 280, flexShrink: 0 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value.trimStart())}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="搜索风险分类或提示词..."
                style={{ flex: 1, minWidth: 'unset' }}
              />
              <button className="btn outline" onClick={onSearch}>
                搜索
              </button>
            </div>
          </div>

          {/* 二级 collection 筛选行 */}
          {library !== 'all' && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>测试集：</span>
              <button
                onClick={() => onCollectionChange('')}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: !selectedCollectionId ? 'var(--primary)' : 'transparent',
                  color: !selectedCollectionId ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  fontWeight: !selectedCollectionId ? 600 : 400,
                  transition: 'all 150ms ease',
                }}
              >
                全部
              </button>
              {collections.map((col) => (
                <div key={col.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => onCollectionChange(col.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedCollectionId === col.id ? 'var(--primary)' : 'transparent',
                      color: selectedCollectionId === col.id ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      fontWeight: selectedCollectionId === col.id ? 600 : 400,
                      transition: 'all 150ms ease',
                    }}
                  >
                    {col.name}{col.promptCount > 0 ? ` (${col.promptCount})` : ''}
                  </button>
                  {library === 'custom' && (
                    <button
                      onClick={() => onDeleteCollection(col.id)}
                      style={{
                        padding: '2px 4px',
                        fontSize: 11,
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        lineHeight: 1,
                      }}
                      title="删除分组"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {library === 'custom' && (
                <button
                  onClick={() => setShowCreateCollection(!showCreateCollection)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border)',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    transition: 'all 150ms ease',
                  }}
                >
                  + 新建测试集
                </button>
              )}
            </div>
          )}

          {/* 新建测试集内联表单 */}
          {showCreateCollection && library === 'custom' && (
            <div style={{
              marginTop: 10,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <span className="muted" style={{ fontSize: 12 }}>名称：</span>
              <input
                className="input"
                value={newCollName}
                onChange={(e) => setNewCollName(e.target.value)}
                placeholder="测试集分组名称"
                style={{ width: 180, minWidth: 'unset', fontSize: 13 }}
              />
              <span className="muted" style={{ fontSize: 12 }}>描述：</span>
              <input
                className="input"
                value={newCollDesc}
                onChange={(e) => setNewCollDesc(e.target.value)}
                placeholder="可选描述"
                style={{ width: 200, minWidth: 'unset', fontSize: 13 }}
              />
              <button className="btn sm" onClick={onCreateCollection} disabled={!newCollName.trim()}>
                创建
              </button>
              <button className="btn outline sm" onClick={() => { setShowCreateCollection(false); setNewCollName(''); setNewCollDesc('') }}>
                取消
              </button>
            </div>
          )}
        </div>

        {error && <div className="muted" style={{ marginTop: 12, color: 'var(--destructive)' }}>{error}</div>}
      </section>

      {/* 新增提示词表单 */}
      {library !== 'all' && (
        <section id="add-prompt-section" className="card" style={{ marginTop: 14 }}>
          <div className="cardHeader">
            <div className="cardTitle">新增提示词</div>
            <span className="muted" style={{ fontSize: 12 }}>写入到 {formatLibrary(library)}</span>
          </div>
          <div className="cardGrid">
            <div style={{ gridColumn: library === 'tc260' ? 'span 3' : 'span 4' }}>
              <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>一级分类</div>
              <input className="input" value={riskType} onChange={(e) => setRiskType(e.target.value)} style={{ width: '100%', minWidth: 'unset' }} />
            </div>
            {library === 'tc260' && (
              <div style={{ gridColumn: 'span 3' }}>
                <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>二级分类</div>
                <input className="input" value={riskSubType} onChange={(e) => setRiskSubType(e.target.value)} style={{ width: '100%', minWidth: 'unset' }} />
              </div>
            )}
            <div style={{ gridColumn: library === 'tc260' ? 'span 3' : 'span 4' }}>
              <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>所属测试集</div>
              <select
                className="select"
                value={addFormCollectionId}
                onChange={(e) => setAddFormCollectionId(e.target.value)}
                style={{ width: '100%', minWidth: 'unset', padding: '6px 10px', height: 32 }}
              >
                <option value="">不选择（默认）</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: library === 'tc260' ? 'span 3' : 'span 4' }}>
              <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>提示词（prompt）</div>
              <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: '100%', minWidth: 'unset' }} />
            </div>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn" onClick={onAdd} disabled={!riskType.trim() || !prompt.trim() || (library === 'tc260' && !riskSubType.trim())}>
                添加
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 数据表格 */}
      <section className="card" style={{ marginTop: 14 }}>
        <table className="table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((it) => !!selected[it.id])}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next: Record<string, boolean> = { ...prev }
                      for (const it of items) next[it.id] = e.target.checked
                      return next
                    })
                  }}
                />
              </th>
              <th style={{ width: 100 }}>库</th>
              <th style={{ width: 120 }}>测试集</th>
              <th style={{ width: 160, minWidth: 160, maxWidth: 160 }}>一级分类</th>
              {(library === 'all' || library === 'tc260') && <th style={{ width: 160, minWidth: 160, maxWidth: 160 }}>二级分类</th>}
              <th>提示词</th>
              <th style={{ width: 160 }}>时间</th>
              <th style={{ width: 80, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpanCount} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  暂无数据
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`badge ${getBadgeVariant(it.library)}`}>{formatLibrary(it.library)}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.collectionName || '-'}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13, maxWidth: 160, wordBreak: 'break-all' }}>
                    {it.riskType.length > 30 ? (
                      expandedIds.has(`${it.id}-rt`) ? (
                        <>
                          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', wordBreak: 'break-all' }}>{it.riskType}</div>
                          <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-rt`); return n })}>收起</span>
                        </>
                      ) : (
                        <>
                          {it.riskType.slice(0, 30)}...
                          <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-rt`))}>详情</span>
                        </>
                      )
                    ) : it.riskType}
                  </td>
                  {(library === 'all' || library === 'tc260') && (
                    <td className="muted" style={{ fontSize: 13, maxWidth: 160, wordBreak: 'break-all' }}>
                      {!it.riskSubType ? '-' : it.riskSubType.length > 30 ? (
                        expandedIds.has(`${it.id}-rst`) ? (
                          <>
                            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', wordBreak: 'break-all' }}>{it.riskSubType}</div>
                            <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-rst`); return n })}>收起</span>
                          </>
                        ) : (
                          <>
                            {it.riskSubType.slice(0, 30)}...
                            <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-rst`))}>详情</span>
                          </>
                        )
                      ) : it.riskSubType}
                    </td>
                  )}
                  <td style={{ lineHeight: 1.6, fontSize: 13 }}>
                    {it.prompt.length > 100 ? (
                      expandedIds.has(it.id) ? (
                        <>
                          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{it.prompt}</div>
                          <span
                            style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                            onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(it.id); return n })}
                          >
                            收起
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{it.prompt.slice(0, 100)}...</span>
                          <span
                            style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                            onClick={() => setExpandedIds((s) => new Set(s).add(it.id))}
                          >
                            详情
                          </span>
                        </>
                      )
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{it.prompt}</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(it.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn danger sm" onClick={() => onDeleteOne(it.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 分页栏 */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div className="muted" style={{ fontSize: 13 }}>
            第 {page}/{totalPages} 页 · 共 {total} 条
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select
              className="select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as typeof pageSize)}
              style={{ minWidth: 100, padding: '6px 10px', height: 32 }}
            >
              {PAGE_SIZE_OPTIONS.map((v) => (
                <option key={v} value={v}>每页 {v} 条</option>
              ))}
            </select>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => onPageChange(1)}>
              首页
            </button>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
              上一页
            </button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
              下一页
            </button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
              末页
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function formatLibrary(lib: string) {
  if (lib === 'all') return '全部'
  if (lib === 'tc260') return 'TC260测试集'
  if (lib === 'general') return '通用测试集'
  if (lib === 'custom') return '自定义测试集'
  return lib
}

function getBadgeVariant(lib: string) {
  if (lib === 'tc260') return 'info'
  if (lib === 'general') return 'warning'
  if (lib === 'custom') return 'success'
  return ''
}