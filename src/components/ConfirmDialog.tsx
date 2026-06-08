import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // 按 Escape 关闭弹窗
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="confirmBackdrop"
      style={{ zIndex: 1300 }}
      onClick={onCancel}
    >
      <div className="confirmCard" style={{ zIndex: 1310 }} onClick={(e) => e.stopPropagation()}>
        <div className="cardHeader">
          <strong>{title}</strong>
        </div>
        <div className="confirmBody" style={{ color: '#e74c3c' }}>
          {message}
        </div>
        <div className="confirmActions">
          <button className="btn secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}