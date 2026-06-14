import type { TokenReceiptData } from '../types'

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

function getLogo(provider: string, model?: string): string {
  // 1. 优先根据 model 名称推断（model 比 provider 更准确，因为 DeepSeek 走 openai 接口）
  if (model) {
    const m = model.toLowerCase()
    if (m.includes('deepseek')) return LOGOS['deepseek']
    if (m.includes('glm')) return LOGOS['zhipu']
    if (m.includes('claude')) return LOGOS['anthropic']
    if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.includes('o4') || m.includes('codex')) return LOGOS['openai']
    if (m.includes('llama') || m.includes('qwen') || m.includes('mistral')) return LOGOS['ollama']
  }

  // 2. 回退：按 provider 匹配
  const key = provider.toLowerCase()
  if (LOGOS[key]) return LOGOS[key]

  // 3. 默认使用 windhear logo
  return LOGOS['windhear']
}

function getModuleName(module: string, language: 'zh' | 'en'): string {
  return MODULE_NAMES[module]?.[language] || module
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatCost(amount: number | null, currency: string): string {
  if (amount === null) return 'UNMAPPED'
  const formatted = amount.toFixed(6)
  if (currency === 'USD') return `$${formatted}`
  if (currency === 'CNY') return `¥${formatted}`
  return 'UNMAPPED'
}

function formatDate(timestamp: string): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function generateBarcode(receiptId: string): string {
  // 基于 receiptId 生成确定性的条形码模式
  let seed = 0
  for (let i = 0; i < receiptId.length; i++) {
    seed = ((seed << 5) - seed + receiptId.charCodeAt(i)) | 0
  }
  seed = Math.abs(seed) || 1

  const patterns = ['|||', '||', '||| ', '|| ', '|', '|| ', '|||', '|| ', '| ', '||| ', '||', '||| ', '| ', '||', '||| ']
  let barcode = ''
  let idx = seed % patterns.length
  while (barcode.length < 48) {
    barcode += patterns[idx % patterns.length]
    idx = (idx * 7 + 3) % patterns.length
  }
  return barcode.substring(0, 48)
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
}

export function generateHtmlReceipt(
  data: TokenReceiptData,
  language: 'zh' | 'en' = 'zh',

): string {
  const logo = escHtml(getLogo(data.provider, data.model))
  const date = formatDate(data.timestamp)
  const dateOnly = date.split(' ')[0]
  const barcode = escHtml(generateBarcode(data.receiptId))
  const moduleNameZh = escHtml(getModuleName(data.module, 'zh'))
  const moduleNameEn = escHtml(getModuleName(data.module, 'en'))

  const randomFooterZh = FOOTERS.zh[Math.floor(Math.random() * FOOTERS.zh.length)]
  const randomFooterEn = FOOTERS.en[Math.floor(Math.random() * FOOTERS.en.length)]

  const costDisplay = formatCost(data.costAmount, data.costCurrency)

  // Translation data embedded in JS
  const translations: Record<string, Record<string, string>> = {
    title: { zh: '感谢使用听风安全审计服务', en: 'THANK YOU FOR AUDITING WITH WindHear' },
    receiptIdLabel: { zh: '小票编号', en: 'RECEIPT #' },
    dateLabel: { zh: '日期', en: 'DATE' },
    providerLabel: { zh: '供应商', en: 'PROVIDER' },
    modelLabel: { zh: '模型', en: 'MODEL' },
    moduleLabel: { zh: '模块', en: 'MODULE' },
    itemLabel: { zh: '项目', en: 'ITEM' },
    tokensLabel: { zh: 'TOKENS', en: 'TOKENS' },
    inputTokensLabel: { zh: '输入 Tokens', en: 'Input Tokens' },
    outputTokensLabel: { zh: '输出 Tokens', en: 'Output Tokens' },
    cacheTokensLabel: { zh: '缓存读取 Tokens', en: 'Cache Read Tokens' },
    reasoningTokensLabel: { zh: '推理 Tokens', en: 'Reasoning Tokens' },
    totalLabel: { zh: '合计', en: 'TOTAL' },
    costLabel: { zh: data.costCurrency === 'CNY' ? '人民币估算' : data.costCurrency === 'USD' ? '美元估算' : '费用估算', en: data.costCurrency === 'CNY' ? 'CNY ESTIMATE' : data.costCurrency === 'USD' ? 'USD ESTIMATE' : 'COST ESTIMATE' },
    priceLabel: { zh: '计价模型', en: 'PRICE' },
    priceDateLabel: { zh: '计价日期', en: 'PRICE DATE' },
    footerZh: { zh: randomFooterZh, en: randomFooterZh },
    footerEn: { zh: randomFooterEn, en: randomFooterEn },
  }

  // Build cache/reasoning rows
  const cacheRow = data.cachedInputTokens
    ? `<div class="receipt-row"><span data-zh="缓存读取 Tokens" data-en="Cache Read Tokens">缓存读取 Tokens</span><span>${formatNumber(data.cachedInputTokens)}</span></div>`
    : ''
  const reasoningRow = data.reasoningTokens
    ? `<div class="receipt-row"><span data-zh="推理 Tokens" data-en="Reasoning Tokens">推理 Tokens</span><span>${formatNumber(data.reasoningTokens)}</span></div>`
    : ''

  // Initial language
  const initialLang = language

  return `<!DOCTYPE html>
<html lang="${initialLang === 'zh' ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Receipt - ${escHtml(data.receiptId)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f5; display: flex; justify-content: center; padding: 40px 0; font-family: 'Courier New', Courier, monospace; }
    .receipt { background: #fff9e6; width: 380px; padding: 30px 20px; font-family: 'Courier New', Courier, monospace; font-size: 14px; box-shadow: 0 2px 20px rgba(0,0,0,0.15); border-radius: 4px; }
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
    
    .lang-toggle { text-align: center; margin-top: 10px; }
    .lang-btn { background: none; border: 1px solid #ccc; padding: 2px 10px; cursor: pointer; font-size: 12px; font-family: inherit; border-radius: 3px; }
    .lang-btn.active { background: #1a73e8; color: white; border-color: #1a73e8; }
    @media print {
      body { background: white; padding: 0; }
      .lang-toggle { display: none; }
      .receipt { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <pre class="receipt-header">${logo}</pre>
    <div class="receipt-title" data-zh="感谢使用听风安全审计服务" data-en="THANK YOU FOR AUDITING WITH WindHear">${initialLang === 'zh' ? '感谢使用听风安全审计服务' : 'THANK YOU FOR AUDITING WITH WindHear'}</div>
    <div class="receipt-row"><span data-zh="小票编号" data-en="RECEIPT #">小票编号</span><span>${escHtml(data.receiptId)}</span></div>
    <div class="receipt-row"><span data-zh="日期" data-en="DATE">日期</span><span>${escHtml(date)}</span></div>
    <div class="receipt-divider-thick"></div>
    <div class="receipt-row"><span data-zh="供应商" data-en="PROVIDER">供应商</span><span>${escHtml(data.provider.toUpperCase())}</span></div>
    <div class="receipt-row"><span data-zh="模型" data-en="MODEL">模型</span><span>${escHtml(data.model)}</span></div>
    <div class="receipt-row"><span data-zh="模块" data-en="MODULE" data-zh-val="${moduleNameZh}" data-en-val="${moduleNameEn}">${initialLang === 'zh' ? moduleNameZh : moduleNameEn}</span><span></span></div>
    <div class="receipt-divider-thin"></div>
    <div class="receipt-row" style="font-weight:bold"><span data-zh="项目" data-en="ITEM">项目</span><span data-zh="TOKENS" data-en="TOKENS">TOKENS</span></div>
    <div class="receipt-divider-thin"></div>
    <div class="receipt-row"><span data-zh="输入 Tokens" data-en="Input Tokens">输入 Tokens</span><span>${formatNumber(data.inputTokens)}</span></div>
    <div class="receipt-row"><span data-zh="输出 Tokens" data-en="Output Tokens">输出 Tokens</span><span>${formatNumber(data.outputTokens)}</span></div>
    ${cacheRow}
    ${reasoningRow}
    <div class="receipt-divider-thick"></div>
    <div class="receipt-row receipt-total"><span data-zh="合计" data-en="TOTAL">合计</span><span>${formatNumber(data.totalTokens)} TOKENS</span></div>
    <div class="receipt-divider-thin"></div>
    <div class="receipt-row receipt-price"><span data-zh="${translations.costLabel.zh}" data-en="${translations.costLabel.en}">${translations.costLabel[initialLang]}</span><span>${escHtml(costDisplay)}</span></div>
    <div class="receipt-row"><span data-zh="计价模型" data-en="PRICE">计价模型</span><span>${escHtml(data.model)}</span></div>
    <div class="receipt-row"><span data-zh="计价日期" data-en="PRICE DATE">计价日期</span><span>${escHtml(dateOnly)}</span></div>
    <div class="receipt-divider-thick"></div>
    <div class="receipt-footer" id="footerText">${initialLang === 'zh' ? escHtml(randomFooterZh) : escHtml(randomFooterEn)}</div>
    <div class="barcode"><pre>${barcode}</pre><span class="barcode-id">${escHtml(data.receiptId)}</span></div>
    
    <div class="lang-toggle">
      <button class="lang-btn ${initialLang === 'zh' ? 'active' : ''}" id="btnZh" onclick="switchLang('zh')">中文</button>
      <button class="lang-btn ${initialLang === 'en' ? 'active' : ''}" id="btnEn" onclick="switchLang('en')">EN</button>
    </div>
  </div>
  <script>
    (function() {
      var currentLang = '${initialLang}';
      var costCurrency = '${data.costCurrency}';
      var footerZh = ${JSON.stringify(randomFooterZh)};
      var footerEn = ${JSON.stringify(randomFooterEn)};
      var moduleZh = ${JSON.stringify(moduleNameZh)};
      var moduleEn = ${JSON.stringify(moduleNameEn)};

      var translations = {
        '小票编号': { zh: '小票编号', en: 'RECEIPT #' },
        '日期': { zh: '日期', en: 'DATE' },
        '供应商': { zh: '供应商', en: 'PROVIDER' },
        '模型': { zh: '模型', en: 'MODEL' },
        '模块': { zh: '模块', en: 'MODULE' },
        '项目': { zh: '项目', en: 'ITEM' },
        'TOKENS': { zh: 'TOKENS', en: 'TOKENS' },
        '输入 Tokens': { zh: '输入 Tokens', en: 'Input Tokens' },
        '输出 Tokens': { zh: '输出 Tokens', en: 'Output Tokens' },
        '缓存读取 Tokens': { zh: '缓存读取 Tokens', en: 'Cache Read Tokens' },
        '推理 Tokens': { zh: '推理 Tokens', en: 'Reasoning Tokens' },
        '合计': { zh: '合计', en: 'TOTAL' },
        '计价模型': { zh: '计价模型', en: 'PRICE' },
        '计价日期': { zh: '计价日期', en: 'PRICE DATE' }
      };

      var costLabels = {
        CNY: { zh: '人民币估算', en: 'CNY ESTIMATE' },
        USD: { zh: '美元估算', en: 'USD ESTIMATE' },
        UNMAPPED: { zh: '费用估算', en: 'COST ESTIMATE' }
      };

      function formatCost(amount, currency) {
        if (amount === null) return 'UNMAPPED';
        var formatted = amount.toFixed(6);
        if (currency === 'USD') return '$' + formatted;
        if (currency === 'CNY') return '¥' + formatted;
        return 'UNMAPPED';
      }

      window.switchLang = function(lang) {
        currentLang = lang;
        document.getElementById('btnZh').className = 'lang-btn' + (lang === 'zh' ? ' active' : '');
        document.getElementById('btnEn').className = 'lang-btn' + (lang === 'en' ? ' active' : '');

        var els = document.querySelectorAll('[data-zh][data-en]');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          var zhText = el.getAttribute('data-zh');
          var enText = el.getAttribute('data-en');
          el.textContent = lang === 'zh' ? zhText : enText;
        }

        // Update module name
        var moduleEl = document.querySelector('[data-zh-val][data-en-val]');
        if (moduleEl) {
          moduleEl.textContent = lang === 'zh' ? moduleEl.getAttribute('data-zh-val') : moduleEl.getAttribute('data-en-val');
        }

        // Update footer
        document.getElementById('footerText').textContent = lang === 'zh' ? footerZh : footerEn;

        // Update cost label
        var costLabelEls = document.querySelectorAll('.receipt-price span:first-child');
        if (costLabelEls.length > 0 && costLabels[costCurrency]) {
          costLabelEls[0].textContent = lang === 'zh' ? costLabels[costCurrency].zh : costLabels[costCurrency].en;
        }

        };
    })();
  </script>
</body>
</html>`
}

/**
 * 生成小票 HTML 片段（仅 .receipt 容器内容），用于 PNG 渲染
 * 不包含 <html>/<head>/<body> 外壳、语言切换按钮等 UI
 */
export function generateReceiptHtmlFragment(
  data: TokenReceiptData,
  language: 'zh' | 'en' = 'zh'
): string {
  // 复用 generateHtmlReceipt 的核心逻辑，输出包含样式的 .receipt 容器片段
  const fullHtml = generateHtmlReceipt(data, language)

  // 提取 <style> 标签内容
  const styleMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/)
  const styleContent = styleMatch ? styleMatch[1] : ''

  // 提取 .receipt div（包含自身标签），到 lang-toggle 之前
  const receiptMatch = fullHtml.match(/<div class="receipt"[\s\S]*?<\/div>\s*(?:<div class="lang-toggle")/)
  if (receiptMatch) {
    const receiptHtml = receiptMatch[0].replace(/\s*<div class="lang-toggle"[\s\S]*$/, '')
    return `<style>${styleContent}</style>${receiptHtml}`
  }

  // 最终回退：返回完整 HTML
  return fullHtml
}