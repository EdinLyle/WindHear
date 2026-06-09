import { useEffect, useCallback, useState, useRef } from 'react'
import { useTokenReceipt } from '../hooks/useTokenReceipt'


export interface TokenReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  module: 'evaluation' | 'mcp' | 'code-audit' | 'skills-audit'
}

const TIMEOUT_MS = 5000

// 注入动画 keyframes（仅注入一次）
let styleInjected = false
function injectAnimations() {
  if (styleInjected) return
  if (typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = `
    @keyframes polaroidAppear {
      0% { opacity: 0; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @media (max-width: 600px) {
      .token-receipt-modal {
        width: 95vw !important;
      }
      .token-receipt-content {
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
  `
  document.head.appendChild(style)
  styleInjected = true
}

export default function TokenReceiptModal({
  isOpen,
  onClose,
  taskId,
  module,
}: TokenReceiptModalProps) {
  const {
    receiptData,
    loading,
    error,
    language,
    setLanguage,
    asciiReceipt,
    fetchReceipt,
    downloadHtml,
    downloadImage,
  } = useTokenReceipt()

  const [timedOut, setTimedOut] = useState(false)
  const [prevIsOpen, setPrevIsOpen] = useState(false)
  const startTimeRef = useRef<number | null>(null)


  // 在渲染期间基于 props 变化重置状态 — React "Adjusting state based on props" 模式
  if (isOpen && !prevIsOpen) {
    setTimedOut(false)
    setPrevIsOpen(isOpen)
  }
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(isOpen)
  }

  // 注入动画样式
  useEffect(() => {
    injectAnimations()
  }, [])

  // 打开时自动加载数据
  useEffect(() => {
    if (isOpen && taskId) {
      startTimeRef.current = Date.now()
      fetchReceipt(taskId, module)
    }
  }, [isOpen, taskId, module, fetchReceipt])

  // 超时检测
  useEffect(() => {
    if (!isOpen || !loading) return
    const timer = setTimeout(() => {
      if (loading) {
        setTimedOut(true)
      }
    }, TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isOpen, loading])

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // 重试
  const handleRetry = () => {
    setTimedOut(false)
    startTimeRef.current = Date.now()
    fetchReceipt(taskId, module)
  }

  if (!isOpen) return null

  return (
    <div style={styles.overlay}>
      <div className="token-receipt-modal" style={styles.modal}>
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          style={styles.closeBtn}
          title="关闭"
          aria-label="关闭弹窗"
        >
          ✕
        </button>

        {/* 内容区域 */}
        <div className="token-receipt-content" style={styles.content}>
          {loading && !receiptData ? (
            // 加载状态
            <div style={styles.loadingContainer}>
              {timedOut ? (
                <>
                  <div style={styles.loadingIcon}>⏱</div>
                  <p style={styles.errorText}>数据加载失败，请重试</p>
                  <button onClick={handleRetry} style={styles.retryBtn}>
                    重试
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.receiptSkeleton}>
                    <div style={styles.skeletonLine} />
                    <div style={styles.skeletonLine} />
                    <div style={styles.skeletonLineWide} />
                    <div style={styles.skeletonLine} />
                    <div style={styles.skeletonLineNarrow} />
                    <div style={styles.skeletonLineWide} />
                    <div style={styles.skeletonLine} />
                    <div style={styles.skeletonLine} />
                  </div>
                  <p style={styles.loadingText}>
                    {language === 'zh' ? '正在生成小票...' : 'Generating receipt...'}
                  </p>
                </>
              )}
            </div>
          ) : error && !receiptData ? (
            // 错误状态
            <div style={styles.errorContainer}>
              <div style={styles.errorIcon}>⚠</div>
              <p style={styles.errorText}>{error}</p>
              <button onClick={handleRetry} style={styles.retryBtn}>
                {language === 'zh' ? '重试' : 'Retry'}
              </button>
            </div>
          ) : (
            // 小票内容
            <pre style={styles.receiptPre}>{asciiReceipt}</pre>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={styles.footer}>
          {/* 左侧：语言切换 */}
          <div style={styles.footerLeft}>
            <button
              onClick={() => setLanguage('en')}
              style={{
                ...styles.langBtn,
                ...(language === 'en' ? styles.langBtnActive : {}),
              }}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              style={{
                ...styles.langBtn,
                ...(language === 'zh' ? styles.langBtnActive : {}),
              }}
            >
              中文
            </button>
          </div>

          {/* 右侧：下载按钮 + 关闭 */}
          <div style={styles.footerRight}>
            <button
              onClick={downloadHtml}
              disabled={!receiptData}
              style={{
                ...styles.downloadBtn,
                ...(!receiptData ? styles.disabledBtn : {}),
              }}
            >
              HTML
            </button>
            <button
              onClick={() => {
                if (receiptData) {
                  downloadImage()
                }
              }}
              disabled={!receiptData}
              style={{
                ...styles.downloadBtn,
                ...(!receiptData ? styles.disabledBtn : {}),
              }}
            >
              PNG
            </button>
            <button onClick={onClose} style={styles.closeFooterBtn}>
              {language === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
        </div>
      </div>

      
    </div>
  )
}

// ==================== Styles ====================

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 200ms ease-out',
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    animation: 'polaroidAppear 300ms ease-out',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    fontSize: '18px',
    color: '#666',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transition: 'background-color 0.15s',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    padding: '30px 20px',
    backgroundColor: '#fff9e6',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    width: '380px',
    boxSizing: 'content-box',
  },
  receiptPre: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '13px',
    lineHeight: '1.5',
    backgroundColor: '#fff9e6',
    color: '#1a1a1a',
    padding: '0',
    margin: '0 auto',
    whiteSpace: 'pre',
    border: 'none',
    boxShadow: 'none',
    overflow: 'hidden',
    width: 'fit-content',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  loadingText: {
    color: '#666',
    fontSize: '14px',
    marginTop: '20px',
  },
  loadingIcon: {
    fontSize: '40px',
    marginBottom: '16px',
  },
  receiptSkeleton: {
    width: '380px',
    padding: '24px 20px',
    backgroundColor: '#fff9e6',
    borderRadius: '6px',
    border: '1px dashed #d4c5a0',
  },
  skeletonLine: {
    height: '14px',
    backgroundColor: '#f0e8d0',
    borderRadius: '3px',
    marginBottom: '12px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonLineWide: {
    height: '14px',
    backgroundColor: '#f0e8d0',
    borderRadius: '3px',
    marginBottom: '12px',
    width: '100%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonLineNarrow: {
    height: '14px',
    backgroundColor: '#f0e8d0',
    borderRadius: '3px',
    marginBottom: '12px',
    width: '60%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  errorIcon: {
    fontSize: '40px',
    marginBottom: '16px',
  },
  errorText: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  retryBtn: {
    padding: '8px 24px',
    border: '1px solid #1a73e8',
    backgroundColor: '#1a73e8',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#fafafa',
  },
  footerLeft: {
    display: 'flex',
    gap: '6px',
  },
  footerRight: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  langBtn: {
    padding: '4px 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    color: '#666',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  langBtnActive: {
    backgroundColor: '#1a73e8',
    color: '#ffffff',
    borderColor: '#1a73e8',
  },
  downloadBtn: {
    padding: '6px 16px',
    border: '1px solid #1a73e8',
    backgroundColor: '#ffffff',
    color: '#1a73e8',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  disabledBtn: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  closeFooterBtn: {
    padding: '6px 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    color: '#666',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
}