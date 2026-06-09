import type { TokenReceiptData } from '../types'

const LINE_WIDTH = 48

const LOGOS: Record<string, string> = {
  deepseek: `
     ▄▄▄▄▄▄▄▄▄    
   ▄████████████████▄  
  ▄███▀▀▀▀▀▀▀▀▀▀▀███ 
  █████ ████ ████ █████
   ███████████████████ 
    ▀▀▀████████▀▀▀▀   
       ▀▀▀▀▀▀        
       DeepSeek`,
  zhipu: `
      ▄▄▄▄▄▄▄    
    ▄██▀▀▀▀▀▀██▄  
   ▄██ ▄▄▄▄ ▀██▄ 
  ▄██▀ ▄▀▀▄▀▄ ▀██▄
  ███ ▄▀ ▄▄ ▀▄ █████
  ▀██▄ ▀▄▄▀▄▀ ▄██
   ▀██▄ ▀▀▀ ▄██ 
    ▀██▄▄▄▄▄▄██▀  
      ▀▀▀▀▀▀▀    
      Zhipu GLM`,
  anthropic: `
 ▄▄▄▄▄▄       ▄▄▄▄▄▄▄
███▀▀▀███     ███▀▀▀███
███ ▄▄▄ ███   ███ ▄▄▄ ███
 ████████ ███ ████ █████
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
       ▄▄▄▄▄▄▄
     ▄██▀   ▀██▄
    ▄██▀     ▀██▄
    ▀▀▀▀▀▀▀▀▀▀▀▀
    CLAUDE CODE`,
  openai: `
      ▄▄▄▄▄▄▄▄▄    
    ▄██████████████▄  
   ▄██▀▀▀▀▀▀▀▀▀▀▀▀██▄
  ▄██   ▄▄▄▄▄▄   ▀██▄
 ███▀   ▄▀▀▀▀▄   ▀███
 ███    ████ ████    ███
 ███    ████ ████    ███
 ███▄   ▀▀▀▀▀▀▀   ▄███
  ▀██▄▄▄▄▄▄▄▄▄▄▄▄▄██▀
   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
       OPENAI`,
  ollama: `
      ▄▄▄▄▄▄▄    
    ▄██▀▀▀▀▀██▄  
   ▄██ ▄▄▄▄▄ ██▄ 
  ▄██▀ █████▀ ██▄
  ███ ▄▀▀▀▀▀▀▄ ███
  ▀██▄ ▀▄▄▄▄▀ ▄██▀
   ▀██▄▄▄▄▄▄▄▄██▀  
    ▀▀▀▀▀▀▀▀▀▀▀   
      OLLAMA`,
  windhear: `
    ▄▄▄▄▄▄▄▄▄    
  ▄████████████████▄  
 ███▀▀▀▀▀▀▀▀▀███▄
 █████ ████ ████ █████
  ███████████████████ 
   ▀▀▀████████▀▀    
      ▀▀▀▀▀        
   听风安全评估`
}

const MODULE_NAMES: Record<string, Record<string, string>> = {
  'evaluation': { zh: '模型安全评测', en: 'Model Evaluation' },
  'mcp': { zh: 'MCP 扫描', en: 'MCP Scan' },
  'code-audit': { zh: '代码安全审计', en: 'Code Security Audit' },
  'skills-audit': { zh: 'Skills 审计', en: 'Skills Audit' }
}

const FOOTERS = {
  zh: [
    '代码审完了，预算也死了。',
    '最后一版这个词，本来就不诚实。',
    '画面稳了，预算死了。',
    '安全通过了，钱包受伤了。',
    '漏洞找到了，Token 花掉了。'
  ],
  en: [
    'Code reviewed. Budget deceased.',
    '"Last revision" is an oxymoron.',
    'Visual is stable. Budget is dead.',
    'Security passed. Wallet hurt.',
    'Found vulnerabilities. Spent tokens.'
  ]
}

/** 计算字符串显示宽度：ASCII 字符算 1，CJK 字符算 2 */
function getStringWidth(str: string): number {
  let width = 0
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    // CJK Unified Ideographs and common CJK ranges
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3000 && code <= 0x303F) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0x2E80 && code <= 0x2EFF) ||
      (code >= 0x3400 && code <= 0x4DBF)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/** 左对齐标签 + 右对齐值，中间空格填充 */
function alignRow(label: string, value: string, width: number = LINE_WIDTH): string {
  const labelWidth = getStringWidth(label)
  const valueWidth = getStringWidth(value)
  const padding = width - labelWidth - valueWidth
  return label + ' '.repeat(Math.max(1, padding)) + value
}

/** 千位逗号格式化数字 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** 生成 ASCII 条形码（基于 receiptId，视觉上像真实条形码） */
function generateBarcode(receiptId: string): string {
  // 基于 receiptId 生成确定性的条形码模式
  // 使用简单的伪随机序列，确保条形码密集且美观
  let seed = 0
  for (let i = 0; i < receiptId.length; i++) {
    seed = ((seed << 5) - seed + receiptId.charCodeAt(i)) | 0
  }
  // 确保种子为正数
  seed = Math.abs(seed) || 1

  const patterns = ['|||', '||', '||| ', '|| ', '|', '|| ', '|||', '|| ', '| ', '||| ', '||', '||| ', '| ', '||', '||| ']
  let barcode = ''
  let idx = seed % patterns.length
  while (barcode.length < LINE_WIDTH) {
    barcode += patterns[idx % patterns.length]
    idx = (idx * 7 + 3) % patterns.length
  }
  return barcode.substring(0, LINE_WIDTH)
}

/** 价格显示 */
function formatCost(amount: number | null, currency: string): string {
  if (amount === null) return 'UNMAPPED'
  const formatted = amount.toFixed(6)
  if (currency === 'USD') return `$${formatted}`
  if (currency === 'CNY') return `¥${formatted}`
  return `UNMAPPED`
}

/** 居中文本（由 CSS text-align:center 处理，此处直接返回原文） */
function centerText(text: string): string {
  return text
}

/** 获取 provider 对应的 Logo */
function getLogo(provider: string): string {
  const key = provider.toLowerCase()
  if (LOGOS[key]) return LOGOS[key]
  // 默认使用 windhear logo
  return LOGOS['windhear']
}

/** 获取模块名 */
function getModuleName(module: string, language: 'zh' | 'en'): string {
  return MODULE_NAMES[module]?.[language] || module
}

/** 获取随机 Footer 口号 */
function getRandomFooter(language: 'zh' | 'en'): string {
  const pool = FOOTERS[language]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 格式化日期 */
function formatDate(timestamp: string): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function renderAsciiReceipt(
  data: TokenReceiptData,
  language: 'zh' | 'en' = 'zh',
  hasTip?: boolean,
  tipAmount?: number
): string {
  const thickLine = '━'.repeat(LINE_WIDTH)
  const thinLine = '─'.repeat(LINE_WIDTH)

  const lines: string[] = []

  // Logo - 每行居中
  const logo = getLogo(data.provider)
  lines.push(...logo.split('\n').map(line => centerText(line)))

  // 空行
  lines.push('')

  // 标题
  const title = language === 'zh'
    ? '感谢使用听风安全审计服务'
    : 'THANK YOU FOR AUDITING WITH WindHear'
  lines.push(centerText(title))

  // Receipt ID（居中）
  const receiptIdLine = language === 'zh' ? `小票编号: ${data.receiptId}` : `RECEIPT #: ${data.receiptId}`
  lines.push(centerText(receiptIdLine))

  // Date（居中）
  const dateLine = language === 'zh' ? `日期: ${formatDate(data.timestamp)}` : `DATE: ${formatDate(data.timestamp)}`
  lines.push(centerText(dateLine))

  // 双线分隔
  lines.push(thickLine)

  // Provider / Model / Module
  lines.push(alignRow(
    language === 'zh' ? '供应商' : 'PROVIDER',
    data.provider.toUpperCase()
  ))
  lines.push(alignRow(
    language === 'zh' ? '模型' : 'MODEL',
    data.model
  ))
  lines.push(alignRow(
    language === 'zh' ? '模块' : 'MODULE',
    getModuleName(data.module, language)
  ))

  // 单线分隔
  lines.push(thinLine)

  // Token 明细表头
  lines.push(alignRow(
    language === 'zh' ? '项目' : 'ITEM',
    language === 'zh' ? 'TOKENS' : 'TOKENS'
  ))
  lines.push(thinLine)

  // Input Tokens
  lines.push(alignRow(
    language === 'zh' ? '输入 Tokens' : 'Input Tokens',
    formatNumber(data.inputTokens)
  ))

  // Output Tokens
  lines.push(alignRow(
    language === 'zh' ? '输出 Tokens' : 'Output Tokens',
    formatNumber(data.outputTokens)
  ))

  // Cache Read Tokens
  if (data.cachedInputTokens) {
    lines.push(alignRow(
      language === 'zh' ? '缓存读取 Tokens' : 'Cache Read Tokens',
      formatNumber(data.cachedInputTokens)
    ))
  }

  // Reasoning Tokens
  if (data.reasoningTokens) {
    lines.push(alignRow(
      language === 'zh' ? '推理 Tokens' : 'Reasoning Tokens',
      formatNumber(data.reasoningTokens)
    ))
  }

  // 双线分隔
  lines.push(thickLine)

  // TOTAL
  const totalLabel = language === 'zh' ? '合计' : 'TOTAL'
  lines.push(alignRow(
    totalLabel,
    formatNumber(data.totalTokens) + ' TOKENS'
  ))

  // 单线分隔
  lines.push(thinLine)

  // 价格信息
  const costLabel = language === 'zh'
    ? (data.costCurrency === 'CNY' ? '人民币估算' : data.costCurrency === 'USD' ? '美元估算' : '费用估算')
    : (data.costCurrency === 'CNY' ? 'CNY ESTIMATE' : data.costCurrency === 'USD' ? 'USD ESTIMATE' : 'COST ESTIMATE')
  lines.push(alignRow(costLabel, formatCost(data.costAmount, data.costCurrency)))

  lines.push(alignRow(
    language === 'zh' ? '计价模型' : 'PRICE',
    data.model
  ))
  lines.push(alignRow(
    language === 'zh' ? '计价日期' : 'PRICE DATE',
    formatDate(data.timestamp).split(' ')[0]
  ))

  // 小费
  if (hasTip && tipAmount !== undefined && data.costAmount !== null) {
    lines.push(thinLine)
    const subtotalLabel = language === 'zh' ? '小计' : 'SUBTOTAL'
    const tipLabel = language === 'zh' ? '小费' : 'TIP'
    const grandTotalLabel = language === 'zh' ? '总计' : 'GRAND TOTAL'
    lines.push(alignRow(subtotalLabel, formatCost(data.costAmount, data.costCurrency)))
    lines.push(alignRow(tipLabel, formatCost(tipAmount, data.costCurrency)))
    lines.push(alignRow(grandTotalLabel, formatCost(data.costAmount + tipAmount, data.costCurrency)))
  }

  // 双线分隔
  lines.push(thickLine)

  // Footer 口号
  lines.push('')
  lines.push(centerText(getRandomFooter(language)))

  // 条形码
  lines.push('')
  lines.push(centerText(generateBarcode(data.receiptId)))
  lines.push(centerText(data.receiptId))

  return lines.join('\n')
}