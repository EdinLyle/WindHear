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
// 严重度中文标签
const SEVERITY_LABELS = {
    critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息'
};
// 严重度排序
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
// 字体名称常量
const FONT_REGULAR = 'CN';
const FONT_BOLD = 'CN-Bold';
const FONT_MONO = 'Mono';
// 页面尺寸常量
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
/**
 * 生成PDF报告并流式输出到HTTP响应
 */
export function generatePdfReport(data, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        bufferPages: true,
        autoFirstPage: false,
        info: {
            Title: `代码安全审计报告 - ${data.name}`,
            Author: '听风',
            Subject: '安全审计报告',
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
    const filename = `audit-report-${data.name}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);
    // 监听自动换页事件，为新页面绘制暗色背景
    doc.on('pageAdded', () => {
        fillPageBackground(doc);
    });
    // 绘制封面页
    doc.addPage();
    drawCoverPage(doc, data, regFont, boldFont);
    // 绘制漏洞详情页
    drawVulnerabilityPages(doc, data, regFont, boldFont, monoFont);
    // 后处理：页眉页脚
    postProcessPages(doc, data, regFont);
    doc.end();
}
/**
 * 后处理：为所有页面绘制页眉页脚
 * 注意：使用指定位置绘制，避免触发PDFKit自动换页
 */
function postProcessPages(doc, data, regFont) {
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        // 记住当前y位置
        const savedY = doc.y;
        // 页眉 - 强制指定y位置
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`听风 | ${data.name}`, MARGIN_LEFT, 25, {
            lineBreak: false,
            width: CONTENT_WIDTH,
            height: 12
        });
        // 页脚 - 强制指定y位置
        doc.font(regFont).fontSize(8).fillColor(COLORS.textSecondary);
        doc.text(`${i + 1} / ${totalPages}`, MARGIN_LEFT, PAGE_HEIGHT - 35, {
            lineBreak: false,
            width: CONTENT_WIDTH,
            align: 'center',
            height: 12
        });
        // 恢复y位置（避免影响后续页面）
        doc.y = savedY;
    }
}
/**
 * 确保当前页面有足够空间，不足则换页
 */
function ensureSpace(doc, neededHeight) {
    if (doc.y + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        fillPageBackground(doc);
    }
}
/**
 * 绘制暗色背景
 */
function fillPageBackground(doc) {
    doc.save();
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.background);
    doc.restore();
}
/**
 * 绘制封面页
 */
function drawCoverPage(doc, data, regFont, boldFont) {
    fillPageBackground(doc);
    // 标题
    doc.font(boldFont).fontSize(28).fillColor(COLORS.text)
        .text('智能漏洞挖掘审计报告', { align: 'center' });
    doc.moveDown(0.5);
    doc.font(regFont).fontSize(14).fillColor(COLORS.textSecondary)
        .text(data.name, { align: 'center' });
    doc.moveDown(2);
    // 评分环
    const ringSize = 120;
    const ringX = (PAGE_WIDTH - ringSize) / 2;
    drawScoreRing(doc, ringX, doc.y, ringSize, data.riskScore, boldFont, regFont);
    doc.y += ringSize + 20;
    // 统计卡片
    drawStatCards(doc, data, regFont, boldFont);
    // 严重度分布条
    drawSeverityBar(doc, data.severityCount, data.findingsCount, regFont);
    // 项目信息
    doc.moveDown(1.5);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary);
    const infoLines = [
        `项目名称: ${data.name}`,
        `编程语言: ${data.language || 'Unknown'}`,
        `文件数: ${data.totalFiles}  |  切片数: ${data.totalSlices}`,
        `漏洞总数: ${data.findingsCount}`,
    ];
    for (const line of infoLines) {
        doc.text(line, { align: 'center' });
    }
    // 生成时间
    doc.moveDown(1.5);
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' })
        .text('听风', { align: 'center' });
}
/**
 * 绘制评分环
 */
function drawScoreRing(doc, x, y, size, score, boldFont, regFont) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size / 2 - 10;
    const lineW = 8;
    doc.circle(cx, cy, radius)
        .lineWidth(lineW).strokeColor(COLORS.border).stroke();
    const scoreVal = Math.min(Math.max(score, 0), 100);
    const scoreColor = scoreVal >= 70 ? COLORS.critical : scoreVal >= 40 ? COLORS.high
        : scoreVal >= 20 ? COLORS.medium : COLORS.green;
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
/**
 * 绘制圆弧
 */
function drawArc(doc, cx, cy, r, startAngle, endAngle, lineW, color) {
    const startX = cx + r * Math.cos(startAngle);
    const startY = cy + r * Math.sin(startAngle);
    const endX = cx + r * Math.cos(endAngle);
    const endY = cy + r * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    const d = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
    doc.path(d).lineWidth(lineW).strokeColor(color).stroke();
}
/**
 * 绘制统计卡片
 */
function drawStatCards(doc, data, regFont, boldFont) {
    const cardW = (CONTENT_WIDTH - 30) / 4;
    const cardH = 60;
    const startX = MARGIN_LEFT;
    const startY = doc.y;
    const cards = [
        { label: '漏洞总数', value: String(data.findingsCount), color: COLORS.text },
        { label: '严重漏洞', value: String(data.severityCount.critical || 0), color: COLORS.critical },
        { label: '高危漏洞', value: String(data.severityCount.high || 0), color: COLORS.high },
        { label: '中危漏洞', value: String(data.severityCount.medium || 0), color: COLORS.medium },
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
}
/**
 * 绘制严重度分布条
 */
function drawSeverityBar(doc, severityCount, findingsCount, regFont) {
    if (findingsCount === 0)
        return;
    const barW = CONTENT_WIDTH;
    const barH = 10;
    const startX = MARGIN_LEFT;
    doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
        .text('严重度分布', startX, doc.y);
    doc.moveDown(0.3);
    const barY = doc.y;
    doc.roundedRect(startX, barY, barW, barH, 3).fill(COLORS.border);
    let offsetX = 0;
    for (const sev of SEVERITY_ORDER) {
        const count = severityCount[sev] || 0;
        if (count === 0)
            continue;
        const segW = (count / findingsCount) * barW;
        if (segW > 0) {
            doc.roundedRect(startX + offsetX, barY, Math.max(segW, 2), barH, 3).fill(COLORS[sev]);
        }
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
/**
 * 按严重度分组
 */
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
/**
 * 绘制漏洞详情页（带全局编号）
 */
function drawVulnerabilityPages(doc, data, regFont, boldFont, monoFont) {
    if (!data.items || data.items.length === 0)
        return;
    const grouped = groupBySeverity(data.items);
    let vulnIndex = 0;
    for (const sev of SEVERITY_ORDER) {
        const items = grouped[sev];
        if (!items?.length)
            continue;
        doc.addPage();
        fillPageBackground(doc);
        // 级别标题
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
/**
 * 绘制单个漏洞卡片（带编号）
 * 所有文本绘制前检查空间，避免PDFKit自动换页产生无背景页面
 */
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
    if (item.cwe_id || item.file_path || item.confidence) {
        ensureSpace(doc, 20);
        const meta = [];
        if (item.cwe_id)
            meta.push(`CWE: ${item.cwe_id}`);
        if (item.file_path)
            meta.push(`文件: ${item.file_path}:${item.line_start || '-'}`);
        if (item.confidence)
            meta.push(`置信度: ${item.confidence}`);
        doc.font(regFont).fontSize(10).fillColor(COLORS.textSecondary)
            .text(meta.join('  |  '), MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 描述
    if (item.description) {
        // 预估描述高度，确保空间
        const descH = doc.font(regFont).fontSize(11).heightOfString(item.description, { width: CONTENT_WIDTH - 10 });
        ensureSpace(doc, Math.min(descH + 10, 80));
        doc.font(regFont).fontSize(11).fillColor(COLORS.descText)
            .text(item.description, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 漏洞代码
    if (item.vulnerable_code) {
        drawCodeBlock(doc, '漏洞代码', item.vulnerable_code, COLORS.high, MARGIN_LEFT + 8, boldFont, monoFont);
    }
    // PoC
    if (item.poc_code || item.poc_description) {
        if (item.poc_description) {
            ensureSpace(doc, 40);
            doc.font(regFont).fontSize(11).fillColor(COLORS.descText)
                .text(`概念验证(PoC): ${item.poc_description}`, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
            doc.moveDown(0.2);
        }
        if (item.poc_code) {
            drawCodeBlock(doc, 'PoC 代码', item.poc_code, COLORS.low, MARGIN_LEFT + 8, boldFont, monoFont);
        }
    }
    // 复现步骤
    if (item.reproduce_steps) {
        const stepsH = doc.font(regFont).fontSize(10).heightOfString(item.reproduce_steps, { width: CONTENT_WIDTH - 10 });
        ensureSpace(doc, Math.min(stepsH + 20, 60));
        doc.font(boldFont).fontSize(11).fillColor(COLORS.purple)
            .text('复现步骤', MARGIN_LEFT + 8);
        doc.font(regFont).fontSize(10).fillColor(COLORS.descText)
            .text(item.reproduce_steps, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 参考修复代码
    if (item.fix_code) {
        drawCodeBlock(doc, '参考修复代码', item.fix_code, COLORS.green, MARGIN_LEFT + 8, boldFont, monoFont);
    }
    else if (item.fix_suggestion) {
        const fixH = doc.font(regFont).fontSize(10).heightOfString(item.fix_suggestion, { width: CONTENT_WIDTH - 10 });
        ensureSpace(doc, Math.min(fixH + 20, 60));
        doc.font(boldFont).fontSize(11).fillColor(COLORS.green)
            .text('修复建议', MARGIN_LEFT + 8);
        doc.font(regFont).fontSize(10).fillColor(COLORS.descText)
            .text(item.fix_suggestion, MARGIN_LEFT + 8, doc.y, { width: CONTENT_WIDTH - 10 });
        doc.moveDown(0.3);
    }
    // 分隔线
    doc.moveDown(0.5);
    ensureSpace(doc, 20);
    doc.moveTo(MARGIN_LEFT, doc.y).lineTo(PAGE_WIDTH - MARGIN_RIGHT, doc.y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
}
/**
 * 绘制代码块（手动分页，避免PDFKit自动换页）
 */
function drawCodeBlock(doc, label, code, color, x, boldFont, monoFont) {
    // 截断超长代码
    const codeText = code.length > 2000 ? code.slice(0, 2000) + '\n... (已截断)' : code;
    const boxWidth = PAGE_WIDTH - x - MARGIN_RIGHT;
    const textOptions = { width: boxWidth - 20, lineGap: 3 };
    const textHeight = doc.font(monoFont).fontSize(9).heightOfString(codeText, textOptions);
    const boxHeight = textHeight + 20;
    const totalHeight = 16 + boxHeight; // label + box
    // 如果整个代码块放不下，先换页
    if (doc.y + totalHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        fillPageBackground(doc);
    }
    // 标签
    doc.font(boldFont).fontSize(11).fillColor(color).text(label, x);
    doc.moveDown(0.2);
    const boxY = doc.y;
    // 代码背景
    doc.rect(x, boxY, boxWidth, boxHeight).fill(COLORS.codeBlock);
    doc.rect(x, boxY, boxWidth, boxHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    // 代码文本
    doc.font(monoFont).fontSize(9).fillColor(COLORS.codeText)
        .text(codeText, x + 10, boxY + 10, textOptions);
    doc.y = boxY + boxHeight + 8;
}
