const REGEX_PATTERNS = [
    // 1. dangerous_command - 危险命令
    {
        riskCategory: 'dangerous_command',
        pattern: /(?:^|\n)[^\n#]*(?:rm\s+-rf\s+\/|mkfs\.|dd\s+if=.*of=\/dev|>:?\s*\/dev\/sd|chmod\s+-R\s+777\s+\/|chown\s+-R\s+\S+\s+\/)/i,
        fileExtensions: ['.py', '.js', '.ts', '.sh', '.bash', '.zsh'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'dangerous_command',
        pattern: /(?:subprocess|os\.system|os\.popen|exec|spawn|shell_exec)\s*\([^)]*(?:rm|delete|format|erase|shutdown|reboot)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    // 2. reverse_shell - 反向Shell
    {
        riskCategory: 'reverse_shell',
        pattern: /(?:bash|sh|zsh|nc|ncat|ncat)\s+[^#\n]*-(?:i|e|c)\s+[^#\n]*(?:>&|<\/dev\/tcp|\/dev\/tcp|socket\.connect)/i,
        fileExtensions: ['.py', '.js', '.ts', '.sh'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'reverse_shell',
        pattern: /socket\s*\(\s*AF_INET.*SOCK_STREAM|import\s+socket.*connect\s*\(|socket\.connect\s*\(\s*\(.*\d+\s*,\s*\d+/i,
        fileExtensions: ['.py'],
        maxMatchesPerFile: 5,
    },
    // 3. hardcoded_secrets - 硬编码凭据
    {
        riskCategory: 'hardcoded_secrets',
        pattern: /(?:password|passwd|secret|token|api_key|apikey|access_key|private_key|auth_token|client_secret)\s*[:=]\s*['"][^'"]{8,}['"]/i,
        fileExtensions: ['.py', '.js', '.ts', '.json', '.yaml', '.yml', '.toml', '.env', '.cfg', '.ini'],
        maxMatchesPerFile: 10,
    },
    {
        riskCategory: 'hardcoded_secrets',
        pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE KEY-----/i,
        maxMatchesPerFile: 3,
    },
    // 4. prompt_injection - 提示词注入
    {
        riskCategory: 'prompt_injection',
        pattern: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|rules|constraints|directives)/i,
        fileExtensions: ['.md', '.txt', '.py', '.js', '.ts', '.json'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'prompt_injection',
        pattern: /system\s*(?:prompt|instruction|message)\s*[:=]\s*['"].*\{.*(?:user_input|user_request|user_message|query).*\}/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'prompt_injection',
        pattern: /(?:you\s+are\s+now|new\s+role|act\s+as|pretend\s+(?:to\s+be|you're))\s+(?:a\s+)?(?:DAN|developer|admin|root|superuser)/i,
        fileExtensions: ['.md', '.txt', '.py', '.js', '.ts'],
        maxMatchesPerFile: 3,
    },
    // 5. data_exfiltration - 数据外泄
    {
        riskCategory: 'data_exfiltration',
        pattern: /(?:fetch|axios|requests|http\.get|urllib|wget|curl)\s*\([^)]*(?:https?:\/\/(?:[^\s'"]*(?:exfil|upload|collect|harvest|send|post|submit)[^\s'"]*))/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'data_exfiltration',
        pattern: /(?:send|post|upload|transmit)\s*(?:_?data|_?info|_?content|_?file|_?record|_?entry).*\b(?:password|token|secret|credential|api.?key|private|ssn|social)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    // 6. sensitive_file_access - 敏感文件访问
    {
        riskCategory: 'sensitive_file_access',
        pattern: /(?:read|open|access|load|cat|type)\s*(?:File|Dir|Directory|Files)?\s*\([^)]*(?:\/etc\/(?:passwd|shadow|hosts)|\/\.ssh|\/\.aws|\/\.env|\/proc\/self|id_rsa|\.pgpass|\.netrc|credentials|\.gitconfig)/i,
        fileExtensions: ['.py', '.js', '.ts', '.sh'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'sensitive_file_access',
        pattern: /\.\.\/\.\.\/(?:etc|root|home|var|proc)/i,
        maxMatchesPerFile: 5,
    },
    // 7. dynamic_code_execution - 动态代码执行
    {
        riskCategory: 'dynamic_code_execution',
        pattern: /(?:eval|exec|compile|Function\s*\(|new\s+Function|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`])\s*\(/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'dynamic_code_execution',
        pattern: /(?:__import__|importlib\.import_module|subprocess\.call|os\.system|os\.popen|child_process)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    // 8. privilege_escalation - 权限升级
    {
        riskCategory: 'privilege_escalation',
        pattern: /(?:sudo|su\s|runas|psexec|gsudo|doas)\s/i,
        fileExtensions: ['.py', '.js', '.ts', '.sh'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'privilege_escalation',
        pattern: /setuid|setgid|chmod\s+[4-7]755|os\.setuid/i,
        fileExtensions: ['.py', '.sh', '.c'],
        maxMatchesPerFile: 3,
    },
    // 9. weak_crypto - 弱加密
    {
        riskCategory: 'weak_crypto',
        pattern: /(?:MD5|md5|SHA1|sha1|DES|des|RC4|rc4|ECB|ecb)\s*(?:\.create|\.init|\.new|\.encrypt|\.digest)?\s*\(/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'weak_crypto',
        pattern: /(?:hashlib\.md5|hashlib\.sha1|crypto\.createCipher\s*\(\s*['"](?:des|rc4|aes-128-ecb))/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    // 10. command_injection - 命令注入
    {
        riskCategory: 'command_injection',
        pattern: /(?:exec|spawn|system|popen|shell_exec|subprocess\.(?:call|run|Popen))\s*\([^)]*(?:\+|f['"`]|\.\s*format|%s|req\.|request\.|input\(|user_|query|param)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'command_injection',
        pattern: /`[^`]*(?:\$\(|\${|req\.|request\.|input|args|param)[^`]*`/i,
        fileExtensions: ['.js', '.ts', '.sh'],
        maxMatchesPerFile: 5,
    },
    // 11. supply_chain_attack - 供应链攻击
    {
        riskCategory: 'supply_chain_attack',
        pattern: /(?:npm\s+install|pip\s+install|pip3\s+install|yarn\s+add|pnpm\s+add)\s+[^#\n]*(?:--force|--no-verify|--ignore-scripts|--allow-root)/i,
        fileExtensions: ['.sh', '.yml', '.yaml', '.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'supply_chain_attack',
        pattern: /(?:pip\s+install|npm\s+install).*(?:reqeusts|httplib|urllib3-malicious|malicious|typosquat)/i,
        fileExtensions: ['.txt', '.sh', '.yml', '.yaml', '.py', '.toml'],
        maxMatchesPerFile: 5,
    },
    // 12. unauthorized_tool_use - 未授权工具使用
    {
        riskCategory: 'unauthorized_tool_use',
        pattern: /(?:fetch|request|axios|http\.get|urllib\.request)\s*\([^)]*(?:127\.0\.0\.1|localhost|169\.254\.169\.254|0\.0\.0\.0|internal|intranet)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'unauthorized_tool_use',
        pattern: /(?:SSRF|ssrf|server.side.request)/i,
        fileExtensions: ['.py', '.js', '.ts', '.md'],
        maxMatchesPerFile: 3,
    },
    // 13. trigger_hijacking - 触发器劫持
    {
        riskCategory: 'trigger_hijacking',
        pattern: /(?:trigger|intent|handler|action)\s*[:=]\s*['"].*(?:\*|.*\.\*|catch.?all|match.?all|always.?run)/i,
        fileExtensions: ['.md', '.json', '.yaml', '.yml', '.py', '.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'trigger_hijacking',
        pattern: /(?:on_\w+|@app\.route|addEventListener)\s*\([^)]*\*\s*\)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 3,
    },
    // 14. skill_md_mismatch - SKILL.MD描述不符
    {
        riskCategory: 'skill_md_mismatch',
        pattern: /SKILL\.MD/i,
        fileExtensions: ['.md', '.json'],
        maxMatchesPerFile: 1,
    },
    // 15. code_quality - 代码质量
    {
        riskCategory: 'code_quality',
        pattern: /(?:TODO|FIXME|HACK|XXX|BUG|WORKAROUND)\b/i,
        maxMatchesPerFile: 3,
    },
    {
        riskCategory: 'code_quality',
        pattern: /try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{\s*\}/i,
        fileExtensions: ['.js', '.ts'],
        maxMatchesPerFile: 3,
    },
    {
        riskCategory: 'code_quality',
        pattern: /except\s*:\s*pass/i,
        fileExtensions: ['.py'],
        maxMatchesPerFile: 3,
    },
    // 16. bytecode_tampering - 字节码篡改
    {
        riskCategory: 'bytecode_tampering',
        pattern: /\.(?:pyc|pyo|class|so|dll|dylib|bin)/i,
        fileExtensions: ['.py', '.js', '.ts', '.json', '.yaml'],
        maxMatchesPerFile: 5,
    },
    // 17. obfuscation - 代码混淆
    {
        riskCategory: 'obfuscation',
        pattern: /eval\s*\(\s*(?:atob|Buffer\.from|String\.fromCharCode|unescape|decodeURIComponent|btoa)/i,
        fileExtensions: ['.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'obfuscation',
        pattern: /_0x[0-9a-f]{2,4}\s*=|var\s+_0x|function\s*_0x/i,
        fileExtensions: ['.js', '.ts'],
        maxMatchesPerFile: 5,
    },
    {
        riskCategory: 'obfuscation',
        pattern: /exec\s*\(\s*(?:compile|bytes\.fromhex|base64\.b64decode)/i,
        fileExtensions: ['.py'],
        maxMatchesPerFile: 3,
    },
    // 18. resource_abuse - 资源滥用
    {
        riskCategory: 'resource_abuse',
        pattern: /(?:while\s+True|for\s*\(\s*;\s*;\s*\)|setInterval|setTimeout.*0\s*\)|sleep\s*\(\s*\d{4,}|infinity)/i,
        fileExtensions: ['.py', '.js', '.ts'],
        maxMatchesPerFile: 3,
    },
    {
        riskCategory: 'resource_abuse',
        pattern: /(?:malloc|alloc|Buffer\s*\(\s*\d{5,}|Array\s*\(\s*\d{6,})/i,
        fileExtensions: ['.py', '.js', '.ts', '.c'],
        maxMatchesPerFile: 3,
    },
    // 19. unicode_steganography - Unicode隐写
    {
        riskCategory: 'unicode_steganography',
        pattern: /\\u200[bcd]|\\u200[f]|\\u202[ae]|\\u00ad|\\u206[0-4]|\\uFEFF|zero.?width/i,
        maxMatchesPerFile: 5,
    },
    // 20. social_engineering - 社会工程
    {
        riskCategory: 'social_engineering',
        pattern: /(?:验证.*身份|输入.*密码|账户.*锁定|紧急.*操作|立即.*验证|安全.*验证|身份.*过期|异常.*登录)/i,
        fileExtensions: ['.md', '.txt', '.py', '.js', '.ts'],
        maxMatchesPerFile: 3,
    },
    {
        riskCategory: 'social_engineering',
        pattern: /(?:account.*locked|verify.*identity|enter.*password|urgent.*action|immediate.*verification|security.*check|identity.*expired)/i,
        fileExtensions: ['.md', '.txt', '.py', '.js', '.ts'],
        maxMatchesPerFile: 3,
    },
];
/**
 * 对项目文件执行正则扫描
 */
export function runRegexScan(projectFiles) {
    const matches = [];
    for (const file of projectFiles) {
        if (!file.content)
            continue;
        const lines = file.content.split('\n');
        const ext = '.' + file.path.split('.').pop()?.toLowerCase();
        for (const rp of REGEX_PATTERNS) {
            // 检查文件扩展名过滤
            if (rp.fileExtensions && !rp.fileExtensions.includes(ext) && !rp.fileExtensions.some(e => file.path.endsWith(e))) {
                continue;
            }
            let matchCount = 0;
            const maxMatches = rp.maxMatchesPerFile ?? 10;
            for (let i = 0; i < lines.length && matchCount < maxMatches; i++) {
                const line = lines[i];
                if (rp.pattern.test(line)) {
                    matches.push({
                        riskCategory: rp.riskCategory,
                        filePath: file.path,
                        lineStart: i + 1,
                        lineEnd: i + 1,
                        matchText: line.trim(),
                        pattern: rp.pattern.source,
                    });
                    matchCount++;
                }
            }
        }
    }
    return matches;
}
