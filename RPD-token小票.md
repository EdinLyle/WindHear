# Token 消耗小票功能需求文档 (RPD)

## 1. 产品概述

### 1.1 一句话定位
在听风 AI 安全评估平台中集成 **Token 消耗可视化小票** 功能，让用户在完成评估任务后，通过点击按钮即可弹出拍立得式窗口，实时查看本次任务的 Token 消耗明细，并支持导出 HTML 版和 PDF 版小票文件。

### 1.2 存在理由
- **透明度需求**：用户在调用云端 API 完成模型评测、MCP 扫描、代码审计、Skills 审计后，需要清晰了解每次任务的 Token 消耗和成本
- **传播价值**：热敏纸小票风格的可视化输出具备截图分享属性，提升产品传播力
- **成本控制**：帮助安全团队量化 AI 安全评估的成本，优化资源使用
- **用户体验**：拍立得式弹窗设计让 Token 消耗数据从后台走向前台，从数字变成可感知的"账单"
- **多模型适配**：支持 OpenAI、Anthropic、智谱 GLM、DeepSeek 等主流供应商的计价规则

---

## 2. 目标用户

| 用户类型 | 使用场景 | 核心诉求 |
|---------|---------|---------|
| **安全工程师** | 完成模型安全评测后查看成本 | 了解单次评测的 Token 用量，优化测试集规模 |
| **技术负责人** | 审批项目预算，评估资源投入 | 查看团队 AI 评估的总成本，做资源规划 |
| **开发者** | 调试过程中监控 API 调用开销 | 快速定位高 token 消耗的环节，优化提示词 |
| **审计人员** | 输出评估报告时附带成本说明 | 将 Token 小票作为报告附件，展示评估工作量 |

---

## 3. 核心价值

### 3.1 解决的问题
1. **Token 消耗不透明**：用户调用云端 API 后看不到详细的 token 使用明细
2. **成本感知弱**：数字化的 token count 缺乏视觉冲击，用户对开销没有直观感受
3. **导出困难**：无法将 token 消耗以可打印、可分享的格式导出
4. **缺少仪式感**：任务完成后缺少一个"结算"环节

### 3.2 带来的价值
1. **实时可视化**：任务完成后即时弹出小票，像购物结账一样清晰
2. **多格式导出**：支持 HTML 和 PDF 两种格式，满足不同场景需求
3. **品牌一致性**：小票视觉风格与听风平台保持一致，强化品牌认知
4. **传播属性**：精致的小票设计鼓励用户分享，形成口碑传播
5. **多模型支持**：覆盖 OpenAI、Anthropic、智谱 GLM、DeepSeek、Ollama 等主流供应商

---

## 4. 功能需求

### 4.1 功能列表（按优先级）

#### P0 - 核心功能（必须实现）

| 功能编号 | 功能名称 | 功能描述 | 验收标准 |
|---------|---------|---------|---------|
| F001 | Token 数据采集 | 从云端 API 响应中提取 Token 消耗数据 | 能准确获取 Input/Output/Total Tokens，误差为 0 |
| F002 | 小票渲染引擎 | 将 Token 数据渲染为热敏纸风格的小票 | 符合视觉规范，行宽 48 字符，ASCII monospace 风格 |
| F003 | 拍立得弹窗 | 任务完成后点击按钮弹出小票窗口 | 弹窗动画流畅，小票居中显示，背景半透明遮罩 |
| F004 | HTML 导出 | 将小票导出为 HTML 文件 | 点击"下载 HTML"按钮，浏览器下载 `token-receipt.html` |
| F005 | PDF 导出 | 将小票导出为 PDF 文件 | 点击"下载 PDF"按钮，浏览器下载 `token-receipt.pdf` |
| F006 | 多模块集成 | 在模型评测、MCP 扫描、代码审计、Skills 审计中均可触发 | 四个模块的任务详情页均有"查看 Token 小票"按钮 |

#### P1 - 增强功能（重要）

| 功能编号 | 功能名称 | 功能描述 | 验收标准 |
|---------|---------|---------|---------|
| F007 | 价格估算 | 根据模型类型和 token 数量估算费用 | 显示 USD 或 CNY 估算金额，未映射模型显示"UNMAPPED" |
| F008 | 多语言支持 | 小票支持中文和英文切换 | 点击语言切换按钮，小票内容实时切换 |
| F009 | 小费模式 | HTML 版本支持添加小费（创意功能） | 输入小费金额后，小票底部 footer 文案变化，显示 SUBTOTAL/TIP/GRAND TOTAL |
| F010 | 会话级累计 | 支持查看单次会话的累计 token 消耗 | 可选择"本轮"或"会话累计"两种 scope |
| F011 | 品牌 Logo | 小票顶部展示听风平台的像素风格 Logo | Logo 使用 ASCII 像素块拼出"听风"或"WindHear"字样 |

#### P2 - 扩展功能（可选）

| 功能编号 | 功能名称 | 功能描述 | 验收标准 |
|---------|---------|---------|---------|
| F012 | 趋势分析 | 在 Dashboard 展示 Token 消耗趋势图 | 14 天趋势曲线，支持按模块筛选 |
| F013 | 小票历史 | 查看历史任务的 Token 小票记录 | 列表展示历史小票，支持按时间/模块/成本排序 |
| F014 | 打印优化 | 针对热敏打印机优化排版 | 支持 58mm/80mm 热敏纸宽度预设 |
| F015 | 分享功能 | 一键生成分享图片 | 点击"分享"按钮，生成带二维码的小票图片 |

---

### 4.2 详细功能说明

#### F001 - Token 数据采集

**数据源**：
- 模型评测：每次调用被测模型 API 时，从响应头或响应体中提取 `usage` 字段
- MCP 扫描：AI 分析/审计/评审阶段的 LLM 调用 token 累计
- 代码审计：Pipeline 各阶段（Parser/Hunter/Validator/Reporter）的 token 消耗
- Skills 审计：10 个 Agent 的 token 消耗分别采集后求和

**提取字段**：
```typescript
interface TokenUsage {
  inputTokens: number       // 输入 token 数
  outputTokens: number      // 输出 token 数
  cachedInputTokens?: number // 缓存读取 token（如有）
  reasoningTokens?: number   // 推理 token（如有）
  totalTokens: number       // 总 token 数
  model: string             // 模型名称
  provider: string          // 供应商（OpenAI/Anthropic/Ollama/ 智谱 GLM/DeepSeek）
  timestamp: string         // 调用时间戳
  taskId: string            // 任务 ID
  module: string            // 模块（evaluation/mcp/code-audit/skills-audit）
}
```

**接入点**：
- `src/api.ts`：在 API 请求封装层统一拦截响应，提取 token 数据
- `server/modelClients.ts`：在客户端层统一埋点，记录每次 LLM 调用
- `server/runner.ts`、`mcpScanner.ts`、`pipeline.ts`：在任务执行引擎中累计 token

**验收标准**：
- 所有通过平台调用的 LLM 请求均能捕获 token 数据
- 数据准确，与 API 返回的 usage 字段一致
- 网络失败时自动降级显示 `UNRECORDED`

---

#### F002 - 小票渲染引擎

**渲染模式**：
1. **ASCII Monospace 模式**：聊天对话框/弹窗内显示
2. **HTML 模式**：可打印的 HTML 页面
3. **PDF 模式**：基于 PDFKit 生成 PDF 文件

**ASCII 小票结构**（宽度 48 字符）：

**示例 1 - DeepSeek 模型**：
```
     ▄▄▄▄▄▄▄▄▄    
   ▄████████████████  
  ▄███▀▀▀▀▀▀▀▀▀███ 
  █████ █████████████
   █████████████████ 
    ▓▓▓▓▓▓▓▓▓▓    
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  
    DeepSeek

     THANK YOU FOR AUDITING
    RECEIPT #: TF_20260608_143256_A7F291
         DATE: 2026-06-08 14:32:56
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVIDER                            DEEPSEEK
MODEL                             deepseek-v4-pro
MODULE                             模型安全评测
────────────────────────────────────────────────
ITEM                                      TOKENS
────────────────────────────────────────────────
Input Tokens                              12,487
Output Tokens                              3,215
Cache Read Tokens                          8,742
Reasoning Tokens                             128
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL                              15,702 TOKENS
────────────────────────────────────────────────
CNY ESTIMATE                           ¥0.062851
PRICE                          deepseek-v4-pro
PRICE DATE                            2026-06-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            代码审完了，预算也死了。

       ||| ||||| || ||| | | || |||  | |
          TF_20260608_143256_A7F291
```

**示例 2 - 智谱 GLM 模型**：
```
      ▄▄▄▄▄▄    
    ▄██▀▀▀▀▀██▄  
   ▄██ ▄▄▄ ▀██▄ 
  ▄██▀ ▄▀▀▄▀▄ ▀██▄
  ███ ▄▀ ▄ ▀▄ █████
  ▀██▄ ▀▄▄▄▀ ▄██▀  
   ▀██▄ ▀▀ ▄██▀
    ██▄▄▄▄▄▄██▀  
      Zhipu GLM

     THANK YOU FOR AUDITING
    RECEIPT #: TF_20260608_143256_B8G392
         DATE: 2026-06-08 15:20:18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVIDER                               ZHIPU AI
MODEL                            glm-4-flash
MODULE                      代码安全审计
────────────────────────────────────────────────
ITEM                                      TOKENS
────────────────────────────────────────────────
Input Tokens                              25,104
Output Tokens                              6,892
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL                              32,000 TOKENS
────────────────────────────────────────────────
CNY ESTIMATE                           ¥0.002510
PRICE                            glm-4-flash
PRICE DATE                            2026-06-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    漏洞找到了，Token 花掉了。

       ||| ||||| || ||| | | || |||  | |
          TF_20260608_143256_B8G392
```

**票面字段说明**：
- **Logo 区**：根据 provider 动态切换（DeepSeek 鲸鱼、GLM 六边形、Anthropic 螃蟹等）
- **标题区**：`THANK YOU FOR AUDITING WITH WindHear` 或简化版
- **Receipt ID**：格式 `TF_YYYYMMDD_HHMMSS_随机 6 位`
- **PROVIDER**：供应商名称（DEEPSEEK / ZHIPU AI / ANTHROPIC / OPENAI 等）
- **MODEL**：具体模型名（deepseek-v4-pro / glm-4-flash / claude-sonnet-4-5 等）
- **MODULE**：使用模块（模型安全评测 / MCP 扫描 / 代码安全审计 / Skills 审计）
- **Token 明细**：Input / Output / Cache Read / Reasoning（有则显示，无则省略）
- **TOTAL**：加粗显示总 token 数
- **价格估算**：CNY 或 USD 估算金额，未映射模型显示 `UNMAPPED`
- **Footer 口号**：根据语言和是否有小费动态切换
- **条形码**：ASCII 条形码 + Receipt ID 文本

---**价格表结构**（`data/pricing.json`）：
```json
{
  "openai": {
    "gpt-5": { "input": 0.000005, "output": 0.000015, "currency": "USD" },
    "gpt-4.1": { "input": 0.000002, "output": 0.000008, "currency": "USD" },
    "codex": { "input": 0.000005, "output": 0.000015, "currency": "USD" }
  },
  "anthropic": {
    "claude-opus-4": { "input": 0.000015, "output": 0.000075, "currency": "USD" },
    "claude-sonnet-4-5": { "input": 0.000003, "output": 0.000015, "currency": "USD" }
  },
  "zhipu": {
    "glm-4-flash": { "input": 0.0001, "output": 0.0001, "currency": "CNY" },
    "glm-4.7": { "input": 0.0005, "output": 0.002, "currency": "CNY" }
  },
  "deepseek": {
    "deepseek-v4-flash": {
      "input": 0.000002,
      "input_cache_hit": 0.000002,
      "input_cache_miss": 0.0001,
      "output": 0.0002,
      "currency": "CNY"
    },
    "deepseek-v4-pro": {
      "input": 0.0000025,
      "input_cache_hit": 0.0000025,
      "input_cache_miss": 0.0003,
      "output": 0.0006,
      "currency": "CNY"
    }
  }
}
```

**DeepSeek 模型说明**：
| 模型 | 输入（缓存命中） | 输入（缓存未命中） | 输出 | 特性 |
|------|-----------------|-------------------|------|------|
| deepseek-v4-flash | 0.02 元/百万 tokens | 1 元/百万 tokens | 2 元/百万 tokens | 支持非思考模式，Json Output, Tool Calls, FIM 补全 |
| deepseek-v4-pro | 0.025 元/百万 tokens | 3 元/百万 tokens | 6 元/百万 tokens | 支持思考模式，Json Output, Tool Calls, FIM 补全 |
| | | | | 上下文长度：1M，输出长度：最大 384K |

**价格计算逻辑（支持缓存区分）**：
```typescript
function estimateCost(usage: TokenUsage, pricing: PricingData): CostEstimate {
  const modelPrice = pricing[usage.provider]?.[usage.model]
  if (!modelPrice) {
    return { amount: null, currency: 'UNMAPPED' }
  }
  
  // DeepSeek 区分缓存命中/未命中
  let inputCost: number
  if (modelPrice.input_cache_hit !== undefined && usage.cachedInputTokens !== undefined) {
    // 如果有缓存数据，分别计算命中和未命中的成本
    const hitRatio = usage.cachedInputTokens / usage.inputTokens
    inputCost = (usage.inputTokens * (modelPrice.input_cache_hit * hitRatio + modelPrice.input_cache_miss * (1 - hitRatio))) / 1000
  } else {
    inputCost = usage.inputTokens * modelPrice.input / 1000
  }
  
  const outputCost = usage.outputTokens * modelPrice.output / 1000
  const totalCost = inputCost + outputCost
  
  return {
    amount: totalCost,
    currency: modelPrice.currency,
    breakdown: { inputCost, outputCost }
  }
}
```

**验收标准**：
- ASCII 小票行宽严格控制在 48 字符
- 中文字符正确对齐，不乱码
- 价格计算准确，保留 6 位小数
- 未映射模型显示 `PRICE: UNMAPPED`

---

#### F003 - 拍立得弹窗

**触发时机**：
- 模型评测：报告生成完成后，页面右上角出现"查看 Token 小票"按钮
- MCP 扫描：扫描报告生成完成后，显示按钮
- 代码审计：审计报告生成完成后，显示按钮
- Skills 审计：审计报告生成完成后，显示按钮
- Dashboard：最近完成的任务列表中，每条记录均可点击弹出

**弹窗设计**：
- **尺寸**：最小 600x800px，适配小票比例
- **背景**：半透明黑色遮罩 (rgba(0,0,0,0.6))
- **动画**：从中心放大 + 淡入，模拟拍立得显影效果（300ms）
- **内容区域**：
  - 顶部：关闭按钮（右上角 X）
  - 中部：小票本体（ASCII 代码块 或 HTML 渲染）
  - 底部操作栏：
    - 左侧：语言切换 (EN / 中文)
    - 右侧：下载 HTML / 下载 PDF / 关闭
- **移动端适配**：宽度小于 600px 时，小票横向滚动

**组件结构**：
```typescript
// src/components/TokenReceiptModal.tsx
interface TokenReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  module: 'evaluation' | 'mcp' | 'code-audit' | 'skills-audit'
}

// 内部状态
const [language, setLanguage] = useState<'zh' | 'en'>('zh')
const [receiptMode, setReceiptMode] = useState<'ascii' | 'html'>('ascii')
```

**验收标准**：
- 弹窗在任务完成后立即可打开
- 小票渲染延迟 < 500ms
- 关闭弹窗后不影响页面其他功能

---

#### F004 - HTML 导出

**技术实现**：
- 基于 `token_receipt/html_render.py` 的 HTML 渲染逻辑，用 TypeScript 重写为 `src/utils/receiptHtml.ts`
- 生成完整的 HTML 文档，包含内联 CSS
- 使用 Blob 创建下载链接

**HTML 特性**：
- **响应式布局**：适配屏幕预览和打印
- **打印优化**：`@media print` 样式确保打印效果
- **语言切换**：页面内 JS 实现中英语言切换，无需重新生成
- **小费模式**：外部输入框，实时更新小票底部 footer
- **Logo 展示**：SVG 矢量 Logo 或 ASCII 像素画嵌入

**下载文件名**：
```
token-receipt-{taskId}-{timestamp}.html
```

**验收标准**：
- 点击下载后，浏览器立即开始下载
- 下载的 HTML 文件可用浏览器直接打开
- 在浏览器中点击打印，效果与预览一致

---

#### F005 - PDF 导出

**技术实现**：
- 方案 A：前端使用 `jspdf` 库生成 PDF（推荐，纯前端方案）
- 方案 B：调用后端 `/api/receipt/pdf` 接口，由 PDFKit 生成（备选）
- 复用现有 `server/pdfCommon.ts` 中的字体注册逻辑

**PDF 规格**：
- **纸张**：A4 (80mm 热敏纸模拟)
- **字体**：
  - 中文：宋体 / 方正风雅宋
  - 英文：Times New Roman
  - 等宽：Noto Sans Mono（代码块）
- **页边距**：上下左右各 10mm
- **页眉**：听风 Logo + 小票标题
- **页脚**：页码 + 生成时间（可选，单页小票可省略）

**下载文件名**：
```
token-receipt-{taskId}-{timestamp}.pdf
```

**验收标准**：
- 点击下载后，浏览器立即开始下载
- PDF 文件可用 Adobe Reader / 浏览器打开
- 文字清晰，无乱码，中文字体正确渲染
- 打印预览效果与实际打印一致

---

#### F006 - 多模块集成

**集成位置**：

1. **模型评测** (`src/pages/EvaluationReport.tsx`)
   ```tsx
   // 报告页面右上角
   <Button onClick={() => setShowReceiptModal(true)}>
     查看 Token 小票
   </Button>
   ```

2. **MCP 扫描** (`src/pages/McpScanReport.tsx`)
   ```tsx
   // 报告页面右上角
   <Button onClick={() => setShowReceiptModal(true)}>
     查看 Token 小票
   </Button>
   ```

3. **代码审计** (`src/pages/CodeAuditDetail.tsx`)
   ```tsx
   // 审计报告页面右上角
   <Button onClick={() => setShowReceiptModal(true)}>
     查看 Token 小票
   </Button>
   ```

4. **Skills 审计** (`src/pages/SkillsAuditDetail.tsx`)
   ```tsx
   // 审计报告页面右上角
   <Button onClick={() => setShowReceiptModal(true)}>
     查看 Token 小票
   </Button>
   ```

**公共组件**：
- `src/components/TokenReceiptModal.tsx`：弹窗组件
- `src/hooks/useTokenReceipt.ts`：Token 获取和小票生成逻辑
- `src/utils/receiptRenderer.ts`：ASCII 渲染
- `src/utils/receiptHtml.tsx`：HTML 渲染
- `src/utils/receiptPdf.ts`：PDF 生成

**验收标准**：
- 四个模块的任意任务详情页均有"查看 Token 小票"按钮
- 点击按钮后弹出的小票展示当前任务的 token 数据
- 不同模块的小票顶部 MODULE 字段显示正确的模块名称

---

#### F007 - 价格估算

**实现逻辑**：
```typescript
function estimateCost(usage: TokenUsage, pricing: PricingData): CostEstimate {
  const modelPrice = pricing[usage.provider]?.[usage.model]
  if (!modelPrice) {
    return { amount: null, currency: 'UNMAPPED' }
  }
  
  // DeepSeek 区分缓存命中/未命中
  let inputCost: number
  if (modelPrice.input_cache_hit !== undefined && usage.cachedInputTokens !== undefined) {
    // 如果有缓存数据，分别计算命中和未命中的成本
    const hitRatio = usage.cachedInputTokens / usage.inputTokens
    inputCost = (usage.inputTokens * (modelPrice.input_cache_hit * hitRatio + modelPrice.input_cache_miss * (1 - hitRatio))) / 1000
  } else {
    inputCost = usage.inputTokens * modelPrice.input / 1000
  }
  
  const outputCost = usage.outputTokens * modelPrice.output / 1000
  const totalCost = inputCost + outputCost
  
  return {
    amount: totalCost,
    currency: modelPrice.currency,
    breakdown: { inputCost, outputCost }
  }
}
```

**展示规则**：
- USD 模型显示 `USD ESTIMATE` + `$` 符号
- CNY 模型显示 `CNY ESTIMATE` + `¥` 符号
- 未映射模型显示 `PRICE: UNMAPPED`（小票）或 `费用：未映射模型`（中文）

**支持的模型家族**：

| 供应商 | 模型系列 | 价格类型 |
|--------|---------|---------|
| OpenAI | GPT-5, GPT-4.1, GPT-4o, Codex, o3, o4-mini | USD |
| Anthropic | Claude Opus, Sonnet, Haiku 系列 | USD |
| 智谱 GLM | glm-4-flash, glm-4.7, glm-4-air | CNY |
| **DeepSeek** | **deepseek-v4-flash, deepseek-v4-pro** | **CNY** |
| Ollama | 本地部署模型 | 免费 |

**DeepSeek 模型特别说明**：
- **BASE URL**：
  - OpenAI 格式：`https://api.deepseek.com`
  - Anthropic 格式：`https://api.deepseek.com/anthropic`
- **思考模式**：deepseek-v4-pro 支持思考模式（默认），deepseek-v4-flash 仅非思考模式
- **缓存定价**：区分缓存命中（0.02 元/百万）和未命中（1 元/百万）
- **上下文长度**：1M tokens
- **输出长度**：最大 384K tokens

**验收标准**：
- 价格计算误差 < 0.000001
- 支持的模型：GPT 系列、Claude 系列、GLM 系列、DeepSeek V4 系列、Ollama 本地模型
- 未映射模型不显示臆测价格
- DeepSeek 模型正确区分缓存命中/未命中价格

---

#### F008 - 多语言支持

**支持语言**：
- 简体中文 (zh-CN)
- 英文 (en-US)

**切换方式**：
- 弹窗内语言切换按钮：`EN / 中文`
- URL 参数：`?lang=en` 或 `?lang=zh-CN`

**翻译范围**：
```typescript
const translations = {
  en: {
    title: "THANK YOU FOR AUDITING WITH WindHear",
    receiptId: "RECEIPT #:",
    date: "DATE:",
    provider: "PROVIDER",
    model: "MODEL",
    module: "MODULE",
    inputTokens: "Input Tokens",
    outputTokens: "Output Tokens",
    cacheReadTokens: "Cache Read Tokens",
    reasoningTokens: "Reasoning Tokens",
    total: "TOTAL",
    usdEstimate: "USD ESTIMATE",
    cnyEstimate: "CNY ESTIMATE",
    price: "PRICE",
    priceDate: "PRICE DATE",
    footers: [
      "代码审完了，预算也死了。", // 中文版
      "Code reviewed. Budget deceased." // 英文版
    ]
  },
  zh: {
    title: "感谢您使用听风安全评估",
    receiptId: "小票编号:",
    date: "日期:",
    provider: "供应商",
    model: "模型",
    module: "模块",
    inputTokens: "输入 Token",
    outputTokens: "输出 Token",
    cacheReadTokens: "缓存读取 Token",
    reasoningTokens: "推理 Token",
    total: "合计",
    usdEstimate: "美元估算",
    cnyEstimate: "人民币估算",
    price: "价格",
    priceDate: "价格日期",
    footers: [
      "代码审完了，预算也死了。",
      "最后一版这个词，本来就不诚实。",
      "画面稳了，预算死了。"
    ]
  }
}
```

**验收标准**：
- 点击切换按钮后，小票内容实时切换语言
- 汉字和英文字符对齐一致
- 语言切换不影响 HTML/PDF 导出功能

---

#### F009 - 小费模式（创意功能）

**功能说明**：
- 仅在 HTML 导出模式下可用（PDF 不支持）
- 弹窗内提供"添加小费"输入框（自愿行为，趣味性质）
- 输入小费金额后：
  - 小票底部显示 SUBTOTAL / TIP / GRAND TOTAL
  - Footer 文案风格变化（更友好、更感激）
  - 页面标题变为"含小费的 Token 账单"

**交互流程**：
1. 用户打开 HTML 版本小票
2. 页面右侧显示"Add tip"输入框（默认隐藏）
3. 输入金额（如 `0.01 USD` 或 `0.1 CNY`）
4. 点击"Apply Tip"按钮
5. 小票实时更新，显示 SUBTOTAL / TIP / GRAND TOTAL
6. Footer 变为"感谢您的慷慨支持！"

**验收标准**：
- 小费输入仅对已映射价格的模型显示（无法计算小费的模型不展示）
- 小费金额实时更新 GRANG TOTAL
- Footer 文案根据是否有小费切换不同风格

---

#### F010 - 会话级累计

**Scope 选项**：
- **本轮 (Latest Turn)**：查看最后一次 LLM 调用的 token 消耗
- **会话累计 (Session)**：查看整个任务会话的累计 token 消耗

**实现逻辑**：
```typescript
interface ReceiptScope {
  type: 'latest-turn' | 'session'
  taskId: string
  sessionId: string // 可选，用于会话累计
}

function getRecriptTokenData(scope: ReceiptScope): TokenUsage {
  if (scope.type === 'latest-turn') {
    return getLatestTokenUsage(scope.taskId)
  } else {
    return aggregateSessionTokenUsage(scope.sessionId)
  }
}
```

**数据存储**：
- 数据库新增 `token_usages` 表：
```sql
CREATE TABLE token_usages (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT,
  module TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cached_input_tokens INTEGER,
  reasoning_tokens INTEGER,
  total_tokens INTEGER,
  model TEXT,
  provider TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**DeepSeek 特别说明**：
- Provider 存储为 `deepseek`
- 模型名存储为 `deepseek-v4-flash` 或 `deepseek-v4-pro`
- 由于 DeepSeek 支持缓存命中/未命中区分定价，可选存储 `cache_hit_ratio` 字段用于精确计价

**验收标准**：
- 默认显示"本轮"数据
- 切换为"会话累计"后，小票 TOTAL 显示累计值
- 会话累计的 MODULE 显示 "模型安全评测 (累计)" 格式

---

#### F011 - 品牌 Logo

**设计要求**：
- 小票顶部 Logo 根据使用的模型供应商动态切换
- 使用 ASCII 像素块拼出供应商标志性图案
- 宽度不超过 48 字符
- 高度不超过 15 行
- 风格与 token-receipt 项目的像素 Logo 保持一致

**供应商标志库**：

**1. DeepSeek (深度求索)** - 小鲸鱼图案
```
    ▄▄▄▄▄▄▄▄▄    
  ▄████████████████▄  
 ▄███▀▀▀▀▀▀▀▀▀▀▀███ 
 █████ ████ ████ █████
 █████ ███████████████
  ███████████████████ 
   ████████████████   
    ▓▓▓▓▓▓▓▓▓▓     
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 
  DeepSeek
```

**2. 智谱 GLM** - 六边形星钻图案
```
      ▄▄▄▄▄▄▄    
    ▄██▀▀▀▀▀▀██▄  
   ▄██ ▄▄▄▄ ▀██▄ 
  ▄██▀ ▄▀▀▄▀▄ ▀██▄
  ███ ▄▀ ▄▄ ▀▄ █████
  ▀██▄ ▀▄▄▀▄▀ ▄██
   ▀██▄ ▀▀▀ ▄██ 
    ▀██▄▄▄▄▄▄██▀  
      ▀▀▀▀▀▀▀    
      Zhipu GLM
```

**3. Anthropic (Claude)** - 像素螃蟹图案
```
 ▄▄▄▄▄▄       ▄▄▄▄▄▄▄
███▀▀▀███     ███▀▀▀███
███ ▄▄▄ ███   ███ ▄▄▄ ███
 ████████ ███ ████ █████
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
       ▄▄▄▄▄▄▄
     ▄██▀   ▀██▄
    ▄██▀     ▀██▄
    ▀▀▀▀▀▀▀▀▀▀▀▀
    CLAUDE CODE
```

**4. OpenAI / Codex** - 圆形渐变图案
```
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
       CODEX
```

**5. 听风 (WindHear)** - 平台自有 Logo
```
    ▄▄▄▄▄▄▄▄▄    
  ▄████████████████▄  
 ███▀▀▀▀▀▀▀▀▀███▄
 █████ ████ ████ █████
  ███████████████████ 
   ▀▀▀▀████████▀▀    
      ▀▀▀▀▀        
   听风安全评估
```

**6. Ollama** - 羊驼简化版
```
      ▄▄▄▄▄▄▄    
    ▄██▀▀▀▀▀██▄  
   ▄██ ▄▄▄▄▄ ██▄ 
  ▄██▀ █████▀ ██▄
  ███ ▄▀▀▀▀▀▀▄ ███
  ▀██▄ ▀▄▄▄▄▀ ▄██▀
   ▀██▄▄▄▄▄▄▄▄██▀  
    ▀▀▀▀▀▀▀▀▀▀▀   
      OLLAMA
```

**Logo 选择逻辑**：
```typescript
function getProviderLogo(provider: string, model: string): string {
  switch (provider) {
    case 'deepseek':
      return DEEPSEEK_WHALE_LOGO
    case 'zhipu':
      return ZHIPU_HEX_LOGO
    case 'anthropic':
      return CLAUDE_CRAB_LOGO
    case 'openai':
      return OPENAI_CIRCLE_LOGO
    case 'ollama':
      return OLLAMA_LLAMA_LOGO
    default:
      return WINDHEAR_LOGO // 默认使用听风 Logo
  }
}
```

**HTML 版本 Logo**：
- 使用 SVG 矢量图（复用各品牌官方 Logo）
- 尺寸：宽度 120-150px，高度 60-80px
- 颜色：保持品牌标准色（DeepSeek 蓝色、GLM 蓝紫渐变等）

**验收标准**：
- Logo 在小票顶部居中显示
- Logo 下方紧跟供应商名称（DeepSeek / Zhipu GLM / CLAUDE CODE 等）
- 根据实际使用的模型自动切换对应 Logo
- Logo 在 HTML 版本中可使用 SVG 矢量图替代 ASCII 画

---

## 5. 技术架构

### 5.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React 19 + TypeScript)           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ TokenReceiptModal│  │ useTokenReceipt  │  │ receipt     │ │
│  │ (弹窗组件)       │  │ (Hook)           │  │ Renderer    │ │
│  └────────┬────────┘  └────────┬─────────┘  │ (渲染引擎)  │ │
│           │                    │            └─────────────┘ │
│           │                    │                            │
│  ┌────────▼────────────────────▼─────────────────────────┐  │
│  │              src/utils/receipt*.{ts,tsx}               │  │
│  │  - receiptHtml.tsx (HTML 渲染)                         │  │
│  │  - receiptPdf.ts (PDF 生成)                            │  │
│  │  - receiptRenderer.ts (ASCII 渲染)                     │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API 调用
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              后端 (Express 5 + TypeScript)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ /api/receipt/pdf │  │ TokenCaptureMW   │  │ Pricing    │ │
│  │ (PDF 生成接口)    │  │ (Token 采集中间件)│  │ Service    │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 server/modelClients.ts                  │ │
│  │           (统一 LLM 调用，埋点采集 token)                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL 读写
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                数据库 (SQLite3)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ existing tables  │  │ token_usages     │                │
│  │ (评测/扫描记录)   │  │ (token 消耗记录)  │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 数据流

**Token 采集流程**：
```
用户发起评估任务
       │
       ▼
前端调用 /api/evaluation/run (或其他模块 API)
       │
       ▼
后端 modelClients.ts 调用云端 LLM API
       │
       ▼
从 API 响应中提取 usage 字段
       │
       ▼
写入 token_usages 表 (task_id, session_id, tokens...)
       │
       ▼
任务完成后，前端轮询任务状态
       │
       ▼
任务完成，显示"查看 Token 小票"按钮
```

**小票生成流程**：
```
用户点击"查看 Token 小票"
       │
       ▼
前端弹窗组件打开
       │
       ▼
调用 GET /api/receipt/:taskId 获取 token 数据
       │
       ▼
前端渲染引擎生成 ASCII 小票 (receiptRenderer.ts)
       │
       ▼
显示在弹窗中央
       │
       ▼
用户点击"下载 HTML"或"下载 PDF"
       │
       ├────► HTML: Blob 创建下载链接
       │
       └────► PDF: 调用后端 API 或前端 jspdf 生成
```

### 5.3 模块划分

| 模块 | 职责 | 关键文件 |
|-----|------|---------|
| **Token 采集层** | 统一采集 LLM 调用 token | `server/modelClients.ts`, `server/middleware/tokenCapture.ts` |
| **数据持久化** | 存储 token 消耗记录 | `server/db.ts` (新增 `token_usages` 表) |
| **价格服务** | 价格查询和费用估算 | `server/services/pricingService.ts`, `data/pricing.json` |
| **小票渲染引擎** | ASCII/HTML 渲染 | `src/utils/receiptRenderer.ts`, `src/utils/receiptHtml.tsx` |
| **PDF 生成** | PDF 文件生成 | `src/utils/receiptPdf.ts` 或 `server/receiptPdf.ts` |
| **弹窗组件** | 拍立得式弹窗 UI | `src/components/TokenReceiptModal.tsx` |
| **自定义 Hook** | Token 获取和小票生成逻辑 | `src/hooks/useTokenReceipt.ts` |

---

## 6. 数据接口

### 6.1 数据库 Schema

**新增表**：
```sql
CREATE TABLE token_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,              -- 任务 ID（评测/MCP/代码审计/Skills）
  session_id TEXT,                    -- 会话 ID（用于累计查询）
  module TEXT NOT NULL,               -- 模块：evaluation | mcp | code-audit | skills-audit
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,                -- 模型名称
  provider TEXT NOT NULL,             -- 供应商：openai | anthropic | ollama | zhipu | deepseek
  cost_amount DECIMAL(10,6),          -- 估算金额
  cost_currency TEXT,                 -- USD 或 CNY
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES evaluations(id)
)

-- 索引优化
CREATE INDEX idx_token_usages_task_id ON token_usages(task_id)
CREATE INDEX idx_token_usages_session_id ON token_usages(session_id)
CREATE INDEX idx_token_usages_timestamp ON token_usages(timestamp DESC)
```

### 6.2 API 接口

**新增 API**：

| 方法 | 路径 | 描述 | 请求参数 | 响应 |
|-----|------|------|---------|------|
| `GET` | `/api/receipt/:taskId` | 获取任务 Token 小票数据 | `taskId: string` | `TokenReceiptData` |
| `GET` | `/api/receipt/:taskId/session` | 获取会话累计 Token 数据 | `taskId: string` | `TokenReceiptData[]` |
| `POST` | `/api/receipt/pdf` | 生成 PDF 小票 | `{ taskId: string, language: 'zh' \| 'en' }` | PDF 文件流 |
| `GET` | `/api/pricing/models` | 获取价格表支持的模型列表 | - | `PricingModel[]` |

**响应类型**：
```typescript
interface TokenReceiptData {
  taskId: string
  session_id: string
  module: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  costAmount: number | null
  costCurrency: 'USD' | 'CNY' | 'UNMAPPED'
  timestamp: string
  receiptId: string // 格式：TF_YYYYMMDD_HHMMSS_XXXXXX
}

interface PricingModel {
  provider: string
  model: string
  inputPrice: number // 每 1000 tokens 价格
  outputPrice: number
  currency: 'USD' | 'CNY'
}
```

---

## 7. 视觉规范

### 7.1 小票布局规范

**行宽**：固定 48 字符（ASCII 模式）

**区块划分**：
```
[ Logo 区 ]          (8-10 行)
[ 标题区 ]           (2 行)
[ Receipt ID / 日期 ] (3 行)
[ 分隔线 ]           (1 行)
[ 供应商 / 模型 / 模块 ](3 行)
[ 分隔线 ]           (1 行)
[ Token 明细表头 ]    (2 行)
[ Token 明细行 ]     (4-6 行，动态)
[ 分隔线 ]           (1 行)
[ TOTAL 行 ]         (1 行)
[ 分隔线 ]           (1 行)
[ 价格估算 ]         (3 行)
[ 分隔线 ]           (1 行)
[ Footer 口号 ]      (1-2 行)
[ 条形码 ]           (2 行)
[ Receipt ID 文本 ]  (1 行)
```

### 7.2 品牌 Logo 设计

**ASCII 像素 Logo**（48 字符宽度内）：
```
方案 A - 中文听风：
                    ▐▛███▜▌
                   ▝▜█████▛▘
                     ▘▘ ▝▝
                  听风安全评估

方案 B - 英文 WindHear:
 _      _   _   _____  ____   _____ 
| |    | | | | | ____||  _ \ |  ___|
| |    | |_| | |  _|  | |_| ||  ___|
| |___ |  _  | | |___ |  __/ | |___ 
|_____||_| |_| |_____||_|    |_____|
         WindHear Security
```

**HTML 版本 Logo**：
- 使用 SVG 矢量图（复用现有听风 Logo）
- 颜色：主色调 `#1a73e8`（听风蓝）
- 尺寸：宽度 200px，高度 60px

### 7.3 Footer 口号库

**中文版**：
- "代码审完了，预算也死了。"
- "最后一版这个词，本来就不诚实。"
- "画面稳了，预算死了。"
- "安全通过了，钱包受伤了。"
- "漏洞找到了，Token 花掉了。"

**英文版**：
- "Code reviewed. Budget deceased."
- ""Last revision" is an oxymoron."
- "Visual is stable. Budget is dead."
- "Security passed. Wallet hurt."
- "Found vulnerabilities. Spent tokens."

**选择逻辑**：
```typescript
function pickFooter(taskModule: string, hasTip: boolean, language: 'zh' | 'en'): string {
  const tipFooters = {
    zh: "感谢您的慷慨支持！",
    en: "Your generosity is noted. The budget is relieved."
  }
  
  if (hasTip) {
    return tipFooters[language]
  }
  
  const footers = language === 'zh' ? zhFooters : enFooters
  // 根据 module 选择相关性高的 footer
  return footers[Math.floor(Math.random() * footers.length)]
}
```

### 7.4 弹窗视觉设计

**配色方案**：
- 背景遮罩：`rgba(0, 0, 0, 0.6)`
- 弹窗背景：`#ffffff`（亮色主题）
- 小票背景：`#fff9e6`（热敏纸微黄色）
- 文字颜色：`#1a1a1a`（主文字）, `#666`（次要文字）
- 按钮：`#1a73e8`（听风蓝）

**动画效果**：
```css
@keyframes polaroid-appear {
  0% {
    opacity: 0;
    transform: scale(0.9) translate(-50%, -50%);
  }
  100% {
    opacity: 1;
    transform: scale(1) translate(-50%, -50%);
  }
}

.receipt-modal-content {
  animation: polaroid-appear 300ms ease-out;
}
```

---

## 8. 用户体验

### 8.1 触发流程

**场景 1 - 模型评测完成后**：
```
1. 用户提交评测任务
2. 等待评测完成（进度条显示）
3. 评测完成，跳转到报告页面
4. 页面右上角固定位置显示"查看 Token 小票"按钮
5. 用户点击按钮
6. 拍立得弹窗从中心放大淡入
7. 小票显示在弹窗中央
8. 用户可查看 HTML/PDF 下载
```

**场景 2 - Dashboard 查看历史任务**：
```
1. 用户打开 Dashboard
2. "最近完成的任务"表格显示
3. 每行记录末尾有"小票"图标按钮
4. 点击图标，弹出小票窗口
5. 显示该任务的 Token 消耗
```

### 8.2 交互细节

**弹窗操作**：
- 点击遮罩层：不关闭（防止误触）
- 点击右上角 X：关闭弹窗
- 点击"下载 HTML"：立即下载
- 点击"下载 PDF"：立即下载
- 点击"EN / 中文"：实时切换语言

**加载状态**：
- 弹窗打开时，如果数据未加载完成，显示加载动画
- 加载动画：小票轮廓 + 脉冲动画
- 超时处理：超过 5 秒未加载完成，显示"数据加载失败，请重试"

**错误处理**：
- Token 数据缺失：显示"该任务的 Token 数据暂时无法获取"
- 渲染失败：显示 ASCII 错误信息 + 重试按钮

### 8.3 输出格式

**ASCII 代码块**（弹窗内显示）：
```tsx
<pre className="receipt-ascii">
  {asciiReceipt}
</pre>
```

**HTML 下载**：
```typescript
const htmlContent = generateHtmlReceipt(data, language)
const blob = new Blob([htmlContent], { type: 'text/html' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `token-receipt-${taskId}-${timestamp}.html`
a.click()
```

**PDF 下载**：
```typescript
// 方案 A - 前端生成
const pdfDoc = await generatePdfReceipt(data, language)
const pdfBlob = await pdfDoc.save()
download(pdfBlob, `token-receipt-${taskId}-${timestamp}.pdf`)

// 方案 B - 后端生成
const response = await fetch('/api/receipt/pdf', {
  method: 'POST',
  body: JSON.stringify({ taskId, language })
})
const pdfBlob = await response.blob()
download(pdfBlob, `token-receipt-${taskId}-${timestamp}.pdf`)
```

---

## 9. 扩展计划

### 9.1 短期（P1 功能）

| 功能 | 预计工时 | 依赖 |
|-----|---------|------|
| 价格估算（F007） | 3 天 | 价格表整理 |
| 多语言支持（F008） | 2 天 | - |
| 会话级累计（F010） | 3 天 | 数据库迁移 |
| 品牌 Logo（F011） | 1 天 | 设计确认 |

### 9.2 中期（P2 功能）

| 功能 | 预计工时 | 依赖 |
|-----|---------|------|
| 小费模式（F009） | 2 天 | HTML 渲染完成 |
| 趋势分析（F012） | 5 天 | Dashboard 改造 |
| 小票历史（F013） | 3 天 | 数据库查询优化 |

### 9.3 长期（未来规划）

| 功能 | 说明 |
|-----|------|
| 打印优化（F014） | 针对 58mm/80mm 热敏打印机优化排版预设 |
| 分享功能（F015） | 生成带二维码的分享图片，支持一键分享到社交媒体 |
| 成本预警 | Token 消耗超出阈值时，弹窗警告 |
| 预算设置 | 用户可设置每日/每周/每月预算，超预算时阻止任务执行 |

---

## 10. 附录

### 10.1 术语表

| 术语 | 定义 |
|-----|------|
| Token | LLM 计算文本的基本单位，英文约 1 token = 4 字符，中文约 1 token = 1.5 汉字 |
| Input Tokens | 发送给 LLM 的 prompt 消耗的 token |
| Output Tokens | LLM 生成的 response 消耗的 token |
| Cache Read Tokens | 从缓存读取的 token（如 Anthropic Claude 的 prompt caching） |
| Reasoning Tokens | 推理过程消耗的 token（如 o1 模型的思考链，DeepSeek V4-Pro 的思考模式） |
| Receipt ID | 小票唯一标识，格式：`TF_YYYYMMDD_HHMMSS_随机 6 位` |
| Provider | LLM 供应商，如 OpenAI、Anthropic、智谱 GLM、DeepSeek |
| BASE URL | API 基础地址，DeepSeek 提供 OpenAI 格式和 Anthropic 格式两种 |

### 10.2 支持的模型列表

| 供应商 | 模型 | 上下文长度 | 输出长度 | 特殊功能 |
|--------|------|----------|---------|---------|
| OpenAI | GPT-5, GPT-4.1, GPT-4o, Codex, o3, o4-mini | - | - | - |
| Anthropic | Claude Opus/Sonnet/Haiku | - | - | Prompt Caching |
| 智谱 GLM | glm-4-flash, glm-4.7 | - | - | - |
| **DeepSeek** | **deepseek-v4-flash** | 1M | 384K | 非思考模式，FIM 补全 |
| **DeepSeek** | **deepseek-v4-pro** | 1M | 384K | 思考模式，FIM 补全 |
| Ollama | 本地部署模型 | - | - | 免费 |

### 10.3 参考资料

1. [token-receipt 项目](https://github.com/Hchen1218/token-receipt) - ASCII 热敏纸小票渲染引擎
2. [chrishutchinson/claude-receipts](https://github.com/chrishutchinson/claude-receipts) - Claude Code token 小票工具
3. PDFKit - https://pdfkit.org/
4. jsPDF - https://github.com/parallax/jsPDF

---

**文档版本**: v1.0  
**创建时间**: 2026-06-08  
**最后更新**: 2026-06-08  
**状态**: 待评审
