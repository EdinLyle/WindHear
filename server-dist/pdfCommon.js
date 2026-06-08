import path from 'path';
import { fileURLToPath } from 'node:url';
// ========== 亮色主题色彩常量 ==========
// 生成ASCII安全的fallback文件名
const sanitizeAsciiFilename = (name) => {
    const sanitized = name.replace(/[<>:"/\\|?*\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const asciiOnly = sanitized.replace(/[^\x20-\x7E]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return asciiOnly || 'report';
};
// 生成符合RFC 5987的Content-Disposition header值
export const contentDisposition = (filename) => {
    const ascii = sanitizeAsciiFilename(filename);
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};
/** 生成统一的报告文件名：{safeName}-{YYYY-MM-DD-HH-mm-ss}.{ext} */
export function buildReportFilename(name, createdAt, ext, fallbackName = 'report') {
    const safeName = (name || fallbackName).replace(/[<>:"/\\|?*\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    let timeSuffix = '';
    if (createdAt) {
        const d = new Date(createdAt);
        const pad = (n) => String(n).padStart(2, '0');
        timeSuffix = `-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    }
    return `${safeName}${timeSuffix}.${ext}`;
}
export const LIGHT_COLORS = {
    background: '#ffffff',
    card: '#f8fafc',
    cardBorder: '#e2e8f0',
    text: '#1a202c',
    textSecondary: '#64748b',
    textHeading: '#0f172a',
    codeText: '#334155',
    descText: '#475569',
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#d97706',
    low: '#2563eb',
    info: '#6b7280',
    green: '#16a34a',
    purple: '#9333ea',
    // severity标签 - 浅底+深色文字
    criticalBg: '#fef2f2', criticalBorder: '#fecaca', criticalText: '#991b1b',
    highBg: '#fff7ed', highBorder: '#fed7aa', highText: '#9a3412',
    mediumBg: '#fffbeb', mediumBorder: '#fde68a', mediumText: '#92400e',
    lowBg: '#eff6ff', lowBorder: '#bfdbfe', lowText: '#1e40af',
    infoBg: '#f9fafb', infoBorder: '#e5e7eb', infoText: '#374151',
    codeBlockBg: '#f1f5f9',
    codeBlockBorder: '#cbd5e1',
    fixBg: '#f0fdf4',
    fixBorder: '#bbf7d0',
};
// ========== 页面布局常量 ==========
export const PAGE = {
    WIDTH: 595.28,
    HEIGHT: 841.89,
    MARGIN_TOP: 50,
    MARGIN_BOTTOM: 50,
    MARGIN_LEFT: 50,
    MARGIN_RIGHT: 50,
    CONTENT_WIDTH: 595.28 - 50 - 50, // 495.28
};
// ========== 中文等级映射常量 ==========
export const SEVERITY_ZH = {
    CRITICAL: '严重',
    HIGH: '高危',
    MEDIUM: '中危',
    LOW: '低危',
    INFO: '信息',
};
// ========== 中国字号 → pt 映射 ==========
// 二号=22pt, 三号=16pt, 小三=15pt, 四号=14pt, 小四=12pt, 五号=10.5pt
// 特殊：比小四大一号比四号小 = 13pt
export const FONT_SIZES = {
    coverTitle: 22, // 二号 — 封面主标题
    h1: 16, // 三号 — 一级标题
    h2: 15, // 小三 — 二级标题
    h3: 14, // 四号 — 三级标题
    body: 12, // 小四 — 正文
    bodyLarge: 13, // 比小四大一号比四号小 — 文件路径/行号等内容
    small: 10.5, // 五号 — 代码片段内容
    header: 10.5, // 五号 — 页眉
    tiny: 8, // 极小
};
// ========== 状态英文→中文映射 ==========
export const STATUS_ZH = {
    confirmed: '已确认',
    suspected: '疑似',
    potential: '潜在',
    unconfirmed: '未确认',
    resolved: '已修复',
    open: '未解决',
    closed: '已关闭',
    high: '高',
    medium: '中',
    low: '低',
};
// ========== 字体注册（同步，使用本地字体） ==========
export function registerFonts(doc) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fontsDir = path.join(__dirname, 'fonts');
    // 宋体简体 — 中文正文（小四）
    doc.registerFont('SongTi', path.join(fontsDir, '宋体简体.ttf'));
    // Times News Roman — 英文/数字正文（小四）
    try {
        doc.registerFont('TNR', path.join(fontsDir, 'Times News Roman.otf'));
    }
    catch (e) {
        console.warn('[pdfCommon] Times News Roman注册失败，回退到NotoSansMono:', e);
        doc.registerFont('TNR', path.join(fontsDir, 'NotoSansMono-Regular.ttf'));
    }
    // 方正风雅宋简体 — 表格标签/二三级标题
    try {
        doc.registerFont('FangZheng', path.join(fontsDir, '方正风雅宋简体.otf'));
    }
    catch (e) {
        console.warn('[pdfCommon] 方正风雅宋简体注册失败，回退到宋体简体:', e);
        doc.registerFont('FangZheng', path.join(fontsDir, '宋体简体.ttf'));
    }
    // iFonts航天腾飞体 — 封面标题/等级标签/一级标题装饰
    try {
        doc.registerFont('iFontsAero', path.join(fontsDir, 'iFonts航天腾飞体.ttf'));
    }
    catch (e) {
        console.warn('[pdfCommon] iFonts航天腾飞体注册失败，回退到宋体简体:', e);
        doc.registerFont('iFontsAero', path.join(fontsDir, '宋体简体.ttf'));
    }
    // 等宽字体 — 代码块
    doc.registerFont('NotoSansMono', path.join(fontsDir, 'NotoSansMono-Regular.ttf'));
    // Consola — 备选等宽
    doc.registerFont('Consola', path.join(fontsDir, 'consola.ttf'));
    // NotoSansSC — 保留备用
    doc.registerFont('NotoSansSC', path.join(fontsDir, 'NotoSansSC-Regular.ttf'));
    return {
        reg: 'SongTi', // 中文正文
        bold: 'SongTi', // 中文加粗（宋体无Bold，同Regular）
        mono: 'NotoSansMono', // 等宽代码
        monoBold: 'NotoSansMono', // 等宽加粗
        aero: 'iFontsAero', // 封面标题/等级标签
        song: 'SongTi', // 宋体（别名）
        fang: 'FangZheng', // 方正风雅宋
        tnr: 'TNR', // Times News Roman
    };
}
// ========== 页眉（5号宋体） ==========
export function drawHeader(doc, title, reportId) {
    // 临时将底部边距设为0，防止 .text() 在页面顶部写入时被 LineWrapper 误判为超出内容区域而自动换页
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    // 顶部细线
    doc.moveTo(PAGE.MARGIN_LEFT, 35)
        .lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, 35)
        .strokeColor(LIGHT_COLORS.cardBorder)
        .lineWidth(1)
        .stroke();
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text(title, PAGE.MARGIN_LEFT, 22, { width: PAGE.CONTENT_WIDTH, align: 'left', lineBreak: false });
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text(`Report ID: ${reportId}`, PAGE.MARGIN_LEFT, 22, { width: PAGE.CONTENT_WIDTH, align: 'right', lineBreak: false });
    doc.restore();
    // 恢复底部边距
    doc.page.margins.bottom = savedBottomMargin;
}
// ========== 页脚 ==========
export function drawFooter(doc, pageNum, totalPages) {
    const y = PAGE.HEIGHT - 30;
    // 临时将底部边距设为0，防止 .text() 在 y=811.89 写入时超出 maxY(791.89) 触发 LineWrapper 自动换页
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    // 底部细线
    doc.moveTo(PAGE.MARGIN_LEFT, y - 8)
        .lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, y - 8)
        .strokeColor(LIGHT_COLORS.cardBorder)
        .lineWidth(1)
        .stroke();
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text(`Page ${pageNum} / ${totalPages}`, PAGE.MARGIN_LEFT, y, { width: PAGE.CONTENT_WIDTH, align: 'center', lineBreak: false });
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text('听风', PAGE.MARGIN_LEFT, y, { width: PAGE.CONTENT_WIDTH, align: 'left', lineBreak: false });
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text('0x八月', PAGE.MARGIN_LEFT, y, { width: PAGE.CONTENT_WIDTH, align: 'right', lineBreak: false });
    doc.restore();
    // 恢复底部边距
    doc.page.margins.bottom = savedBottomMargin;
}
// ========== 封面标题区（二号 航天腾飞体，居中） ==========
export function drawCoverTitle(doc, title, subtitle) {
    // 主标题：二号(22pt) 航天腾飞体 居中
    doc.font('iFontsAero').fontSize(FONT_SIZES.coverTitle).fillColor(LIGHT_COLORS.textHeading)
        .text(title, PAGE.MARGIN_LEFT, 200, { width: PAGE.CONTENT_WIDTH, align: 'center' });
    // 副标题：小四 宋体 居中
    if (subtitle) {
        doc.font('SongTi').fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
            .text(subtitle, PAGE.MARGIN_LEFT, doc.y + 12, { width: PAGE.CONTENT_WIDTH, align: 'center' });
    }
}
// ========== 报告头部（旧版，保留兼容） ==========
export function drawReportHeader(doc, opts) {
    // 顶部装饰线
    doc.rect(PAGE.MARGIN_LEFT, PAGE.MARGIN_TOP, 4, 50).fill(LIGHT_COLORS.critical);
    doc.font(opts.boldFont).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.textHeading)
        .text(opts.title, PAGE.MARGIN_LEFT + 14, PAGE.MARGIN_TOP, { width: PAGE.CONTENT_WIDTH - 14 });
    if (opts.subtitle) {
        doc.font(opts.regFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
            .text(opts.subtitle, PAGE.MARGIN_LEFT + 14, doc.y + 4, { width: PAGE.CONTENT_WIDTH - 14 });
    }
    // 元信息行
    const metaY = doc.y + 16;
    doc.font(opts.regFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
        .text(`模块: ${opts.moduleName}`, PAGE.MARGIN_LEFT, metaY, { width: PAGE.CONTENT_WIDTH, align: 'left' });
    doc.font(opts.regFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
        .text(`生成时间: ${opts.date}`, PAGE.MARGIN_LEFT, metaY, { width: PAGE.CONTENT_WIDTH, align: 'right' });
    // 分隔线
    doc.moveTo(PAGE.MARGIN_LEFT, doc.y + 12)
        .lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, doc.y + 12)
        .strokeColor(LIGHT_COLORS.cardBorder)
        .lineWidth(1)
        .stroke();
    doc.moveDown(1.5);
}
// ========== 评分板 ==========
export function drawScoreBoard(doc, opts) {
    const startX = PAGE.MARGIN_LEFT;
    const y = doc.y;
    const scoreVal = opts.score;
    const scoreColor = scoreVal >= 70 ? LIGHT_COLORS.critical
        : scoreVal >= 40 ? LIGHT_COLORS.high
            : scoreVal >= 20 ? LIGHT_COLORS.medium
                : LIGHT_COLORS.green;
    doc.font('TNR').fontSize(36).fillColor(scoreColor)
        .text(String(scoreVal), startX, y, { width: 80, align: 'center' });
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text(opts.scoreLabel, startX, doc.y, { width: 80, align: 'center' });
    const cardStartX = startX + 100;
    const cardW = (PAGE.CONTENT_WIDTH - 110) / opts.stats.length;
    const cardH = 50;
    opts.stats.forEach((stat, i) => {
        const cx = cardStartX + i * (cardW + 6);
        doc.roundedRect(cx, y, cardW, cardH, 4).fill(LIGHT_COLORS.card);
        doc.roundedRect(cx, y, cardW, cardH, 4).strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke();
        doc.font('TNR').fontSize(16).fillColor(stat.color)
            .text(stat.value, cx, y + 8, { width: cardW, align: 'center' });
        doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
            .text(stat.label, cx, y + 30, { width: cardW, align: 'center' });
    });
    doc.y = y + cardH + 16;
}
// ========== 一级标题（三号，居中） ==========
export function drawH1(doc, title, aeroFont) {
    ensureSpace(doc, 40);
    doc.font(aeroFont).fontSize(FONT_SIZES.h1).fillColor(LIGHT_COLORS.textHeading)
        .text(title, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.8);
}
// ========== 章节标题（旧版兼容，保留用于非一级标题场景） ==========
export function drawSectionTitle(doc, title, boldFont) {
    ensureSpace(doc, 30);
    doc.font(boldFont).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.textHeading)
        .text(title, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
    doc.moveTo(PAGE.MARGIN_LEFT, doc.y + 2)
        .lineTo(PAGE.MARGIN_LEFT + 60, doc.y + 2)
        .strokeColor(LIGHT_COLORS.critical)
        .lineWidth(2)
        .stroke();
    doc.moveDown(0.8);
}
// ========== 代码块（代码片段内容五号字体） ==========
export function drawCodeBlock(doc, opts) {
    if (!opts.code || !opts.code.trim())
        return;
    const lineH = 15;
    const paddingTop = 10;
    const paddingBottom = 10;
    const blockW = PAGE.CONTENT_WIDTH - (opts.x - PAGE.MARGIN_LEFT);
    const textX = opts.x + 8;
    const textW = blockW - 16;
    const codeFont = opts.monoFont;
    const codeFontSize = FONT_SIZES.small;
    const pageBottom = PAGE.HEIGHT - PAGE.MARGIN_BOTTOM;
    // 预处理所有代码行
    const allLines = opts.code.split('\n');
    const processedLines = [];
    for (const raw of allLines) {
        let line = raw.replace(/\t/g, '    ');
        line = line.split('').filter(ch => ch.charCodeAt(0) >= 0x20).join('');
        // 超宽行按字体宽度折行显示，完整保留内容
        if (line.length > 0) {
            const lineW = doc.font(codeFont).fontSize(codeFontSize).widthOfString(line);
            if (lineW <= textW) {
                processedLines.push(line);
            }
            else {
                let currentLine = '';
                for (const ch of line) {
                    const testLine = currentLine + ch;
                    const testW = doc.font(codeFont).fontSize(codeFontSize).widthOfString(testLine);
                    if (testW > textW && currentLine.length > 0) {
                        processedLines.push(currentLine);
                        currentLine = ch;
                    }
                    else {
                        currentLine = testLine;
                    }
                }
                if (currentLine.length > 0)
                    processedLines.push(currentLine);
            }
        }
        else {
            processedLines.push('');
        }
    }
    let lineIdx = 0;
    // 绘制标签（仅第一页）
    if (opts.label) {
        ensureSpace(doc, 30);
        doc.font('SongTi').fontSize(FONT_SIZES.body).fillColor(opts.labelColor)
            .text(opts.label, opts.x, doc.y, { width: blockW });
    }
    // 分页绘制代码块
    while (lineIdx < processedLines.length) {
        const startY = doc.y + 8;
        // 当前页剩余空间能容纳多少行
        const availH = pageBottom - startY - paddingTop - paddingBottom;
        const linesThisPage = Math.max(1, Math.floor(availH / lineH));
        const linesToDraw = Math.min(linesThisPage, processedLines.length - lineIdx);
        const codeHeight = linesToDraw * lineH + paddingTop + paddingBottom;
        // 检查是否需要换页
        if (startY + codeHeight > pageBottom) {
            doc.addPage();
            // 换页后重新计算
            const newY = doc.y + 8;
            const newAvailH = pageBottom - newY - paddingTop - paddingBottom;
            const newLines = Math.max(1, Math.floor(newAvailH / lineH));
            const actualLines = Math.min(newLines, processedLines.length - lineIdx);
            const actualHeight = actualLines * lineH + paddingTop + paddingBottom;
            // 绘制代码块背景
            doc.save();
            doc.rect(opts.x, newY, blockW, actualHeight).fill(LIGHT_COLORS.codeBlockBg);
            doc.rect(opts.x, newY, blockW, actualHeight)
                .strokeColor(LIGHT_COLORS.codeBlockBorder).lineWidth(0.5).stroke();
            doc.restore();
            // 绘制代码行
            for (let i = 0; i < actualLines; i++) {
                const ly = newY + paddingTop + i * lineH;
                doc.font(codeFont).fontSize(codeFontSize).fillColor(LIGHT_COLORS.codeText)
                    .text(processedLines[lineIdx], textX, ly, { width: textW, lineBreak: false });
                doc.x = opts.x;
                doc.y = ly + lineH;
                lineIdx++;
            }
            doc.y = newY + actualHeight + 14;
        }
        else {
            // 绘制代码块背景
            doc.save();
            doc.rect(opts.x, startY, blockW, codeHeight).fill(LIGHT_COLORS.codeBlockBg);
            doc.rect(opts.x, startY, blockW, codeHeight)
                .strokeColor(LIGHT_COLORS.codeBlockBorder).lineWidth(0.5).stroke();
            doc.restore();
            // 绘制代码行
            for (let i = 0; i < linesToDraw; i++) {
                const ly = startY + paddingTop + i * lineH;
                doc.font(codeFont).fontSize(codeFontSize).fillColor(LIGHT_COLORS.codeText)
                    .text(processedLines[lineIdx], textX, ly, { width: textW, lineBreak: false });
                doc.x = opts.x;
                doc.y = ly + lineH;
                lineIdx++;
            }
            doc.y = startY + codeHeight + 14;
        }
    }
}
// ========== 严重等级标签（小三 航天腾飞体） ==========
export function drawSeverityTag(doc, severity, aeroFont, x, y) {
    const sev = severity.toLowerCase();
    const bgKey = `${sev}Bg`;
    const borderKey = `${sev}Border`;
    const textKey = `${sev}Text`;
    const bg = LIGHT_COLORS[bgKey] || LIGHT_COLORS.infoBg;
    const border = LIGHT_COLORS[borderKey] || LIGHT_COLORS.infoBorder;
    const text = LIGHT_COLORS[textKey] || LIGHT_COLORS.infoText;
    const label = SEVERITY_ZH[sev.toUpperCase()] || sev.toUpperCase();
    const tagW = label.length * 14 + 20;
    const tagH = 24;
    const tagX = x ?? doc.x;
    const tagY = y ?? doc.y;
    doc.save();
    doc.roundedRect(tagX, tagY, tagW, tagH, 3).fill(bg);
    doc.roundedRect(tagX, tagY, tagW, tagH, 3).strokeColor(border).lineWidth(0.5).stroke();
    // 小三(15pt) 航天腾飞体
    doc.font(aeroFont).fontSize(FONT_SIZES.h2).fillColor(text)
        .text(label, tagX, tagY + 4, { width: tagW, align: 'center', lineBreak: false });
    doc.restore();
    return { width: tagW, height: tagH };
}
// ========== 行号标签（等宽字体，bodyLarge字号，居右） ==========
export function drawLineTag(doc, text, monoFont, x, y) {
    if (!text)
        return;
    const tagX = x ?? doc.x;
    const tagY = y ?? doc.y;
    const tagW = text.length * 7 + 16;
    const tagH = 18;
    doc.save();
    doc.roundedRect(tagX, tagY, tagW, tagH, 2).fill(LIGHT_COLORS.codeBlockBg);
    // 行号用bodyLarge(13pt)字号
    doc.font(monoFont).fontSize(FONT_SIZES.bodyLarge).fillColor(LIGHT_COLORS.textSecondary)
        .text(text, tagX + 4, tagY + 3, { lineBreak: false });
    doc.restore();
}
// ========== 确保空间 ==========
export function ensureSpace(doc, neededHeight) {
    if (doc.y + neededHeight > PAGE.HEIGHT - PAGE.MARGIN_BOTTOM) {
        doc.addPage();
    }
}
// ========== 简单表格绘制（标签用方正风雅宋，居中，美观留白） ==========
export function drawTable(doc, rows, options) {
    const labelW = options.labelWidth ?? 110;
    const tableW = PAGE.CONTENT_WIDTH * 0.75; // 表格宽度为内容区75%，留白
    const valueW = tableW - labelW;
    const rowHeight = 26;
    const fs = options.fontSize ?? FONT_SIZES.body;
    // 居中起始X
    const startX = PAGE.MARGIN_LEFT + (PAGE.CONTENT_WIDTH - tableW) / 2;
    for (const row of rows) {
        ensureSpace(doc, rowHeight);
        const y = doc.y;
        // 表格行背景（交替色）
        const rowIdx = rows.indexOf(row);
        if (rowIdx % 2 === 0) {
            doc.rect(startX, y, tableW, rowHeight).fill(LIGHT_COLORS.card);
        }
        // 行底线
        doc.moveTo(startX, y + rowHeight)
            .lineTo(startX + tableW, y + rowHeight)
            .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.3).stroke();
        // 标签（方正风雅宋简体，居中）
        doc.font(options.fangFont).fontSize(fs).fillColor(LIGHT_COLORS.textSecondary)
            .text(row.label + ':', startX, y + 6, { width: labelW, align: 'center', lineBreak: false });
        // 值（宋体/TNR混合，居中）
        const val = row.value || '-';
        doc.font(options.regFont).fontSize(fs).fillColor(LIGHT_COLORS.text)
            .text(val, startX + labelW, y + 6, { width: valueW, align: 'center', lineBreak: false });
        doc.y = y + rowHeight;
    }
    // 表格外边框
    const tableY = doc.y - rows.length * rowHeight;
    doc.rect(startX, tableY, tableW, rows.length * rowHeight)
        .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke();
}
// ========== 严重度分布条 ==========
export function drawSeverityBar(doc, severityCount, findingsCount) {
    if (findingsCount === 0)
        return;
    const barW = PAGE.CONTENT_WIDTH;
    const barH = 10;
    const startX = PAGE.MARGIN_LEFT;
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    doc.moveDown(1.5);
    doc.font('SongTi').fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
        .text('严重度分布', startX, doc.y);
    doc.moveDown(0.3);
    const barY = doc.y;
    doc.roundedRect(startX, barY, barW, barH, 3).fill(LIGHT_COLORS.cardBorder);
    let offsetX = 0;
    for (const sev of severityOrder) {
        const count = severityCount[sev] || 0;
        if (count === 0)
            continue;
        const segW = (count / findingsCount) * barW;
        if (segW > 0) {
            doc.roundedRect(startX + offsetX, barY, Math.max(segW, 2), barH, 3).fill(LIGHT_COLORS[sev]);
        }
        offsetX += segW;
    }
    doc.y = barY + barH + 6;
    const legendParts = [];
    for (const sev of severityOrder) {
        const count = severityCount[sev] || 0;
        if (count > 0)
            legendParts.push(`${SEVERITY_ZH[sev.toUpperCase()]}: ${count}`);
    }
    doc.font('SongTi').fontSize(FONT_SIZES.header).fillColor(LIGHT_COLORS.textSecondary)
        .text(legendParts.join('   |   '), startX, doc.y, { width: barW, align: 'center' });
}
// ========== 后处理：添加页眉页脚 ==========
export function postProcessPages(doc, reportId, moduleName) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawHeader(doc, moduleName, reportId);
        drawFooter(doc, i + 1, range.count);
    }
}
