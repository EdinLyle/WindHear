import { chatCompletion } from '../modelClients.js';
import { safeParseJsonArray } from '../mcpScan/util/safeJson.js';
const BATCH_SIZE = 5;
// ===== 系统提示词构建（三层复合结构） =====
/**
 * 构建三层复合 system prompt
 * Layer1: Agent角色定义（硬编码）
 * Layer2: 输出格式规范（硬编码）
 * Layer3: 用户策略（可配置，动态注入）
 */
function buildSystemPrompt(agentRole, outputFormat, userStrategy) {
    const parts = [agentRole, outputFormat];
    if (userStrategy?.trim()) {
        parts.push(`【用户审计策略】\n${userStrategy.trim()}`);
    }
    return parts.join('\n\n');
}
// ===== Parser Agent =====
export async function runParser(ctx) {
    const results = [];
    for (let i = 0; i < ctx.slices.length; i += BATCH_SIZE) {
        const batch = ctx.slices.slice(i, i + BATCH_SIZE);
        const batchResults = await parseBatch(batch, ctx);
        results.push(...batchResults);
    }
    return results;
}
async function parseBatch(slices, ctx) {
    const slicesDescription = slices.map((s, idx) => `--- 切片 ${idx} ---\n文件: ${s.filePath}:${s.lineStart}-${s.lineEnd}\n类型: ${s.sliceType}\n语言: ${s.language}\n\`\`\`\n${s.content}\n\`\`\``).join('\n\n');
    const systemPrompt = buildSystemPrompt('你是代码安全分析专家（Parser）。你的任务是对代码切片进行初步安全标记。', '对每个切片，判断其信任边界：safe（无安全隐患）/ suspicious（涉及外部输入但无明显漏洞）/ dangerous（涉及危险操作）。\n输出JSON数组：[{index, trustBoundary, sensitiveTags, reason}]', ctx.modelConfig.systemPrompt);
    const userPrompt = `待审计代码切片：

${slicesDescription}

只输出 JSON 数组，不要输出其他内容。`;
    try {
        const result = await chatCompletion({ ...ctx.modelConfig, timeoutMs: ctx.modelConfig.timeoutMs ?? 60_000 }, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);
        const response = result.content;
        const parsed = safeParseJsonArray(response);
        return slices.map((_, idx) => {
            const match = parsed.find(p => p.index === idx);
            return {
                sliceIndex: idx,
                trustBoundary: (['safe', 'suspicious', 'dangerous'].includes(String(match?.trustBoundary ?? '')) ? String(match?.trustBoundary ?? 'safe') : 'safe'),
                sensitiveTags: Array.isArray(match?.sensitiveTags) ? match.sensitiveTags : [],
                reason: String(match?.reason ?? '未能解析'),
            };
        });
    }
    catch {
        // Parser 失败时，使用规则引擎兜底
        return slices.map((s, idx) => ruleBasedParser(s, idx));
    }
}
function ruleBasedParser(slice, index) {
    const content = slice.content.toLowerCase();
    const tags = [];
    // 规则匹配
    const rules = [
        { pattern: /eval\s*\(|new\s+function\s*\(/, tags: ['code-injection'], boundary: 'dangerous' },
        { pattern: /exec\s*\(|spawn\s*\(|system\s*\(/, tags: ['rce'], boundary: 'dangerous' },
        { pattern: /select.*from|insert.*into|update.*set|delete.*from/i, tags: ['injection', 'database'], boundary: 'suspicious' },
        { pattern: /query\s*\(.*\+|query\s*\(.*\$\{/, tags: ['sql-injection'], boundary: 'dangerous' },
        { pattern: /innerhtml|document\.write|v-html|dangerouslysetinnerhtml/, tags: ['xss'], boundary: 'suspicious' },
        { pattern: /password|secret|token|api_key|private_key/, tags: ['credential'], boundary: 'suspicious' },
        { pattern: /\.\.\/|\.\.\\|path\.join.*req/, tags: ['path-traversal'], boundary: 'suspicious' },
        { pattern: /fetch\s*\(|axios|request\s*\(/, tags: ['ssrf'], boundary: 'suspicious' },
        { pattern: /req\.(body|query|params|headers)/, tags: ['user-input'], boundary: 'suspicious' },
        { pattern: /fs\.(read|write|unlink|rename)/, tags: ['file-operation'], boundary: 'suspicious' },
    ];
    for (const rule of rules) {
        if (rule.pattern.test(content)) {
            tags.push(...rule.tags);
        }
    }
    const uniqueTags = [...new Set(tags)];
    const boundary = rules.some(r => r.boundary === 'dangerous' && r.pattern.test(content)) ? 'dangerous'
        : uniqueTags.length > 0 ? 'suspicious'
            : 'safe';
    return {
        sliceIndex: index,
        trustBoundary: boundary,
        sensitiveTags: uniqueTags,
        reason: boundary === 'safe' ? '未检测到安全敏感操作' : `检测到敏感模式: ${uniqueTags.join(', ')}`,
    };
}
// ===== Hunter Agent =====
export async function runHunter(ctx) {
    const findings = [];
    // 只审计 suspicious 和 dangerous 切片
    const targetIndices = ctx.parserResults
        .filter(r => r.trustBoundary !== 'safe')
        .map(r => r.sliceIndex);
    const targetSlices = targetIndices.map(i => ctx.slices[i]);
    for (let i = 0; i < targetSlices.length; i += BATCH_SIZE) {
        const batch = targetSlices.slice(i, i + BATCH_SIZE);
        const batchIndices = targetIndices.slice(i, i + BATCH_SIZE);
        const batchFindings = await huntBatch(batch, batchIndices, ctx);
        findings.push(...batchFindings);
    }
    return findings;
}
async function huntBatch(slices, indices, ctx) {
    const vulnKbSummary = ctx.vulnKbPatterns.slice(0, 10).map(v => `${v.cweId}(${v.cweName}): ${v.severity}`).join(', ');
    const slicesDescription = slices.map((s, idx) => `--- 切片 ${idx} [文件: ${s.filePath}:${s.lineStart}-${s.lineEnd}] ---\n\`\`\`${s.language}\n${s.content}\n\`\`\``).join('\n\n');
    const parserInfo = indices.map((_, idx) => {
        const pr = ctx.parserResults.find(p => p.sliceIndex === indices[idx]);
        return `切片${idx}: trustBoundary=${pr?.trustBoundary}, tags=${pr?.sensitiveTags.join(',')}`;
    }).join('\n');
    const systemPrompt = buildSystemPrompt('你是攻击者视角的安全专家（Hunter）。你的任务是在代码切片中挖掘安全漏洞。', '对发现的每个漏洞输出：sliceIndex, cweId, cweName, title, description, lineStart, lineEnd, vulnerableCode, severity, confidence, exploitability, dataFlow, fixSuggestion, pocDescription, pocCode, reproduceSteps, fixCode。\n输出JSON数组，无漏洞则输出 []。', ctx.modelConfig.systemPrompt);
    const userPrompt = `已知漏洞知识库（部分）: ${vulnKbSummary}

Parser 初步分析:
${parserInfo}

重要规则：
1. pocCode 必须是可直接运行的代码或命令，不要写伪代码
2. reproduceSteps 以数字编号逐步列出，每步一个操作
3. fixCode 应该是完整的修复代码，而非仅描述修复方向
4. 如果无法生成某字段，请输出空字符串 ""
5. 如果多个切片涉及同一文件的同一代码段，不要重复报告同一漏洞
6. 同一漏洞只报告一次，选择包含最完整上下文的切片

待审计代码：
${slicesDescription}

只输出 JSON 数组，如果没有发现漏洞输出空数组 []。`;
    try {
        const responseResult = await chatCompletion({ ...ctx.modelConfig, timeoutMs: ctx.modelConfig.timeoutMs ?? 90_000 }, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);
        const parsed = safeParseJsonArray(responseResult.content);
        const findings = [];
        for (const item of parsed) {
            const row = item;
            const sliceIdx = Number(row.sliceIndex ?? 0);
            const slice = slices[sliceIdx];
            if (!slice)
                continue;
            findings.push({
                cweId: String(row.cweId ?? 'CWE-000'),
                cweName: String(row.cweName ?? 'Unknown'),
                title: String(row.title ?? '未命名漏洞'),
                description: String(row.description ?? ''),
                filePath: slice.filePath,
                lineStart: Number(row.lineStart ?? slice.lineStart),
                lineEnd: Number(row.lineEnd ?? slice.lineEnd),
                vulnerableCode: String(row.vulnerableCode ?? ''),
                severity: ['critical', 'high', 'medium', 'low', 'info'].includes(String(row.severity)) ? String(row.severity) : 'medium',
                confidence: ['high', 'medium', 'low'].includes(String(row.confidence)) ? String(row.confidence) : 'medium',
                exploitability: Math.min(10, Math.max(1, Number(row.exploitability ?? 5))),
                dataFlow: String(row.dataFlow ?? ''),
                fixSuggestion: String(row.fixSuggestion ?? ''),
                pocDescription: String(row.pocDescription ?? ''),
                pocCode: String(row.pocCode ?? ''),
                reproduceSteps: String(row.reproduceSteps ?? ''),
                fixCode: String(row.fixCode ?? ''),
            });
        }
        return findings;
    }
    catch {
        return [];
    }
}
// ===== Validator Agent =====
export async function runValidator(ctx) {
    if (ctx.rawFindings.length === 0)
        return [];
    const validated = [];
    for (let i = 0; i < ctx.rawFindings.length; i += BATCH_SIZE) {
        const batch = ctx.rawFindings.slice(i, i + BATCH_SIZE);
        const batchValidated = await validateBatch(batch, ctx);
        validated.push(...batchValidated);
    }
    return validated;
}
async function validateBatch(findings, ctx) {
    const findingsDescription = findings.map((f, idx) => `--- 发现 ${idx} ---\nCWE: ${f.cweId}(${f.cweName})\n文件: ${f.filePath}:${f.lineStart}-${f.lineEnd}\n标题: ${f.title}\n描述: ${f.description}\n漏洞代码: ${f.vulnerableCode}\n严重度: ${f.severity}\n置信度: ${f.confidence}\n数据流: ${f.dataFlow}\nPoC描述: ${f.pocDescription || '无'}\nPoC代码: ${f.pocCode || '无'}\n复现步骤: ${f.reproduceSteps || '无'}\n修复代码: ${f.fixCode || '无'}`).join('\n\n');
    const systemPrompt = buildSystemPrompt('你是防御者视角的安全验证专家（Validator）。你的任务是验证漏洞发现是否为真实漏洞，排除误报。', '对每个发现输出：index, validated(true|false), validationReason, adjustedConfidence, adjustedSeverity(可选), improvedFixSuggestion(可选), improvedFixCode(可选), pocVerified(true|false)。\n输出JSON数组。', ctx.modelConfig.systemPrompt);
    const userPrompt = `请验证以下漏洞发现：

${findingsDescription}

只输出 JSON 数组。`;
    try {
        const responseResult = await chatCompletion({ ...ctx.modelConfig, timeoutMs: ctx.modelConfig.timeoutMs ?? 90_000 }, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);
        const parsed = safeParseJsonArray(responseResult.content);
        return findings.map((f, idx) => {
            const match = parsed.find(p => p.index === idx);
            const adjSeverity = String(match?.adjustedSeverity ?? '');
            return {
                ...f,
                confidence: ['high', 'medium', 'low'].includes(String(match?.adjustedConfidence ?? '')) ? String(match?.adjustedConfidence) : f.confidence,
                severity: ['critical', 'high', 'medium', 'low', 'info'].includes(adjSeverity) ? adjSeverity : f.severity,
                fixSuggestion: String(match?.improvedFixSuggestion ?? f.fixSuggestion),
                fixCode: String(match?.improvedFixCode ?? f.fixCode),
                validated: match?.validated !== false,
                validationReason: String(match?.validationReason ?? '未验证'),
            };
        });
    }
    catch {
        return findings.map(f => ({
            ...f,
            validated: true,
            validationReason: '验证失败，保持原始判断',
        }));
    }
}
// ===== Reporter Agent =====
export async function runReporter(ctx) {
    const confirmedFindings = ctx.validatedFindings.filter(f => f.validated);
    const riskScore = calculateRiskScore(confirmedFindings);
    if (confirmedFindings.length === 0) {
        return { riskScore, summary: '审计完成，未发现安全漏洞。', findings: [] };
    }
    const findingsSummary = confirmedFindings.slice(0, 20).map(f => `- [${f.severity.toUpperCase()}] ${f.cweId}: ${f.title} (${f.filePath}:${f.lineStart})`).join('\n');
    const prompt = `你是一个安全审计报告生成专家（Reporter）。基于以下漏洞发现，生成一份简洁的中文审计摘要。

风险评分: ${riskScore}/100
漏洞总数: ${confirmedFindings.length}

漏洞清单:
${findingsSummary}

请生成一段 200-300 字的审计摘要，包括：
1. 整体安全评估
2. 主要风险点
3. 优先修复建议

只输出摘要文本，不要输出 JSON。`;
    try {
        const summaryResult = await chatCompletion({ ...ctx.modelConfig, timeoutMs: ctx.modelConfig.timeoutMs ?? 60_000 }, [{ role: 'user', content: prompt }]);
        return { riskScore, summary: summaryResult.content.trim(), findings: confirmedFindings };
    }
    catch {
        return {
            riskScore,
            summary: `审计完成，发现 ${confirmedFindings.length} 个安全漏洞，风险评分 ${riskScore}/100。`,
            findings: confirmedFindings,
        };
    }
}
function calculateRiskScore(findings) {
    const weights = {
        critical: 15,
        high: 10,
        medium: 5,
        low: 2,
        info: 0,
    };
    let score = 0;
    for (const f of findings) {
        const weight = weights[f.severity] ?? 0;
        const confidenceMultiplier = f.confidence === 'high' ? 1.0 : f.confidence === 'medium' ? 0.7 : 0.4;
        score += Math.round(weight * confidenceMultiplier);
    }
    return Math.min(100, score);
}
