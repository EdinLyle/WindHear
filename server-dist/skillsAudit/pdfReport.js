import PDFDocument from 'pdfkit';
import { LIGHT_COLORS, PAGE, registerFonts, contentDisposition, buildReportFilename, drawCoverTitle, drawScoreBoard, drawH1, drawCodeBlock, drawSeverityTag, drawLineTag, drawTable, drawSeverityBar, ensureSpace, postProcessPages, SEVERITY_ZH, FONT_SIZES, } from '../pdfCommon.js';
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
/** 风险类别中文标签 */
const RISK_CATEGORY_LABELS = {
    dangerous_command: '危险命令', reverse_shell: '反向Shell', hardcoded_secrets: '硬编码密钥',
    prompt_injection: '提示注入', data_exfiltration: '数据泄露', sensitive_file_access: '敏感文件访问',
    dynamic_code_execution: '动态代码执行', privilege_escalation: '权限提升', weak_crypto: '弱加密',
    command_injection: '命令注入', supply_chain_attack: '供应链攻击', unauthorized_tool_use: '未授权工具使用',
    trigger_hijacking: '触发器劫持', skill_md_mismatch: 'Skill清单不匹配', code_quality: '代码质量',
    bytecode_tampering: '字节码篡改', obfuscation: '代码混淆', resource_abuse: '资源滥用',
    unicode_steganography: 'Unicode隐写', social_engineering: '社会工程学',
    other: '其他',
};
/**
 * 生成Skills 安全审计PDF报告并流式输出到HTTP响应
 */
export function generateSkillsPdfReport(data, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE.MARGIN_TOP, bottom: PAGE.MARGIN_BOTTOM, left: PAGE.MARGIN_LEFT, right: PAGE.MARGIN_RIGHT },
        bufferPages: true,
        autoFirstPage: false,
        info: {
            Title: `Skills安全审计报告 - ${data.name}`,
            Author: '听风',
            Subject: 'Skills安全审计报告',
        },
    });
    let fonts;
    try {
        fonts = registerFonts(doc);
    }
    catch (err) {
        console.error('[skillsPdfReport] 字体注册失败:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'PDF 字体注册失败，请联系管理员' });
        }
        return;
    }
    const { reg, bold, mono, aero, song, fang, tnr } = fonts;
    const filename = buildReportFilename(data.name, data.createdAt, 'pdf', 'skills-audit');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(filename));
    doc.pipe(res);
    try {
        // 封面页
        doc.addPage();
        drawCoverPage(doc, data, reg, aero, song, fang, tnr);
        // Agent分类统计页
        const agentStats = groupByAgent(data.findings);
        if (Object.keys(agentStats).length > 0) {
            doc.addPage();
            drawAgentStatsPage(doc, data, reg, bold, aero, song, fang);
        }
        // 风险类别统计页
        if (Object.keys(data.riskCategoryCount).length > 0) {
            doc.addPage();
            drawCategoryPage(doc, data, reg, bold, aero, fang);
        }
        // 发现项详情页
        drawFindingPages(doc, data, reg, mono, aero, song, fang);
        // 后处理
        const reportId = `SKA-${Date.now()}`;
        postProcessPages(doc, reportId, 'Skills安全审计');
        doc.end();
    }
    catch (err) {
        console.error('[skillsPdfReport] PDF 生成出错:', err);
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
/** 绘制封面页 */
function drawCoverPage(doc, data, reg, aero, song, fang, tnr) {
    // 封面主标题：二号 航天腾飞体 居中
    drawCoverTitle(doc, 'Skills 安全审计报告', `${data.name}-${new Date().toLocaleString('zh-CN')}`);
    // 评分板
    const riskLevelZh = SEVERITY_ZH[(data.riskLevel || 'info').toUpperCase()] || data.riskLevel || '-';
    doc.y = 300;
    doc.moveDown(1);
    drawScoreBoard(doc, {
        score: data.riskScore,
        scoreLabel: '风险评分',
        stats: [
            { label: '发现项总数', value: String(data.findingsCount), color: LIGHT_COLORS.text },
            { label: 'Skills数量', value: String(data.totalSkills), color: LIGHT_COLORS.purple },
            { label: '风险等级', value: riskLevelZh, color: data.riskLevel === 'critical' ? LIGHT_COLORS.critical : data.riskLevel === 'high' ? LIGHT_COLORS.high : data.riskLevel === 'medium' ? LIGHT_COLORS.medium : LIGHT_COLORS.green },
            { label: '高危发现', value: String((data.severityCount.critical || 0) + (data.severityCount.high || 0)), color: LIGHT_COLORS.high },
        ],
        regFont: reg,
        boldFont: reg,
    });
    // 严重度分布条
    drawSeverityBar(doc, data.severityCount, data.findingsCount);
    // 项目信息（表格：标签方正风雅宋，居中留白）
    doc.moveDown(1.5);
    drawTable(doc, [
        { label: '项目名称', value: data.name || '-' },
        { label: '原始文件', value: data.originalFilename || '-' },
        { label: '文件数量', value: String(data.totalFiles || 0) },
        { label: 'Skills数量', value: String(data.totalSkills || 0) },
        { label: '发现项', value: String(data.findingsCount || 0) },
        { label: '风险等级', value: riskLevelZh },
    ], { regFont: reg, aeroFont: aero, fangFont: fang, tnrFont: tnr });
    // 生成时间
    doc.moveDown(1.5);
    doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
        .text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' })
        .text('听风', PAGE.MARGIN_LEFT, doc.y, { width: PAGE.CONTENT_WIDTH, align: 'center' });
}
/** 按Agent分组统计 */
function groupByAgent(findings) {
    const agentMap = {};
    for (const f of findings) {
        const agent = categoryToAgent(f.riskCategory);
        if (!agentMap[agent])
            agentMap[agent] = { count: 0, categories: new Set() };
        agentMap[agent].count++;
        agentMap[agent].categories.add(f.riskCategory);
    }
    return agentMap;
}
/** 风险类别 → Agent 映射 */
function categoryToAgent(cat) {
    const mapping = {
        dangerous_command: '命令执行安全Agent', reverse_shell: '命令执行安全Agent',
        hardcoded_secrets: '数据泄露安全Agent', data_exfiltration: '数据泄露安全Agent', sensitive_file_access: '数据泄露安全Agent',
        prompt_injection: '提示注入安全Agent', trigger_hijacking: '提示注入安全Agent', skill_md_mismatch: '提示注入安全Agent',
        dynamic_code_execution: '代码执行安全Agent', command_injection: '代码执行安全Agent', bytecode_tampering: '代码执行安全Agent',
        privilege_escalation: '权限提升安全Agent', unauthorized_tool_use: '权限提升安全Agent',
        weak_crypto: '供应链与加密安全Agent', supply_chain_attack: '供应链与加密安全Agent', obfuscation: '供应链与加密安全Agent',
        resource_abuse: '资源滥用Agent', unicode_steganography: '资源滥用Agent',
        social_engineering: '社会工程学Agent',
        code_quality: '代码质量Agent',
    };
    return mapping[cat] || '其他Agent';
}
/**
 * 绘制Agent分类统计页
 * 一级标题：Agent 分类统计 — 三号居中
 * Agent名称用小三，覆盖用五号
 */
function drawAgentStatsPage(doc, data, reg, bold, aero, song, fang) {
    drawH1(doc, 'Agent 分类统计', aero);
    const agentStats = groupByAgent(data.findings);
    const entries = Object.entries(agentStats).sort(([, a], [, b]) => b.count - a.count);
    const maxCnt = Math.max(...entries.map(([, v]) => v.count), 1);
    for (const [agentName, stat] of entries) {
        ensureSpace(doc, 40);
        // Agent名称用小三 方正风雅宋
        doc.font(fang).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.textHeading)
            .text(agentName, PAGE.MARGIN_LEFT, doc.y);
        doc.moveDown(0.2);
        const barW = (stat.count / maxCnt) * (PAGE.CONTENT_WIDTH - 160);
        const barY = doc.y;
        doc.roundedRect(PAGE.MARGIN_LEFT + 8, barY, barW, 14, 3).fill(LIGHT_COLORS.purple);
        doc.font(reg).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
            .text(`${stat.count} 项`, PAGE.MARGIN_LEFT + 16 + barW, barY + 1);
        // 覆盖：五号字体
        const catLabels = Array.from(stat.categories).map(c => RISK_CATEGORY_LABELS[c] || c);
        doc.font(song).fontSize(FONT_SIZES.small).fillColor(LIGHT_COLORS.textSecondary)
            .text(`覆盖: ${catLabels.join(', ')}`, PAGE.MARGIN_LEFT + 8, barY + 18, { width: PAGE.CONTENT_WIDTH - 16 });
        doc.moveDown(0.8);
    }
}
/**
 * 绘制风险类别统计页
 * 一级标题：风险类别分布 — 三号居中
 */
function drawCategoryPage(doc, data, reg, bold, aero, fang) {
    drawH1(doc, '风险类别分布', aero);
    const categories = Object.entries(data.riskCategoryCount)
        .sort(([, a], [, b]) => b - a);
    const maxCnt = Math.max(...categories.map(([, v]) => v), 1);
    for (const [cat, cnt] of categories) {
        ensureSpace(doc, 36);
        const label = RISK_CATEGORY_LABELS[cat] || cat;
        const barW = (cnt / maxCnt) * (PAGE.CONTENT_WIDTH - 160);
        doc.font(fang).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.text)
            .text(label, PAGE.MARGIN_LEFT, doc.y, { width: 130 });
        const barY = doc.y - 14;
        doc.roundedRect(PAGE.MARGIN_LEFT + 140, barY, barW, 16, 3).fill(LIGHT_COLORS.purple);
        doc.font(reg).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.textSecondary)
            .text(String(cnt), PAGE.MARGIN_LEFT + 150 + barW, barY + 2);
        doc.moveDown(0.4);
    }
}
/** 按严重度分组 */
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
 * 绘制发现项详情页
 * 一级标题：严重 (N) — 三号居中
 * 二级标题：1. 风险名称 — 小三方正风雅宋，等级标签小三航天腾飞体
 * 三级标题：证据/漏洞代码/修复建议 — 四号方正风雅宋
 */
function drawFindingPages(doc, data, reg, mono, aero, song, fang) {
    if (!data.findings || data.findings.length === 0)
        return;
    const grouped = groupBySeverity(data.findings);
    let idx = 0;
    for (const sev of SEVERITY_ORDER) {
        const items = grouped[sev];
        if (!items?.length)
            continue;
        doc.addPage();
        // 一级标题：严重 (N) — 三号 居中
        const sevLabel = SEVERITY_ZH[sev.toUpperCase()] || sev;
        drawH1(doc, `${sevLabel} (${items.length})`, aero);
        for (const item of items) {
            idx++;
            ensureSpace(doc, 100);
            drawFindingCard(doc, item, sev, idx, reg, mono, aero, song, fang);
        }
    }
}
/**
 * 绘制单个发现项卡片
 * 行号：bodyLarge(13pt)字号，居右排列，在"漏洞代码"下一行显示
 * 代码片段：五号字体
 */
function drawFindingCard(doc, item, severity, index, reg, mono, aero, song, fang) {
    const indent = PAGE.MARGIN_LEFT + 8;
    const contentW = PAGE.CONTENT_WIDTH - 16;
    // 二级标题行：等级标签（小三 航天腾飞体） + 编号+标题（小三 方正风雅宋）
    ensureSpace(doc, 30);
    const titleY = doc.y;
    const tag = drawSeverityTag(doc, severity, aero, indent, titleY);
    doc.font(fang).fontSize(FONT_SIZES.h2).fillColor(LIGHT_COLORS.textHeading)
        .text(`${index}. ${item.title || '未命名发现'}`, indent + tag.width + 10, titleY + 2, { width: contentW - tag.width - 10 });
    doc.moveDown(0.3);
    // 元信息
    const meta = [];
    if (item.riskCategory)
        meta.push(`风险类别: ${RISK_CATEGORY_LABELS[item.riskCategory] || item.riskCategory}`);
    if (item.filePath)
        meta.push(`文件: ${item.filePath}`);
    if (item.cweId)
        meta.push(`CWE: ${item.cweId}`);
    if (item.confidence)
        meta.push(`置信度: ${item.confidence}`);
    if (meta.length > 0) {
        ensureSpace(doc, 20);
        doc.font(song).fontSize(FONT_SIZES.bodyLarge).fillColor(LIGHT_COLORS.textSecondary)
            .text(meta.join('  |  '), indent, doc.y, { width: contentW });
        doc.moveDown(0.3);
    }
    // 描述
    if (item.description) {
        const descH = doc.font(song).fontSize(FONT_SIZES.body).heightOfString(item.description, { width: contentW });
        ensureSpace(doc, Math.min(descH + 10, 80));
        doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.description, indent, doc.y, { width: contentW });
        doc.moveDown(0.3);
    }
    // 证据 — 三级标题（四号 方正风雅宋）
    if (item.evidence) {
        ensureSpace(doc, 40);
        doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.purple).text('证据:', indent);
        doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.evidence, indent, doc.y, { width: contentW });
        doc.moveDown(0.3);
    }
    // 漏洞代码 — 三级标题，行号在标题同行居右
    if (item.vulnerableCode) {
        ensureSpace(doc, 40);
        const codeLabelY = doc.y;
        doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.high).text('漏洞代码:', indent, codeLabelY);
        // 行号在"漏洞代码"标题同行居右
        if (item.lineStart) {
            const lineLabel = `Line ${item.lineStart}${item.lineEnd && item.lineEnd !== item.lineStart ? `-${item.lineEnd}` : ''}`;
            const lineLabelW = lineLabel.length * 7 + 16;
            drawLineTag(doc, lineLabel, mono, indent + contentW - lineLabelW, codeLabelY + 2);
        }
        doc.moveDown(1);
        drawCodeBlock(doc, {
            label: '',
            code: item.vulnerableCode || '',
            labelColor: LIGHT_COLORS.high,
            x: PAGE.MARGIN_LEFT,
            regFont: reg,
            boldFont: reg,
            monoFont: mono,
        });
    }
    // 修复建议 — 三级标题
    if (item.remediation) {
        const fixH = doc.font(song).fontSize(FONT_SIZES.body).heightOfString(item.remediation, { width: contentW });
        ensureSpace(doc, Math.min(fixH + 20, 60));
        doc.font(fang).fontSize(FONT_SIZES.h3).fillColor(LIGHT_COLORS.green).text('修复建议:', indent);
        doc.font(song).fontSize(FONT_SIZES.body).fillColor(LIGHT_COLORS.descText)
            .text(item.remediation, indent, doc.y, { width: contentW });
        doc.moveDown(0.3);
    }
    // 分隔线
    doc.moveDown(0.5);
    ensureSpace(doc, 20);
    doc.moveTo(PAGE.MARGIN_LEFT, doc.y).lineTo(PAGE.WIDTH - PAGE.MARGIN_RIGHT, doc.y)
        .strokeColor(LIGHT_COLORS.cardBorder).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
}
