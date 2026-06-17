import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import {
  LIGHT_COLORS, PAGE, registerFonts, contentDisposition, buildReportFilename,
  drawCoverTitle, drawScoreBoard,
  drawH1, drawSeverityTag, drawBodyText,
  drawTable,
  ensureSpace, postProcessPages,
  FONT_SIZES,
} from '../pdfCommon.js'

// PDFKit 文档实例类型
type PDFDoc = InstanceType<typeof PDFDocument>

// 评估数据接口
interface EvaluationData {
  name: string
  status: string
  passRate: number
  passCount: number
  failCount: number
  totalCount: number
  standard: string
  targetModel: string
  targetProvider: string
  createdAt?: number
}

// 评估项接口
interface EvalItem {
  riskType: string
  riskSubType: string
  inputPrompt: string
  modelOutput: string
  evaluatorScore: number | null
  evaluatorRawOutput: string | null
}

// 评估状态中文映射
const EVAL_STATUS_ZH: Record<string, string> = {
  completed: '已完成',
  running: '运行中',
  pending: '待运行',
  failed: '失败',
  cancelled: '已取消',
}

/**
 * 生成LLM 模型评估PDF报告并流式输出到HTTP响应
 */
export function generateEvaluationPdfReport(evaluation: EvaluationData, items: EvalItem[], res: Response): void {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.MARGIN_TOP, bottom: PAGE.MARGIN_BOTTOM, left: PAGE.MARGIN_LEFT, right: PAGE.MARGIN_RIGHT },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: `模型安全评估报告 - ${evaluation.name}`,
      Author: '听风',
      Subject: '模型安全评估报告',
    }
  })

  // 注册字体
  let fonts: ReturnType<typeof registerFonts>
  try {
    fonts = registerFonts(doc)
  } catch (err) {
    console.error('[evalPdfReport] 字体注册失败:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF 字体注册失败，请联系管理员' })
    }
    return
  }
  const { reg: regFont, aero: aeroFont, song: songFont, fang: fangFont, tnr: tnrFont } = fonts

  // 设置响应头
  const filename = buildReportFilename(evaluation.name, evaluation.createdAt, 'pdf', 'evaluation')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', contentDisposition(filename))

  doc.pipe(res)

  try {
    // 绘制封面页
    doc.addPage()
    drawCoverPage(doc, evaluation, items, regFont, aeroFont, songFont, fangFont, tnrFont)

    // 绘制评估项目详情页
    drawDetailPages(doc, items, regFont, aeroFont, songFont, fangFont, tnrFont)

    // 后处理：页眉页脚
    const reportId = `EVAL-${Date.now().toString(36).toUpperCase()}`
    postProcessPages(doc, reportId, evaluation.name)

    doc.end()
  } catch (err) {
    console.error('[evalPdfReport] PDF 生成出错:', err)
    try { doc.end() } catch { /* ignore */ }
    try { res.end() } catch { /* ignore */ }
  }
}

/**
 * 绘制封面页
 */
function drawCoverPage(
  doc: PDFDoc, evaluation: EvaluationData, items: EvalItem[],
  regFont: string, aeroFont: string, songFont: string, fangFont: string, tnrFont: string
): void {
  // 封面主标题：二号 航天腾飞体 居中
  drawCoverTitle(doc, '模型安全评估报告', `${evaluation.name}-${new Date().toLocaleString('zh-CN')}`)

  // 评分板
  const passRate = Math.round((evaluation.passRate ?? 0) * 100)
  doc.y = 300
  doc.moveDown(1)
  drawScoreBoard(doc, {
    score: passRate,
    scoreLabel: '通过率',
    stats: [
      { label: '总测试数', value: String(evaluation.totalCount ?? 0), color: LIGHT_COLORS.text },
      { label: '通过数', value: String(evaluation.passCount ?? 0), color: LIGHT_COLORS.green },
      { label: '未通过数', value: String(evaluation.failCount ?? 0), color: LIGHT_COLORS.critical },
    ],
    regFont,
    boldFont: regFont,
  })

  // 评估元信息（表格：标签用方正风雅宋，居中留白）
  doc.moveDown(1.5)
  const statusZh = EVAL_STATUS_ZH[evaluation.status] || evaluation.status || '-'
  drawTable(doc, [
    { label: '评估名称', value: evaluation.name || '-' },
    { label: '评估标准', value: evaluation.standard || '-' },
    { label: '目标模型', value: evaluation.targetModel || evaluation.targetProvider || '-' },
    { label: '目标提供商', value: evaluation.targetProvider || '-' },
    { label: '评估状态', value: statusZh },
    { label: '总测试数', value: String(evaluation.totalCount ?? 0) },
    { label: '通过数', value: String(evaluation.passCount ?? 0) },
    { label: '未通过数', value: String(evaluation.failCount ?? 0) },
  ], { regFont, aeroFont, fangFont, tnrFont, fontSize: FONT_SIZES.body, center: true, labelWidth: 110 })

  // 生成时间
  doc.moveDown(1.5)
  doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
    .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' })
    .text('听风', PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' })
}

/**
 * 绘制评估项目详情页
 * 一级标题：评估项目详情（三号居中）
 * 二级标题：#1 风险类型（小三 方正风雅宋），等级标签（小三 航天腾飞体）
 * 三级标题：评估结果/评分/输入/输出（四号 方正风雅宋）
 */
function drawDetailPages(
  doc: PDFDoc, items: EvalItem[],
  regFont: string, aeroFont: string, songFont: string, fangFont: string, tnrFont: string
): void {
  if (items.length === 0) return

  doc.addPage()
  // 一级标题：三号 居中
  drawH1(doc, '评估项目详情', aeroFont)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const score = item.evaluatorScore
    const isPass = score === 0

    ensureSpace(doc, 100)

    // 二级标题行：等级标签（小三 航天腾飞体） + 编号+风险类型（小三 方正风雅宋）
    const tagSeverity = isPass ? 'low' : 'critical'
    const titleY = doc.y
    const sevTag = drawSeverityTag(doc, tagSeverity, aeroFont, PAGE.MARGIN_LEFT, titleY)

    doc.font(fangFont).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.text)
      .text(`#${i + 1} ${item.riskType || '未知'}`, PAGE.MARGIN_LEFT + sevTag.width + 10, titleY + 2, { width: PAGE.CONTENT_WIDTH - sevTag.width - 10 })
    doc.moveDown(0.4)

    // 子类型（如果有）
    if (item.riskSubType) {
      doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.textSecondary)
        .text('子类型:', PAGE.MARGIN_LEFT)
      drawBodyText(doc, item.riskSubType, { x: PAGE.MARGIN_LEFT, font: songFont })
      doc.moveDown(0.2)
    }

    // 评估结果 — 三级标题（四号 方正风雅宋），内容直接跟在冒号后
    const resultLabel = isPass ? '通过' : '未通过'
    doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.textSecondary)
      .text('评估结果: ', PAGE.MARGIN_LEFT, doc.y, { continued: true })
    doc.font(songFont).fontSize(FONT_SIZES.h3).fillColor(isPass ? LIGHT_COLORS.green : LIGHT_COLORS.critical)
      .text(resultLabel)
    doc.moveDown(0.2)

    // 评分 — 三级标题，内容直接跟在冒号后
    if (score != null) {
      doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.textSecondary)
        .text('评分: ', PAGE.MARGIN_LEFT, doc.y, { continued: true })
      doc.font(tnrFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.text)
        .text(String(score))
      doc.moveDown(0.2)
    }

    // 输入 — 三级标题（四号 方正风雅宋），内容平铺
    const promptText = (item.inputPrompt || '').length > 500
      ? (item.inputPrompt || '').slice(0, 500) + '...'
      : (item.inputPrompt || '')
    if (promptText) {
      doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.textSecondary)
        .text('输入:', PAGE.MARGIN_LEFT)
      drawBodyText(doc, promptText, { x: PAGE.MARGIN_LEFT, width: PAGE.CONTENT_WIDTH })
      doc.moveDown(0.3)
    }

    // 输出 — 三级标题，内容平铺
    const outputText = (item.modelOutput || '').length > 500
      ? (item.modelOutput || '').slice(0, 500) + '...'
      : (item.modelOutput || '')
    if (outputText) {
      doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.textSecondary)
        .text('输出:', PAGE.MARGIN_LEFT)
      drawBodyText(doc, outputText, { x: PAGE.MARGIN_LEFT, width: PAGE.CONTENT_WIDTH })
      doc.moveDown(0.3)
    }

    // 分隔线
    doc.moveTo(PAGE.MARGIN_LEFT, doc.y).lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, doc.y)
      .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke()
    doc.moveDown(0.5)
  }
}