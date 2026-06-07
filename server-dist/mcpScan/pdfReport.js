/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 颜色常量（暗色主题）
const COLORS = {
    background: '#0f172a',
    card: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    info: '#6b7280',
    codeBlock: '#0f172a',
    border: '#334155',
    green: '#22c55e',
    purple: '#a78bfa',
    codeText: '#e2e8f0',
    descText: '#cbd5e1',
};
const SEVERITY_LABELS = {
    critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息'
};
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const FONT_REGULAR = 'CN';
const FONT_BOLD = 'CN-Bold';
const FONT_MONO = 'Mono';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
/**
 * 生成MCP评估PDF报告并流式输出到HTTP响应
 */
export function generateMcpPdfReport(data, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        bufferPages: true,
        autoFirstPage: false,
        info: {
            Title: `MCP安全评估报告 - ${data.name}`,
            Author: '听风',
            Subject: 'MCP安全评估报告',
        }
    });
    // 注册中文字体
    const fontsDir = path.join(__dirname, '../fonts');
    const fontRegular = path.join(fontsDir, 'NotoSansSC-Regular.ttf');
    const fontBold = path.join(fontsDir, 'NotoSansSC-Bold.ttf');
    const fontMono = path.join(fontsDir, 'NotoSansMono-Regular.ttf');
    const hasRegular = fs.existsSync(fontRegular);
    const hasBold = fs.existsSync(fontBold);
    const hasMono = fs.existsSync(fontMono);
    if (hasRegular)
        doc.registerFont(FONT_REGULAR, fontRegular);
    if (hasBold)
        doc.registerFont(FONT_BOLD, fontBold);
    if (hasMono)
        doc.registerFont(FONT_MONO, fontMono);
    const regFont = hasRegular ? FONT_REGULAR : 'Helvetica';
    const boldFont = hasBold ? FONT_BOLD : (hasRegular ? FONT_REGULAR : 'Helvetica-Bold');
    const monoFont = hasMono ? FONT_MONO : 'Courier';
    // 设置响应头
    const filename = `mcp-report-${data.name}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);
    doc.on('pageAdded', () => { fillPageBackground(doc); });
    // 封面页
    doc.addPage();
    drawCoverPage(doc, data, regFont, boldFont);
    // 漏洞详情页
    drawVulnerabilityPages(doc, data, regFont, boldFont, monoFont);
    // 页眉页脚
    postProcessPages(doc, data, regFont);
    doc.end();
}
function postProcessPages(doc, data, regFont) {
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const savedY = doc.y;
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`听风 | ${data.name}`, MARGIN_LEFT, 25, { lineBreak: false, width: CONTENT_WIDTH, height: 12 });
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`${i + 1} / ${totalPages}`, MARGIN_LEFT, PAGE_HEIGHT - 35, { lineBreak: false, width: CONTENT_WIDTH, align: 'center', height: 12 });
        doc.y = savedY;
    }
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
function drawCoverPage(doc, data, regFont, boldFont) {
    fillPageBackground(doc);
    doc.font(boldFont).fontSize(28).fillColor(COLORS.text)
        .text('MCP 安全评估报告', { align: 'center' });
    doc.moveDown(0.5);
    doc.font(regFont).fontSize(14).fillColor(COLORS.textSecondary)
        .text(data.name, { align: 'center' });
    doc.moveDown(2);
    // 评分环
    const ringSize = 120;
    const ringX = (PAGE_WIDTH - ringSize) / 2;
    drawScoreRing(doc, ringX, doc.y, ringSize, data.scoreTotal, boldFont, regFont);
    doc.y += ringSize + 20;
    // 统计卡片
    const sevCount = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of data.findings) {
        const s = f.severity || 'info';
        if (sevCount[s] !== undefined)
            sevCount[s]++;
    }
    const cardW = (CONTENT_WIDTH - 30) / 4;
    const cardH = 60;
    const startX = MARGIN_LEFT;
    const startY = doc.y;
    const cards = [
        { label: '发现总数', value: String(data.findings.length), color: COLORS.text },
        { label: '严重漏洞', value: String(sevCount.critical), color: COLORS.critical },
        { label: '高危漏洞', value: String(sevCount.high), color: COLORS.high },
        { label: '中危漏洞', value: String(sevCount.medium), color: COLORS.medium },
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
    // 严重度分布条
    drawSeverityBar(doc, sevCount, data.findings.length, regFont);
    // 项目信息
    doc.moveDown(1.5);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary);
    const info = data.projectInfo;
    const infoLines = [
        `项目名称: ${data.name}`,
        `编程语言: ${info.languages?.join(', ') || 'Unknown'}`,
        `框架: ${info.frameworks?.join(', ') || '-'}`,
        `文件数: ${info.fileStats?.totalFiles ?? '-'}`,
        `风险等级: ${data.scoreRiskLevel}`,
    ];
    for (const line of infoLines) {
        doc.text(line, { align: 'center' });
    }
    doc.moveDown(1.5);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' })
        .text('听风', { align: 'center' });
}
function drawScoreRing(doc, x, y, size, score, boldFont, regFont) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size / 2 - 10;
    const lineW = 8;
    doc.circle(cx, cy, radius).lineWidth(lineW).strokeColor(COLORS.border).stroke();
    const scoreVal = Math.min(Math.max(score, 0), 100);
    const scoreColor = scoreVal >= 70 ? COLORS.critical : scoreVal >= 40 ? COLORS.high : scoreVal >= 20 ? COLORS.medium : COLORS.green;
    if (scoreVal > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (2 * Math.PI * scoreVal / 100);
        drawArc(doc, cx, cy, radius, startAngle, endAngle, lineW, scoreColor);
    }
    doc.font(boldFont).fontSize(30).fillColor(scoreColor)
        .text(String(scoreVal), x, cy - 15, { width: size, align: 'center' });
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text('风险评分', x, cy + 18, { width: size, align: 'center' });
}
function drawArc(doc, cx, cy, r, startAngle, endAngle, lineW, color) {
    const startX = cx + r * Math.cos(startAngle);
    const startY = cy + r * Math.sin(startAngle);
    const endX = cx + r * Math.cos(endAngle);
    const endY = cy + r * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    const d = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
    doc.path(d).lineWidth(lineW).strokeColor(color).stroke();
}
function drawSeverityBar(doc, severityCount, findingsCount, regFont) {
    if (findingsCount === 0)
        return;
    const barW = CONTENT_WIDTH;
    const barH = 10;
    const startX = MARGIN_LEFT;
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary).text('严重度分布', startX, doc.y);
    doc.moveDown(0.3);
    const barY = doc.y;
    doc.roundedRect(startX, barY, barW, barH, 3).fill(COLORS.border);
    let offsetX = 0;
    for (const sev of SEVERITY_ORDER) {
        const count = severityCount[sev] || 0;
        if (count === 0)
            continue;
        const segW = (count / findingsCount) * barW;
        if (segW > 0)
            doc.roundedRect(startX + offsetX, barY, Math.max(segW, 2), barH, 3).fill(COLORS[sev]);
        offsetX += segW;
    }
    doc.y = barY + barH + 6;
    const legendParts = [];
    for (const sev of SEVERITY_ORDER) {
        const count = severityCount[sev] || 0;
        if (count > 0)
            legendParts.push(`${SEVERITY_LABELS[sev]}: ${count}`);
    }
    doc.font(regFont).fontSize(9).fillColor(COLORS.textSecondary)
        .text(legendParts.join('   |   '), startX, doc.y, { width: barW, align: 'center' });
}
function groupBySeverity(items) {
    const grouped = {};
    for (const sev of SEVERITY_ORDER)
        grouped[sev] = [];
    for (const item of items) {
        const sev = item.severity || 'info';
        if (grouped[sev])
            grouped[sev].push(item);
        else
            grouped[sev] = [item];
    }
    return grouped;
}
function drawVulnerabilityPages(doc, data, regFont, boldFont, monoFont) {
    if (!data.findings || data.findings.length === 0)
        return;
    const grouped = groupBySeverity(data.findings);
    let vulnIndex = 0;
    for (const sev of SEVERITY_ORDER) {
        const items = grouped[sev];
        if (!items?.length)
            continue;
        doc.addPage();
        fillPageBackground(doc);
        doc.rect(MARGIN_LEFT, doc.y, 4, 20).fill(COLORS[sev]);
        doc.font(boldFont).fontSize(18).fillColor(COLORS[sev])
            .text(` ${SEVERITY_LABELS[sev]} (${items.length})`, MARGIN_LEFT + 8);
        doc.moveDown(0.5);
        for (const item of items) {
            vulnIndex++;
            ensureSpace(doc, 100);
            drawVulnCard(doc, item, sev, vulnIndex, regFont, boldFont, monoFont);
        }
    }
}
function drawVulnCard(doc, item, severity, index, regFont, boldFont, monoFont) {
    // 标题行
    doc.rect(MARGIN_LEFT, doc.y, 4, 16).fill(COLORS[severity]);
    const titleY = doc.y;
    doc.font(boldFont).fontSize(14).fillColor(COLORS[severity])
        .text(`${index}. ${SEVERITY_LABELS[severity] || severity}`, MARGIN_LEFT + 8, titleY, { continued: true });
    doc.font(boldFont).fontSize(14).fillColor(COLORS.text)
        .text(`  ${item.title || '未命名漏洞'}`, { width: CONTENT_WIDTH - 10 });
    doc.moveDown(0.2);
    // 元信息
    const meta = [];
    if (item.category)
        meta.push(`类别: ${item.category}`);
    if (item.confidence)
        meta.push(`置信度: ${item.confidence}`);
    if (item.status)
        meta.push(`状态: ${item.status}`);
    if (meta.length > 0) {
        ensureSpace(doc, 20);
        doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
            .text(meta.join('  |  '), MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 描述
    if (item.description) {
        const descH = doc.font(regFont).fontSize(11).heightOfString(item.description, { width: CONTENT_WIDTH - 10 });
        ensureSpace(doc, Math.min(descH + 10, 80));
        doc.font(regFont).fontSize(11).fillColor(COLORS.descText)
            .text(item.description, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 影响
    if (item.impact) {
        ensureSpace(doc, 40);
        doc.font(boldFont).fontSize(11).fillColor(COLORS.critical).text('影响', MARGIN_LEFT + 8);
        doc.font(regFont).fontSize(10).fillColor(COLORS.descText)
            .text(item.impact, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 证据
    if (item.evidence && Array.isArray(item.evidence) && item.evidence.length > 0) {
        for (const ev of item.evidence) {
            ensureSpace(doc, 30);
            doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
                .text(`文件: ${ev.file}${ev.lineStart ? ':' + ev.lineStart : ''}`, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
            if (ev.snippet) {
                const snippetText = ev.snippet.length > 500 ? ev.snippet.slice(0, 500) + '\n...(已截断)' : ev.snippet;
                const codeH = doc.font(monoFont).fontSize(9).heightOfString(snippetText, { width: CONTENT_WIDTH - 30 });
                ensureSpace(doc, Math.min(codeH + 30, 100));
                const boxY = doc.y;
                doc.rect(MARGIN_LEFT + 8, boxY, CONTENT_WIDTH - 16, codeH + 16).fill(COLORS.codeBlock);
                doc.font(monoFont).fontSize(9).fillColor(COLORS.codeText)
                    .text(snippetText, MARGIN_LEFT + 18, boxY + 8, { width: CONTENT_WIDTH - 36 });
                doc.y = boxY + codeH + 24;
            }
        }
        doc.moveDown(0.2);
    }
    // 修复建议
    if (item.remediation) {
        const fixH = doc.font(regFont).fontSize(10).heightOfString(item.remediation, { width: CONTENT_WIDTH - 10 });
        ensureSpace(doc, Math.min(fixH + 20, 60));
        doc.font(boldFont).fontSize(11).fillColor(COLORS.green).text('修复建议', MARGIN_LEFT + 8);
        doc.font(regFont).fontSize(10).fillColor(COLORS.descText)
            .text(item.remediation, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 分隔线
    doc.moveDown(0.5);
    ensureSpace(doc, 20);
    doc.moveTo(MARGIN_LEFT, doc.y).lineTo(PAGE_WIDTH - MARGIN_RIGHT, doc.y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
}
