/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COLORS = {
    background: '#0f172a', card: '#1e293b', text: '#f1f5f9', textSecondary: '#94a3b8',
    border: '#334155', green: '#22c55e', red: '#ef4444', blue: '#3b82f6',
    descText: '#cbd5e1',
};
const FONT_REGULAR = 'CN';
const FONT_BOLD = 'CN-Bold';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
/**
 * 生成LLM 模型评估PDF报告并流式输出到HTTP响应
 */
export function generateEvaluationPdfReport(evaluation, items, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        bufferPages: true,
        autoFirstPage: false,
        info: {
            Title: `模型安全评估报告 - ${evaluation.name}`,
            Author: '听风',
            Subject: '模型安全评估报告',
        }
    });
    const fontsDir = path.join(__dirname, '../fonts');
    const fontRegular = path.join(fontsDir, 'NotoSansSC-Regular.ttf');
    const fontBold = path.join(fontsDir, 'NotoSansSC-Bold.ttf');
    const hasRegular = fs.existsSync(fontRegular);
    const hasBold = fs.existsSync(fontBold);
    if (hasRegular)
        doc.registerFont(FONT_REGULAR, fontRegular);
    if (hasBold)
        doc.registerFont(FONT_BOLD, fontBold);
    const regFont = hasRegular ? FONT_REGULAR : 'Helvetica';
    const boldFont = hasBold ? FONT_BOLD : (hasRegular ? FONT_REGULAR : 'Helvetica-Bold');
    const filename = `eval-report-${evaluation.name}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);
    doc.on('pageAdded', () => { fillPageBackground(doc); });
    // 封面页
    doc.addPage();
    fillPageBackground(doc);
    doc.font(boldFont).fontSize(28).fillColor(COLORS.text)
        .text('模型安全评估报告', { align: 'center' });
    doc.moveDown(0.5);
    doc.font(regFont).fontSize(14).fillColor(COLORS.textSecondary)
        .text(evaluation.name, { align: 'center' });
    doc.moveDown(2);
    // 通过率环
    const passRate = Math.round((evaluation.passRate ?? 0) * 100);
    const ringSize = 120;
    const ringX = (PAGE_WIDTH - ringSize) / 2;
    drawPassRateRing(doc, ringX, doc.y, ringSize, passRate, boldFont, regFont);
    doc.y += ringSize + 20;
    // 统计卡片
    const cardW = (CONTENT_WIDTH - 20) / 3;
    const cardH = 60;
    const startX = MARGIN_LEFT;
    const startY = doc.y;
    const passCount = evaluation.passCount ?? 0;
    const failCount = evaluation.failCount ?? 0;
    const totalCount = evaluation.totalCount ?? 0;
    const cards = [
        { label: '总测试数', value: String(totalCount), color: COLORS.text },
        { label: '通过数', value: String(passCount), color: COLORS.green },
        { label: '未通过数', value: String(failCount), color: COLORS.red },
    ];
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cx = startX + i * (cardW + 10);
        doc.roundedRect(cx, startY, cardW, cardH, 6).fill(COLORS.card);
        doc.font(boldFont).fontSize(24).fillColor(card.color)
            .text(card.value, cx, startY + 8, { width: cardW, align: 'center' });
        doc.font(regFont).fontSize(9).fillColor(COLORS.textSecondary)
            .text(card.label, cx, startY + 38, { width: cardW, align: 'center' });
    }
    doc.y = startY + cardH + 16;
    // 元信息
    doc.moveDown(1);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary);
    const infoLines = [
        `评估标准: ${evaluation.standard || '-'}`,
        `目标模型: ${evaluation.targetModel || evaluation.targetProvider || '-'}`,
        `评估状态: ${evaluation.status}`,
    ];
    for (const line of infoLines)
        doc.text(line, { align: 'center' });
    doc.moveDown(1.5);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' })
        .text('听风', { align: 'center' });
    // 评估项目详情
    if (items.length > 0) {
        doc.addPage();
        fillPageBackground(doc);
        doc.font(boldFont).fontSize(18).fillColor(COLORS.text).text('评估项目详情', MARGIN_LEFT);
        doc.moveDown(0.5);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const score = item.evaluatorScore;
            const isPass = score != null ? score > 0 : true;
            ensureSpace(doc, 60);
            // 评分标记
            const markerColor = isPass ? COLORS.green : COLORS.red;
            doc.rect(MARGIN_LEFT, doc.y, 4, 14).fill(markerColor);
            doc.font(boldFont).fontSize(12).fillColor(markerColor)
                .text(` ${isPass ? 'PASS' : 'FAIL'}`, MARGIN_LEFT + 8, doc.y, { continued: true });
            doc.font(regFont).fontSize(12).fillColor(COLORS.text)
                .text(`  #${i + 1} ${item.riskType || ''}`, { width: CONTENT_WIDTH - 10 });
            doc.moveDown(0.2);
            if (item.riskSubType) {
                doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
                    .text(`子类型: ${item.riskSubType}`, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
                doc.moveDown(0.1);
            }
            // 输入prompt截断显示
            const promptText = (item.inputPrompt || '').length > 200 ? (item.inputPrompt || '').slice(0, 200) + '...' : (item.inputPrompt || '');
            doc.font(regFont).fontSize(10).fillColor(COLORS.descText)
                .text(`输入: ${promptText}`, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
            doc.moveDown(0.3);
            doc.moveTo(MARGIN_LEFT, doc.y).lineTo(PAGE_WIDTH - MARGIN_RIGHT, doc.y)
                .strokeColor(COLORS.border).lineWidth(0.3).stroke();
            doc.moveDown(0.3);
        }
    }
    // 页眉页脚
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const savedY = doc.y;
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`听风 | ${evaluation.name}`, MARGIN_LEFT, 25, { lineBreak: false, width: CONTENT_WIDTH, height: 12 });
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`${i + 1} / ${totalPages}`, MARGIN_LEFT, PAGE_HEIGHT - 35, { lineBreak: false, width: CONTENT_WIDTH, align: 'center', height: 12 });
        doc.y = savedY;
    }
    doc.end();
}
function drawPassRateRing(doc, x, y, size, rate, boldFont, regFont) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size / 2 - 10;
    const lineW = 8;
    doc.circle(cx, cy, radius).lineWidth(lineW).strokeColor(COLORS.border).stroke();
    const color = rate >= 80 ? COLORS.green : rate >= 50 ? '#eab308' : COLORS.red;
    if (rate > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (2 * Math.PI * rate / 100);
        const startX = cx + radius * Math.cos(startAngle);
        const startY = cy + radius * Math.sin(startAngle);
        const endX = cx + radius * Math.cos(endAngle);
        const endY = cy + radius * Math.sin(endAngle);
        const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
        doc.path(`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`)
            .lineWidth(lineW).strokeColor(color).stroke();
    }
    doc.font(boldFont).fontSize(30).fillColor(color)
        .text(`${rate}%`, x, cy - 15, { width: size, align: 'center' });
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text('通过率', x, cy + 18, { width: size, align: 'center' });
}
function ensureSpace(doc, neededHeight) {
    if (doc.y + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        fillPageBackground(doc);
    }
}
function fillPageBackground(doc) {
    doc.save();
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.background);
    doc.restore();
}
