import { useState, useMemo, useCallback } from 'react'
import type { TokenReceiptData } from '../types'
import { fetchTokenReceipt, fetchSessionReceipt } from '../api'
import { renderAsciiReceipt } from '../utils/receiptRenderer'
import { generateHtmlReceipt } from '../utils/receiptHtml'
import { downloadImageReceipt } from '../utils/receiptImage'

export interface UseTokenReceiptReturn {
  receiptData: TokenReceiptData | null
  sessionData: TokenReceiptData[] | null
  loading: boolean
  error: string | null
  language: 'zh' | 'en'
  setLanguage: (lang: 'zh' | 'en') => void
  asciiReceipt: string
  fetchReceipt: (taskId: string, module: string) => Promise<void>
  fetchSessionReceipt: (taskId: string, sessionId: string) => Promise<void>
  downloadHtml: () => void
  downloadImage: () => void
}

export function useTokenReceipt(): UseTokenReceiptReturn {
  const [receiptData, setReceiptData] = useState<TokenReceiptData | null>(null)
  const [sessionData, setSessionData] = useState<TokenReceiptData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')

  const asciiReceipt = useMemo(() => {
    if (!receiptData) return ''
    try {
      return renderAsciiReceipt(receiptData, language)
    } catch {
      return ''
    }
  }, [receiptData, language])

  const fetchReceipt = useCallback(async (taskId: string, _module: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTokenReceipt(taskId)
      if (!data || data.length === 0) {
        setError('该任务的 Token 数据暂时无法获取')
        setReceiptData(null)
      } else {
        // 取最新一条作为单条小票数据
        setReceiptData(data[data.length - 1])
        setSessionData(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败，请重试')
      setReceiptData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSessionReceiptData = useCallback(async (taskId: string, sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSessionReceipt(taskId, sessionId)
      if (!data || data.length === 0) {
        setError('该会话的 Token 数据暂时无法获取')
        setReceiptData(null)
        setSessionData(null)
      } else {
        setSessionData(data)
        setReceiptData(data[data.length - 1])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败，请重试')
      setReceiptData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const downloadHtml = useCallback(() => {
    if (!receiptData) return
    try {
      const html = generateHtmlReceipt(receiptData, language)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const timestamp = Date.now()
      const filename = `token-receipt-${receiptData.taskId}-${timestamp}.html`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('下载 HTML 小票失败:', err)
    }
  }, [receiptData, language])

  const downloadImage = useCallback(async () => {
    if (!receiptData) return
    try {
      await downloadImageReceipt(receiptData, language, receiptData.taskId)
    } catch (err) {
      console.error('下载 PNG 小票失败:', err)
    }
  }, [receiptData, language])

  return {
    receiptData,
    sessionData,
    loading,
    error,
    language,
    setLanguage,
    asciiReceipt,
    fetchReceipt,
    fetchSessionReceipt: fetchSessionReceiptData,
    downloadHtml,
    downloadImage,
  }
}