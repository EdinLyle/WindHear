import { toPng } from 'html-to-image'
import type { TokenReceiptData } from '../types'
import { generateReceiptHtmlFragment } from './receiptHtml'

/** 小票样式ID，用于避免重复注入 */
const RECEIPT_STYLE_ID = 'token-receipt-image-styles'

/** 小票CSS样式（从 receiptHtml.ts 提取，确保 PNG 截图时样式生效） */
const RECEIPT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .receipt { background: #fff9e6; width: 380px; padding: 30px 20px; font-family: 'Courier New', Courier, monospace; font-size: 14px; box-shadow: 0 2px 20px rgba(0,0,0,0.15); border-radius: 4px; box-sizing: border-box; }
  .receipt-header { text-align: center; white-space: pre; font-size: 11px; line-height: 1.2; }
  .receipt-title { text-align: center; font-size: 14px; font-weight: bold; margin: 8px 0; }
  .receipt-divider-thick { border-top: 3px solid #1a1a1a; margin: 10px 0; }
  .receipt-divider-thin { border-top: 1px solid #999; margin: 8px 0; }
  .receipt-row { display: flex; justify-content: space-between; margin: 4px 0; }
  .receipt-row span { white-space: nowrap; }
  .receipt-total { font-weight: bold; font-size: 16px; }
  .receipt-price { color: #1a73e8; }
  .receipt-footer { text-align: center; margin-top: 16px; font-style: italic; color: #666; font-size: 13px; }
  .barcode { text-align: center; font-size: 10px; letter-spacing: 2px; margin-top: 8px; }
  .barcode pre { white-space: pre; font-size: 10px; margin: 0; }
  .barcode-id { font-size: 10px; letter-spacing: 1px; }
`

export async function downloadImageReceipt(
  data: TokenReceiptData,
  language: 'zh' | 'en',
  taskId: string
): Promise<void> {
  // 1. 将样式注入到 document.head（确保 html-to-image 能正确读取计算样式）
  let styleEl = document.getElementById(RECEIPT_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = RECEIPT_STYLE_ID
    styleEl.textContent = RECEIPT_CSS
    document.head.appendChild(styleEl)
  }

  // 2. 从片段中提取 .receipt div（去掉 <style> 标签，样式已注入 head）
  const fragment = generateReceiptHtmlFragment(data, language)
  const receiptHtml = fragment.replace(/<style>[\s\S]*?<\/style>/, '').trim()

  // 3. 创建临时容器
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;'
  container.innerHTML = receiptHtml
  document.body.appendChild(container)

  try {
    // 4. 等待样式和DOM渲染完成
    await new Promise(resolve => setTimeout(resolve, 150))

    // 5. 截图（对 .receipt 元素截图，而非容器）
    const receiptEl = container.querySelector('.receipt') as HTMLElement
    const target = receiptEl || container
    const dataUrl = await toPng(target, {
      backgroundColor: '#fff9e6',
      pixelRatio: 2,
    })

    // 6. 下载
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const timestamp = Date.now()
    const filename = `token-receipt-${taskId}-${timestamp}.png`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    // 7. 移除临时容器
    document.body.removeChild(container)
  }
}