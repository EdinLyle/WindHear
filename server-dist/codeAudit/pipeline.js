import { promises as fs } from 'fs';
import path from 'path';
import { preprocessZip, preprocessGit } from './preprocessor.js';
import { sliceProject } from './slicer.js';
import { runParser, runHunter, runValidator, runReporter } from './agents.js';
// 漏洞去重：基于文件路径 + CWE ID + 行号范围重叠
function dedupFindings(findings) {
    const result = [];
    const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
    for (const f of findings) {
        if (!f.validated) {
            result.push(f);
            continue;
        }
        // 查找已有结果中是否存在候选重复
        const dupIdx = result.findIndex(r => r.validated &&
            r.filePath === f.filePath &&
            r.cweId === f.cweId &&
            r.lineStart <= f.lineEnd &&
            f.lineStart <= r.lineEnd);
        if (dupIdx === -1) {
            result.push(f);
        }
        else {
            // 保留严重度更高的
            const existing = result[dupIdx];
            if (severityOrder.indexOf(f.severity) > severityOrder.indexOf(existing.severity)) {
                result[dupIdx] = f;
            }
            else if (severityOrder.indexOf(f.severity) === severityOrder.indexOf(existing.severity)) {
                // 严重度相同，保留置信度更高的
                const confOrder = ['low', 'medium', 'high'];
                if (confOrder.indexOf(f.confidence) > confOrder.indexOf(existing.confidence)) {
                    result[dupIdx] = f;
                }
            }
        }
    }
    return result;
}
export async function runCodeAuditPipeline(input) {
    const { auditId, store, modelConfig } = input;
    const extractDir = path.join('temp', 'code-audits', String(auditId));
    try {
        // ===== Phase 1: Parsing =====
        await store.updateAuditStatus(auditId, 'parsing');
        await store.addLog(auditId, 'parsing', '开始预处理源码...');
        let projectFiles;
        let totalFiles;
        let languages;
        if (input.zipBuffer) {
            const result = await preprocessZip(input.zipBuffer, extractDir);
            projectFiles = result.files;
            totalFiles = result.totalFiles;
            languages = result.languages;
        }
        else if (input.gitUrl) {
            const result = await preprocessGit(input.gitUrl, extractDir);
            projectFiles = result.files;
            totalFiles = result.totalFiles;
            languages = result.languages;
        }
        else {
            throw new Error('未提供源码来源');
        }
        const primaryLanguage = languages.length > 0 ? languages[0] : undefined;
        await store.updateAuditStatus(auditId, 'parsing', {
            total_files: totalFiles,
            language: primaryLanguage ?? null,
        });
        await store.addLog(auditId, 'parsing', `预处理完成: ${projectFiles.length} 个源码文件, 语言: ${languages.join(', ')}`);
        // ===== Phase 2: Slicing =====
        await store.updateAuditStatus(auditId, 'slicing');
        await store.addLog(auditId, 'slicing', '开始代码切片...');
        const slices = await sliceProject(extractDir, projectFiles);
        await store.updateAuditStatus(auditId, 'slicing', {
            total_slices: slices.length,
        });
        // 保存切片到数据库
        for (const slice of slices) {
            await store.createSlice({
                auditId,
                filePath: slice.filePath,
                language: slice.language,
                sliceType: slice.sliceType,
                content: slice.content,
                contextSummary: slice.contextSummary,
                lineStart: slice.lineStart,
                lineEnd: slice.lineEnd,
            });
        }
        await store.addLog(auditId, 'slicing', `切片完成: 共 ${slices.length} 个切片`);
        // ===== Phase 3: Auditing (Parser -> Hunter -> Validator) =====
        await store.updateAuditStatus(auditId, 'auditing');
        // 加载知识库模式
        const vulnKbRows = await store.listVulnKb();
        const vulnKbPatterns = vulnKbRows.map((r) => ({
            cweId: String(r.cwe_id ?? ''),
            cweName: String(r.cwe_name ?? ''),
            riskPattern: String(r.risk_pattern ?? ''),
            severity: String(r.severity ?? ''),
        }));
        const ctx = {
            auditId,
            extractDir,
            slices,
            parserResults: [],
            rawFindings: [],
            validatedFindings: [],
            vulnKbPatterns,
            modelConfig,
        };
        // Parser
        await store.addLog(auditId, 'auditing', 'Parser Agent 开始分析...');
        ctx.parserResults = await runParser(ctx);
        const dangerousCount = ctx.parserResults.filter(r => r.trustBoundary === 'dangerous').length;
        const suspiciousCount = ctx.parserResults.filter(r => r.trustBoundary === 'suspicious').length;
        await store.addLog(auditId, 'auditing', `Parser 完成: ${dangerousCount} dangerous, ${suspiciousCount} suspicious, ${slices.length - dangerousCount - suspiciousCount} safe`);
        // 更新切片敏感标记
        for (const pr of ctx.parserResults) {
            const slice = slices[pr.sliceIndex];
            if (slice && pr.trustBoundary !== 'safe') {
                // 通过 file_path + line_start 定位切片并更新
                await store.updateSliceSensitive(auditId, slice.filePath, slice.lineStart, JSON.stringify(pr.sensitiveTags));
            }
        }
        // Hunter
        await store.addLog(auditId, 'auditing', 'Hunter Agent 开始漏洞挖掘...');
        ctx.rawFindings = await runHunter(ctx);
        await store.addLog(auditId, 'auditing', `Hunter 完成: 发现 ${ctx.rawFindings.length} 个潜在漏洞`);
        // Validator
        await store.addLog(auditId, 'auditing', 'Validator Agent 开始验证...');
        ctx.validatedFindings = await runValidator(ctx);
        const confirmedCount = ctx.validatedFindings.filter(f => f.validated).length;
        await store.addLog(auditId, 'auditing', `Validator 完成: ${confirmedCount} 个已确认, ${ctx.validatedFindings.length - confirmedCount} 个已排除`);
        // 去重：移除同一文件同一CWE行号重叠的重复漏洞
        const beforeDedup = ctx.validatedFindings.length;
        ctx.validatedFindings = dedupFindings(ctx.validatedFindings);
        const dedupedCount = beforeDedup - ctx.validatedFindings.length;
        if (dedupedCount > 0) {
            await store.addLog(auditId, 'auditing', `去重完成: 移除 ${dedupedCount} 个重复漏洞`);
        }
        // ===== Phase 4: Aggregating =====
        await store.updateAuditStatus(auditId, 'aggregating');
        await store.addLog(auditId, 'aggregating', 'Reporter Agent 生成报告...');
        const report = await runReporter(ctx);
        // 保存审计发现项到数据库
        for (const finding of ctx.validatedFindings) {
            await store.createItem({
                auditId,
                cweId: finding.cweId,
                cweName: finding.cweName,
                title: finding.title,
                description: finding.description,
                filePath: finding.filePath,
                lineStart: finding.lineStart,
                lineEnd: finding.lineEnd,
                vulnerableCode: finding.vulnerableCode,
                fixSuggestion: finding.fixSuggestion,
                severity: finding.severity,
                confidence: finding.confidence,
                exploitability: finding.exploitability,
                dataFlow: finding.dataFlow,
                pocDescription: finding.pocDescription || undefined,
                pocCode: finding.pocCode || undefined,
                reproduceSteps: finding.reproduceSteps || undefined,
                fixCode: finding.fixCode || undefined,
                status: finding.validated ? 'confirmed' : 'false_positive',
            });
        }
        await store.updateAuditStatus(auditId, 'completed', {
            findings_count: ctx.validatedFindings.filter(f => f.validated).length,
            risk_score: report.riskScore,
            completed_at: Math.floor(Date.now() / 1000),
        });
        await store.addLog(auditId, 'completed', `审计完成! 风险评分: ${report.riskScore}/100, 确认漏洞: ${report.findings.length} 个`);
        // 清理临时文件
        try {
            await fs.rm(extractDir, { recursive: true, force: true });
        }
        catch { /* ignore */ }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.setAuditError(auditId, message);
        await store.addLog(auditId, 'failed', `审计失败: ${message}`);
        try {
            await fs.rm(extractDir, { recursive: true, force: true });
        }
        catch { /* ignore */ }
    }
}
