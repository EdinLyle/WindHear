/**
 * Skills Audit Agent 集群
 * 10个专业化Agent覆盖20种风险类型
 */
import { chatCompletion } from '../modelClients.js';
// ===== 通用LLM审计调用 =====
async function llmAudit(ctx, agentName, riskCategories, promptSuffix) {
    // 筛选与Agent相关的正则匹配
    const relevantMatches = ctx.regexMatches.filter(m => riskCategories.includes(m.riskCategory));
    // 收集相关文件内容（限制token量）
    const relevantFiles = new Set(relevantMatches.map(m => m.filePath));
    const fileContents = ctx.projectFiles
        .filter(f => relevantFiles.has(f.path))
        .map(f => `=== ${f.path} ===\n${(f.content ?? '').slice(0, 3000)}`)
        .join('\n\n')
        .slice(0, 15000);
    // 收集正则匹配摘要
    const matchSummary = relevantMatches
        .map(m => `[${m.riskCategory}] ${m.filePath}:${m.lineStart} - ${m.matchText.slice(0, 100)}`)
        .join('\n');
    // Skills描述
    const skillsDesc = ctx.skills.map(s => `Skill: ${s.name}${s.description ? ` - ${s.description}` : ''}${s.triggers ? `\n  Triggers: ${s.triggers.join(', ')}` : ''}`).join('\n');
    // SKILL.MD清单
    const manifestDesc = ctx.manifest
        ? `Name: ${ctx.manifest.name}\nTriggers: ${JSON.stringify(ctx.manifest.triggers)}\nEntry: ${ctx.manifest.entryPoint ?? 'N/A'}\nPermissions: ${ctx.manifest.permissions?.join(', ') ?? 'N/A'}`
        : 'No SKILL.MD found';
    const systemPrompt = `你是一个AI Skills安全审计专家（${agentName}）。你需要分析Skills代码和配置，识别${riskCategories.join('/')}相关的安全风险。

审计规则：
1. 仅报告与你的审计领域（${riskCategories.join('/')}）相关的发现
2. 每个发现必须给出具体的文件路径和行号
3. 严重程度：critical/high/medium/low/info
4. 置信度：high/medium/low（正则+LLM双重确认→high，仅LLM→medium）
5. 如果没有发现风险，返回空数组

你必须以JSON数组格式返回发现项，格式如下：
[{
  "riskCategory": "风险类别",
  "title": "简短标题",
  "description": "详细描述",
  "severity": "critical|high|medium|low|info",
  "confidence": "high|medium|low",
  "filePath": "文件路径",
  "lineStart": 行号,
  "lineEnd": 行号,
  "vulnerableCode": "问题代码片段",
  "evidence": "证据描述",
  "remediation": "修复建议",
  "cweId": "CWE-ID",
  "cweName": "CWE名称"
}]

如果没有发现，返回: []`;
    // Layer3: 用户策略追加增强
    const parts = [systemPrompt];
    if (ctx.modelConfig.systemPrompt?.trim()) {
        parts.push(`【用户审计策略】\n${ctx.modelConfig.systemPrompt.trim()}`);
    }
    const effectiveSystemPrompt = parts.join('\n\n');
    const userPrompt = `${promptSuffix}

=== Skills 信息 ===
${skillsDesc}

=== SKILL.MD 清单 ===
${manifestDesc}

=== 正则扫描初步匹配 ===
${matchSummary || '无正则匹配'}

=== 相关文件内容 ===
${fileContents || '无相关文件'}

请分析以上信息，识别${riskCategories.join('/')}相关的安全风险，以JSON数组格式返回。`;
    try {
        const response = await chatCompletion({
            provider: ctx.modelConfig.provider,
            baseUrl: ctx.modelConfig.baseUrl,
            apiKey: ctx.modelConfig.apiKey,
            model: ctx.modelConfig.model,
            timeoutMs: ctx.modelConfig.timeoutMs ?? 60_000,
        }, [
            { role: 'system', content: effectiveSystemPrompt },
            { role: 'user', content: userPrompt },
        ]);
        // 解析LLM返回的JSON
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch)
            return [];
        const findings = JSON.parse(jsonMatch[0]);
        return findings.map(f => ({
            riskCategory: f.riskCategory ?? riskCategories[0],
            title: String(f.title ?? '未命名发现'),
            description: String(f.description ?? ''),
            severity: f.severity ?? 'medium',
            confidence: f.confidence ?? 'medium',
            filePath: String(f.filePath ?? ''),
            lineStart: f.lineStart ? Number(f.lineStart) : undefined,
            lineEnd: f.lineEnd ? Number(f.lineEnd) : undefined,
            vulnerableCode: f.vulnerableCode ? String(f.vulnerableCode) : undefined,
            evidence: String(f.evidence ?? `LLM分析 by ${agentName}`),
            remediation: String(f.remediation ?? ''),
            cweId: f.cweId ? String(f.cweId) : undefined,
            cweName: f.cweName ? String(f.cweName) : undefined,
        })).filter(f => f.filePath && riskCategories.includes(f.riskCategory));
    }
    catch (err) {
        console.error(`[${agentName}] LLM audit failed:`, err);
        return [];
    }
}
// ===== 10个专业化Agent =====
/** CommandAgent: 危险命令 + 反向Shell + 命令注入 */
export const CommandAgent = {
    name: 'CommandAgent',
    riskCategories: ['dangerous_command', 'reverse_shell', 'command_injection'],
    async audit(ctx) {
        return llmAudit(ctx, 'CommandAgent', ['dangerous_command', 'reverse_shell', 'command_injection'], '重点检查：\n1. 危险系统命令执行（rm -rf /、mkfs、dd等）\n2. 反向Shell连接（/dev/tcp、nc -e、socket.connect）\n3. 命令注入（用户输入拼接到exec/system/subprocess）');
    },
};
/** InjectionAgent: 动态代码执行 + 提示词注入 */
export const InjectionAgent = {
    name: 'InjectionAgent',
    riskCategories: ['dynamic_code_execution', 'prompt_injection'],
    async audit(ctx) {
        return llmAudit(ctx, 'InjectionAgent', ['dynamic_code_execution', 'prompt_injection'], '重点检查：\n1. 动态代码执行（eval、exec、new Function、compile）\n2. 提示词注入（system prompt拼接用户输入、越狱指令、角色覆盖）\n3. 检查SKILL.MD中是否有可被外部输入覆盖的提示词');
    },
};
/** CredentialAgent: 硬编码凭据 + 弱加密 */
export const CredentialAgent = {
    name: 'CredentialAgent',
    riskCategories: ['hardcoded_secrets', 'weak_crypto'],
    async audit(ctx) {
        return llmAudit(ctx, 'CredentialAgent', ['hardcoded_secrets', 'weak_crypto'], '重点检查：\n1. 硬编码凭据（API Key、密码、Token直接写在代码中）\n2. 弱加密算法使用（MD5、SHA1、DES、RC4、ECB模式）\n3. 私钥泄露（BEGIN PRIVATE KEY）');
    },
};
/** ExfilAgent: 数据外泄 + 敏感文件访问 */
export const ExfilAgent = {
    name: 'ExfilAgent',
    riskCategories: ['data_exfiltration', 'sensitive_file_access'],
    async audit(ctx) {
        return llmAudit(ctx, 'ExfilAgent', ['data_exfiltration', 'sensitive_file_access'], '重点检查：\n1. 数据外泄（向外部URL发送敏感数据、环境变量中的凭据被发送）\n2. 敏感文件访问（读取/etc/passwd、.ssh、.aws、.env等）\n3. 路径遍历（../../../etc/passwd）');
    },
};
/** PrivilegeAgent: 权限升级 + 未授权工具使用 */
export const PrivilegeAgent = {
    name: 'PrivilegeAgent',
    riskCategories: ['privilege_escalation', 'unauthorized_tool_use'],
    async audit(ctx) {
        return llmAudit(ctx, 'PrivilegeAgent', ['privilege_escalation', 'unauthorized_tool_use'], '重点检查：\n1. 权限升级（sudo、setuid、chmod 4755）\n2. 未授权工具使用（SSRF、访问内部服务169.254.169.254、localhost端口扫描）\n3. Skill是否请求了超出其功能所需的权限');
    },
};
/** SupplyChainAgent: 供应链攻击 + 字节码篡改 */
export const SupplyChainAgent = {
    name: 'SupplyChainAgent',
    riskCategories: ['supply_chain_attack', 'bytecode_tampering'],
    async audit(ctx) {
        return llmAudit(ctx, 'SupplyChainAgent', ['supply_chain_attack', 'bytecode_tampering'], '重点检查：\n1. 供应链攻击（恶意npm/pip包、--force安装、typosquatting）\n2. 字节码篡改（.pyc/.class/.so文件、无源码的编译产物）\n3. CDN脚本注入（引用不受信的HTTP CDN）\n4. package.json/requirements.txt中的可疑依赖');
    },
};
/** SkillManifestAgent: 触发器劫持 + SKILL.MD描述不符 */
export const SkillManifestAgent = {
    name: 'SkillManifestAgent',
    riskCategories: ['trigger_hijacking', 'skill_md_mismatch'],
    async audit(ctx) {
        return llmAudit(ctx, 'SkillManifestAgent', ['trigger_hijacking', 'skill_md_mismatch'], '重点检查：\n1. 触发器劫持（通配符trigger、catch-all handler、多个Skill注册相同trigger）\n2. SKILL.MD描述与实际代码行为不符（声称只读但实际有写操作、声称本地操作但实际联网）\n3. Skill权限声明与实际使用不一致');
    },
};
/** QualityAgent: 代码质量 + 资源滥用 + 混淆 */
export const QualityAgent = {
    name: 'QualityAgent',
    riskCategories: ['code_quality', 'resource_abuse', 'obfuscation'],
    async audit(ctx) {
        return llmAudit(ctx, 'QualityAgent', ['code_quality', 'resource_abuse', 'obfuscation'], '重点检查：\n1. 代码质量问题（空catch块、except:pass、大量TODO/FIXME）\n2. 资源滥用（无限循环、大内存分配、CPU密集操作无超时）\n3. 代码混淆（eval(atob())、_0x变量名、String.fromCharCode编码）');
    },
};
/** SteganographyAgent: Unicode隐写 */
export const SteganographyAgent = {
    name: 'SteganographyAgent',
    riskCategories: ['unicode_steganography'],
    async audit(ctx) {
        return llmAudit(ctx, 'SteganographyAgent', ['unicode_steganography'], '重点检查：\n1. Unicode隐写（零宽字符\\u200b-\\u200f、\\u202a-\\u202e、同形字攻击）\n2. 隐藏的控制字符（BOM、软连字符\\u00ad、不可见字符）\n3. 字符编码欺骗（看起来正常但包含隐藏字符的变量名或URL）');
    },
};
/** SocialEngAgent: 社会工程 */
export const SocialEngAgent = {
    name: 'SocialEngAgent',
    riskCategories: ['social_engineering'],
    async audit(ctx) {
        return llmAudit(ctx, 'SocialEngAgent', ['social_engineering'], '重点检查：\n1. 社会工程攻击（伪装系统安全警告、诱导输入密码、账户锁定欺骗）\n2. Skill输出中包含操纵用户行为的措辞\n3. 要求用户执行不安全操作的指令');
    },
};
/** 所有Agent列表 */
export const ALL_AGENTS = [
    CommandAgent,
    InjectionAgent,
    CredentialAgent,
    ExfilAgent,
    PrivilegeAgent,
    SupplyChainAgent,
    SkillManifestAgent,
    QualityAgent,
    SteganographyAgent,
    SocialEngAgent,
];
