import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import {
  LIGHT_COLORS, PAGE, registerFonts, contentDisposition, buildReportFilename,
  drawCoverTitle, drawScoreBoard,
  drawH1, drawCodeBlock, drawSeverityTag, drawLineTag, drawBodyText,
  drawTable, drawSeverityBar,
  ensureSpace, postProcessPages,
  SEVERITY_ZH, STATUS_ZH, FONT_SIZES,
} from '../pdfCommon.js'

/** PDFKit 文档实例类型 */
type PDFDoc = InstanceType<typeof PDFDocument>

/** MCP扫描发现项的严重度等级 */
type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** 证据条目 */
interface EvidenceItem {
  file: string
  lineStart?: number
  lineEnd?: number
  snippet?: string
}

/** MCP扫描发现项 */
interface McpFinding {
  title?: string
  severity?: SeverityLevel
  category?: string
  confidence?: string
  status?: string
  description?: string
  impact?: string
  exploitation?: string
  remediation?: string
  evidence?: EvidenceItem[]
}

/** MCP评估报告数据接口 */
interface McpPdfReportData {
  name: string
  originalFilename?: string
  status: string
  scoreTotal: number
  scoreRiskLevel: string
  projectInfo: {
    rootName: string
    languages: string[]
    frameworks: string[]
    mcpIndicators: string[]
    fileStats: { totalFiles: number; totalBytes: number }
    projectPath?: string
    mcpServersCount?: number
  }
  findings: McpFinding[]
  createdAt?: number
}

const SEVERITY_ORDER: readonly SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info']

/**
 * 生成MCP评估PDF报告并流式输出到HTTP响应
 */
export function generateMcpPdfReport(data: McpPdfReportData, res: Response): void {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.MARGIN_TOP, bottom: PAGE.MARGIN_BOTTOM, left: PAGE.MARGIN_LEFT, right: PAGE.MARGIN_RIGHT },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: `MCP安全评估报告 - ${data.name}`,
      Author: '听风',
      Subject: 'MCP安全评估报告',
    },
  })

  let fonts: ReturnType<typeof registerFonts>
  try {
    fonts = registerFonts(doc)
  } catch (err) {
    console.error('[mcpPdfReport] 字体注册失败:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF 字体注册失败，请联系管理员' })
    }
    return
  }
  const { reg, mono, aero, song, fang, tnr } = fonts

  const filename = buildReportFilename(data.name, data.createdAt, 'pdf', 'mcp-scan')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', contentDisposition(filename))

  doc.pipe(res)

  try {
    // 封面页
    doc.addPage()
    drawCoverPage(doc, data, reg, aero, song, fang, tnr)

    // 漏洞详情页
    drawVulnerabilityPages(doc, data, reg, mono, aero, song, fang)

    // 后处理
    const reportId = `MCP-${Date.now()}`
    postProcessPages(doc, reportId, 'MCP安全评估')

    doc.end()
  } catch (err) {
    console.error('[mcpPdfReport] PDF 生成出错:', err)
    try { doc.end() } catch { /* ignore */ }
    try { res.end() } catch { /* ignore */ }
  }
}

/** 绘制封面页 */
function drawCoverPage(doc: PDFDoc, data: McpPdfReportData, reg: string, aero: string, song: string, fang: string, tnr: string): void {
  // 封面主标题：二号 航天腾飞体 居中
  drawCoverTitle(doc, 'MCP 安全评估报告', `${data.name}-${new Date().toLocaleString('zh-CN')}`)

  // 评分板
  const sevCount = countSeverities(data.findings)
  doc.y = 300
  doc.moveDown(1)
  drawScoreBoard(doc, {
    score: data.scoreTotal ?? 0,
    scoreLabel: '风险评分',
    stats: [
      { label: '发现总数', value: String(data.findings.length), color: LIGHT_COLORS.text },
      { label: '严重漏洞', value: String(sevCount.critical), color: LIGHT_COLORS.critical },
      { label: '高危漏洞', value: String(sevCount.high), color: LIGHT_COLORS.high },
      { label: '中危漏洞', value: String(sevCount.medium), color: LIGHT_COLORS.medium },
    ],
    regFont: reg,
    boldFont: reg,
  })

  // 严重度分布条
  drawSeverityBar(doc, sevCount, data.findings.length)

  // 项目信息（表格：标签方正风雅宋，居中留白）
  doc.moveDown(1.5)
  const info = data.projectInfo
  const riskLevelZh = SEVERITY_ZH[(data.scoreRiskLevel || 'info').toUpperCase()] || data.scoreRiskLevel || '-'
  drawTable(doc, [
    { label: '项目名称', value: data.name || '-' },
    { label: '原始文件', value: data.originalFilename || '-' },
    { label: '项目路径', value: info.projectPath || info.rootName || '-' },
    { label: '编程语言', value: (info.languages || []).join(', ') || '-' },
    { label: '框架', value: (info.frameworks || []).join(', ') || '-' },
    { label: 'MCP Servers', value: info.mcpServersCount !== undefined ? String(info.mcpServersCount) : '-' },
    { label: 'MCP指标', value: (info.mcpIndicators || []).join(', ') || '-' },
    { label: '文件数', value: info.fileStats ? String(info.fileStats.totalFiles) : '-' },
    { label: '风险等级', value: riskLevelZh },
  ], { regFont: reg, aeroFont: aero, fangFont: fang, tnrFont: tnr })

  doc.moveDown(0.8)
  doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
    .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' })
}

/** 统计各严重度数量 */
function countSeverities(findings: McpFinding[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of findings) {
    const s = f.severity || 'info'
    if (counts[s] !== undefined) counts[s]++
  }
  return counts
}

/** 按严重度分组 */
function groupBySeverity(items: McpFinding[]): Record<SeverityLevel, McpFinding[]> {
  const grouped: Record<SeverityLevel, McpFinding[]> = {
    critical: [], high: [], medium: [], low: [], info: [],
  }
  for (const item of items) {
    const sev: SeverityLevel = item.severity || 'info'
    if (grouped[sev]) grouped[sev].push(item)
  }
  return grouped
}

/**
 * 绘制漏洞详情页
 * 一级标题：高危 (1) — 三号居中
 * 二级标题：1.漏洞标题 — 小三方正风雅宋，等级标签小三航天腾飞体
 * 三级标题：影响/利用方式/修复方式 — 四号方正风雅宋
 */
function drawVulnerabilityPages(
  doc: PDFDoc, data: McpPdfReportData,
  reg: string, mono: string, aero: string, song: string, fang: string
): void {
  if (!data.findings || data.findings.length === 0) return

  const grouped = groupBySeverity(data.findings)
  let vulnIndex = 0

  for (const sev of SEVERITY_ORDER) {
    const items = grouped[sev]
    if (!items?.length) continue

    doc.addPage()

    // 一级标题：高危 (1) — 三号 居中
    const sevLabel = SEVERITY_ZH[sev.toUpperCase()] || sev
    drawH1(doc, `${sevLabel} (${items.length})`, aero)

    for (const item of items) {
      vulnIndex++
      ensureSpace(doc, 100)
      drawVulnCard(doc, item, sev, vulnIndex, reg, mono, aero, song, fang)
    }
  }
}

/** 绘制单个漏洞卡片 */
function drawVulnCard(
  doc: PDFDoc, item: McpFinding, severity: SeverityLevel, index: number,
  reg: string, mono: string, aero: string, song: string, fang: string
): void {
  const indent = PAGE.MARGIN_LEFT + 8
  const contentW = PAGE.CONTENT_WIDTH - 16

  // 二级标题行：等级标签（小三 航天腾飞体） + 编号+标题（小三 方正风雅宋）
  ensureSpace(doc, 30)
  const titleY = doc.y
  const tag = drawSeverityTag(doc, severity, aero, indent, titleY)
  doc.font(fang).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.textHeading)
    .text(`${index}. ${item.title || '未命名漏洞'}`, indent + tag.width + 10, titleY + 2, { width: contentW - tag.width - 10 })
  doc.moveDown(0.3)

  // 元信息（状态英文→中文）
  const meta: string[] = []
  if (item.category) meta.push(`类别: ${item.category || ''}`)
  if (item.confidence) {
    const confStr = String(item.confidence)
    const confZh = STATUS_ZH[confStr.toLowerCase()] || confStr
    meta.push(`置信度: ${confZh}`)
  }
  if (item.status) {
    const statusStr = String(item.status)
    const statusZh = STATUS_ZH[statusStr.toLowerCase()] || statusStr
    meta.push(`状态: ${statusZh}`)
  }
  if (meta.length > 0) {
    ensureSpace(doc, 20)
    doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
      .text(meta.join('  |  '), indent, doc.y, { width: contentW })
    doc.moveDown(0.3)
  }

  // 描述
  if (item.description) {
    const descH = doc.font(song).fontSize(FONT_SIZES.body).heightOfString(item.description, { width: contentW })
    ensureSpace(doc, Math.min(descH + 10, 80))
    drawBodyText(doc, item.description, { x: indent, width: contentW })
    doc.moveDown(0.3)
  }

  // 影响 — 三级标题（四号 方正风雅宋）
  if (item.impact) {
    ensureSpace(doc, 40)
    doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.critical).text('影响:', indent)
    drawBodyText(doc, item.impact, { x: indent, width: contentW })
    doc.moveDown(0.3)
  }

  // 利用方式 — 三级标题
  if (item.exploitation) {
    ensureSpace(doc, 40)
    doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.purple).text('利用方式:', indent)
    drawBodyText(doc, item.exploitation, { x: indent, width: contentW })
    doc.moveDown(0.3)
  }

  // 证据
  if (item.evidence && Array.isArray(item.evidence) && item.evidence.length > 0) {
    for (const ev of item.evidence) {
      ensureSpace(doc, 30)

      // 文件：+ 行号 — bodyLarge字号(13pt)
      const fileY = doc.y
      const lineLabel = ev.lineStart ? `L${ev.lineStart}${ev.lineEnd && ev.lineEnd !== ev.lineStart ? `-${ev.lineEnd}` : ''}` : ''
      doc.font(song).fontSize(FONT_SIZES.bodyLarge).fillColor(LIGHT_COLORS.textSecondary)
        .text(`文件: ${ev.file || ''}${lineLabel ? '  ' : ''}`, indent, fileY, { width: contentW - 80 })
      if (lineLabel) {
        // 行号标签居右
        const lineLabelW = lineLabel.length * 7 + 16
        drawLineTag(doc, lineLabel, mono, indent + contentW - lineLabelW, fileY)
      }
      doc.y = fileY + 18

      if (ev.snippet) {
        drawCodeBlock(doc, {
          label: '代码片段',
          code: ev.snippet || '',
          labelColor: LIGHT_COLORS.textSecondary,
          x: indent,
          regFont: reg,
          boldFont: reg,
          monoFont: mono,
        })
      }
    }
    doc.moveDown(0.2)
  }

  // 修复方式 — 三级标题
  if (item.remediation) {
    const fixH = doc.font(song).fontSize(FONT_SIZES.body).heightOfString(item.remediation, { width: contentW })
    ensureSpace(doc, Math.min(fixH + 20, 60))
    doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.green).text('修复方式:', indent)
    drawBodyText(doc, item.remediation, { x: indent, width: contentW })
    doc.moveDown(0.3)
  }

  // 分隔线
  doc.moveDown(0.5)
  ensureSpace(doc, 20)
  doc.moveTo(PAGE.MARGIN_LEFT, doc.y).lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, doc.y)
    .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke()
  doc.moveDown(0.5)
}