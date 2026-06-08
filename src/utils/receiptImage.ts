import { toPng } from 'html-to-image'
import type { TokenReceiptData } from '../types'
import { generateReceiptHtmlFragment } from './receiptHtml'

export async function downloadImageReceipt(
  data: TokenReceiptData,
  language: 'zh' | 'en',
  taskId: string
): Promise<void> {
  // 1. 动态创建临时容器，在视口内但不可见
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;z-index:-9999;opacity:0;pointer-events:none;width:380px;background:#fff9e6;font-family:"Courier New",Courier,monospace;font-size:14px;'
  container.innerHTML = generateReceiptHtmlFragment(data, language)
  document.body.appendChild(container)

  try {
    // 2. 等待一帧确保 DOM 渲染完成
    await new Promise(resolve => requestAnimationFrame(resolve))

    // 3. 截图
    const dataUrl = await toPng(container, {
      backgroundColor: '#fff9e6',
      pixelRatio: 2,
    })

    // 4. 下载
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
    // 5. 无论成功失败，移除临时容器
    document.body.removeChild(container)
  }
}