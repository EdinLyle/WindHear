import PDFDocument from 'pdfkit';
import { LIGHT_COLORS, PAGE, registerFonts, contentDisposition, buildReportFilename, drawCoverTitle, drawScoreBoard, drawH1, drawCodeBlock, drawSeverityTag, drawLineTag, drawTable, drawSeverityBar, ensureSpace, postProcessPages, SEVERITY_ZH, FONT_SIZES, } from '../pdfCommon.js';
// 严重度排序
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
/**
 * 生成PDF报告并流式输出到HTTP响应
 */
export function generatePdfReport(data, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE.MARGIN_TOP, bottom: PAGE.MARGIN_BOTTOM, left: PAGE.MARGIN_LEFT, right: PAGE.MARGIN_RIGHT },
        bufferPages: true,
        autoFirstPage: false,
        info: {
            Title: `代码安全审计报告 - ${data.name}`,
            Author: '听风',
            Subject: '安全审计报告',
        }
    });
    let fonts;
    try {
        fonts = registerFonts(doc);
    }
    catch (err) {
        console.error('[pdfReport] 字体注册失败:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'PDF 字体注册失败，请联系管理员' });
        }
        return;
    }
    const { reg: regFont, mono: monoFont, aero: aeroFont, song: songFont, fang: fangFont, tnr: tnrFont } = fonts;
    const filename = buildReportFilename(data.name, data.createdAt, 'pdf', 'code-audit');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(filename));
    doc.pipe(res);
    try {
        // 绘制封面页
        // 绘制封面页
        doc.addPage();
        drawCoverPage(doc, data, regFont, aeroFont, songFont, fangFont, tnrFont);
        // 绘制漏洞详情页
        drawVulnerabilityPages(doc, data, regFont, monoFont, aeroFont, songFont, fangFont);
        // 后处理：页眉页脚
        const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
        postProcessPages(doc, reportId, data.name);
        doc.end();
    }
    catch (err) {
        console.error('[pdfReport] PDF 生成出错:', err);
        try {
            doc.end();
        }
        catch { /* ignore */ }
        try {
            res.end();
        }
        catch { /* ignore */ }
    }
}
/**
 * 绘制封面页
 * 修复：评分板和严重度分布条之间增加间距防止重叠
 */
function drawCoverPage(doc, data, regFont, aeroFont, songFont, fangFont, tnrFont) {
    // 封面主标题：二号 航天腾飞体 居中
    drawCoverTitle(doc, '智能漏洞挖掘审计报告', `${data.name}-${new Date().toLocaleString('zh-CN')}`);
    // 评分板 — 从y=280开始，避免与封面标题重叠
    doc.y = 300;
    drawScoreBoard(doc, {
        score: data.riskScore,
        scoreLabel: '风险评分',
        stats: [
            { label: '漏洞总数', value: String(data.findingsCount), color: LIGHT_COLORS.text },
            { label: '严重漏洞', value: String(data.severityCount.critical || 0), color: LIGHT_COLORS.critical },
            { label: '高危漏洞', value: String(data.severityCount.high || 0), color: LIGHT_COLORS.high },
            { label: '中危漏洞', value: String(data.severityCount.medium || 0), color: LIGHT_COLORS.medium },
        ],
        regFont,
        boldFont: regFont,
    });
    // 严重度分布条 — 增加间距
    doc.moveDown(1);
    drawSeverityBar(doc, data.severityCount, data.findingsCount);
    // 项目信息（表格：标签方正风雅宋，居中留白）
    doc.moveDown(1.5);
    drawTable(doc, [
        { label: '项目名称', value: data.name || '-' },
        { label: '原始文件', value: data.originalFilename || '-' },
        { label: '编程语言', value: data.language || 'Unknown' },
        { label: '文件数', value: String(data.totalFiles || 0) },
        { label: '切片数', value: String(data.totalSlices || 0) },
        { label: '漏洞总数', value: String(data.findingsCount || 0) },
    ], { regFont, aeroFont, fangFont, tnrFont });
    // 生成时间
    doc.moveDown(1.5);
    doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
        .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' })
        .text('听风', PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' });
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
 * 绘制漏洞详情页
 * 一级标题：严重 (24) — 三号居中
 */
function drawVulnerabilityPages(doc, data, regFont, monoFont, aeroFont, songFont, fangFont) {
    if (!data.items || data.items.length === 0)
        return;
    const grouped = groupBySeverity(data.items);
    let vulnIndex = 0;
    for (const sev of SEVERITY_ORDER) {
        const items = grouped[sev];
        if (!items?.length)
            continue;
        doc.addPage();
        // 一级标题：严重 (24) — 三号 居中
        const sevLabel = SEVERITY_ZH[sev.toUpperCase()] || sev;
        drawH1(doc, `${sevLabel} (${items.length})`, aeroFont);
        for (const item of items) {
            vulnIndex++;
            ensureSpace(doc, 100);
            drawVulnCard(doc, item, sev, vulnIndex, regFont, monoFont, aeroFont, songFont, fangFont);
        }
    }
}
/**
 * 绘制单个漏洞卡片
 * 修复：删除冗余行号（置信度下的行号），标题内容换行显示，TNR混合字体
 */
function drawVulnCard(doc, item, severity, index, regFont, monoFont, aeroFont, songFont, fangFont) {
    // 二级标题行：等级标签（小三 航天腾飞体） + 编号+标题（小三 方正风雅宋）
    const titleY = doc.y;
    const tag = drawSeverityTag(doc, severity, aeroFont, PAGE.MARGIN_LEFT, titleY);
    doc.font(fangFont).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.text)
        .text(`${index}. ${item.title || '未命名漏洞'}`, PAGE.MARGIN_LEFT + tag.width + 8, titleY + 2, { width: PAGE.CONTENT_WIDTH - tag.width - 8 });
    doc.moveDown(0.3);
    // 元信息（文件路径/行号用bodyLarge，删除冗余行号）
    if (item.cwe_id || item.file_path || item.confidence) {
        ensureSpace(doc, 20);
        const meta = [];
        if (item.cwe_id)
            meta.push(`CWE: ${item.cwe_id}`);
        if (item.file_path)
            meta.push(`文件: ${item.file_path}`);
        if (item.confidence)
            meta.push(`置信度: ${item.confidence}`);
        if (meta.length > 0) {
            doc.font(songFont).fontSize(FONT_SIZES.bodyLarge).fillColor(LIGHT_COLORS.textSecondary)
                .text(meta.join('  |  '), PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
            // 不再在这里显示行号（冗余，后面漏洞代码处会显示）
        }
        doc.moveDown(0.3);
    }
    // 描述
    if (item.description) {
        const descH = doc.font(songFont).fontSize(FONT_SIZES.body).heightOfString(item.description, { width: PAGE.CONTENT_WIDTH });
        ensureSpace(doc, Math.min(descH + 10, 80));
        doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.description, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
        doc.moveDown(0.3);
    }
    // 漏洞代码 — 三级标题（四号 方正风雅宋），行号在标题同行居右
    if (item.vulnerable_code) {
        ensureSpace(doc, 40);
        const codeLabelY = doc.y;
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.high).text('漏洞代码:', PAGE.MARGIN_LEFT, codeLabelY);
        // 行号在标题同行居右
        if (item.line_start) {
            const lineLabel = `Line ${item.line_start}`;
            const lineLabelW = lineLabel.length * 7 + 16;
            drawLineTag(doc, lineLabel, monoFont, PAGE.MARGIN_LEFT + PAGE.CONTENT_WIDTH - lineLabelW, codeLabelY + 2);
        }
        doc.moveDown(1);
        drawCodeBlock(doc, {
            label: '',
            code: item.vulnerable_code,
            labelColor: LIGHT_COLORS.high,
            x: PAGE.MARGIN_LEFT,
            regFont,
            boldFont: regFont,
            monoFont: monoFont,
        });
    }
    // 概念验证(PoC)描述 — 三级标题，内容换行显示（不跟在标题后）
    if (item.poc_description) {
        ensureSpace(doc, 40);
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.purple)
            .text('概念验证(PoC)描述:', PAGE.MARGIN_LEFT);
        doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.poc_description, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
        doc.moveDown(0.3);
    }
    // PoC代码
    if (item.poc_code) {
        drawCodeBlock(doc, {
            label: 'PoC 代码',
            code: item.poc_code,
            labelColor: LIGHT_COLORS.low,
            x: PAGE.MARGIN_LEFT,
            regFont,
            boldFont: regFont,
            monoFont: monoFont,
        });
    }
    // 复现步骤 — 三级标题，内容换行显示
    if (item.reproduce_steps) {
        const stepsH = doc.font(songFont).fontSize(FONT_SIZES.body).heightOfString(item.reproduce_steps, { width: PAGE.CONTENT_WIDTH });
        ensureSpace(doc, Math.min(stepsH + 20, 60));
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.purple)
            .text('复现步骤:', PAGE.MARGIN_LEFT);
        doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.reproduce_steps, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
        doc.moveDown(0.3);
    }
    // 参考修复代码
    if (item.fix_code) {
        ensureSpace(doc, 40);
        const fixLabelY = doc.y;
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.green).text('参考修复代码:', PAGE.MARGIN_LEFT, fixLabelY);
        // 行号在标题同行居右
        if (item.line_start) {
            const lineLabel = `Line ${item.line_start}`;
            const lineLabelW = lineLabel.length * 7 + 16;
            drawLineTag(doc, lineLabel, monoFont, PAGE.MARGIN_LEFT + PAGE.CONTENT_WIDTH - lineLabelW, fixLabelY + 2);
        }
        doc.moveDown(1);
        drawCodeBlock(doc, {
            label: '',
            code: item.fix_code,
            labelColor: LIGHT_COLORS.green,
            x: PAGE.MARGIN_LEFT,
            regFont,
            boldFont: regFont,
            monoFont: monoFont,
        });
    }
    // 修复建议 — 三级标题，内容换行显示
    if (item.fix_description) {
        ensureSpace(doc, 40);
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.green)
            .text('修复建议:', PAGE.MARGIN_LEFT);
        doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.fix_description, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
        doc.moveDown(0.3);
    }
    else if (item.fix_suggestion) {
        const fixH = doc.font(songFont).fontSize(FONT_SIZES.body).heightOfString(item.fix_suggestion, { width: PAGE.CONTENT_WIDTH });
        ensureSpace(doc, Math.min(fixH + 20, 60));
        doc.font(fangFont).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.green)
            .text('修复建议:', PAGE.MARGIN_LEFT);
        doc.font(songFont).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.fix_suggestion, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH });
        doc.moveDown(0.3);
    }
    // 分隔线
    doc.moveDown(0.5);
    ensureSpace(doc, 20);
    doc.moveTo(PAGE.MARGIN_LEFT, doc.y).lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, doc.y)
        .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
}
