import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export type Db = Awaited<ReturnType<typeof openDb>>

// 模块级 db Promise 缓存，供 insertTokenUsage 等函数使用
let _dbPromise: Promise<Awaited<ReturnType<typeof doOpenDb>>> | null = null

export function openDb() {
  if (!_dbPromise) {
    _dbPromise = doOpenDb()
  }
  return _dbPromise
}

function getDbPath() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..', 'data', 'tingfeng.db')
}

async function doOpenDb() {
  const filename = getDbPath()
  await fs.mkdir(path.dirname(filename), { recursive: true })
  const db = await open({
    filename,
    driver: sqlite3.Database,
  })
  await db.exec('PRAGMA foreign_keys = ON;')
  await migrate(db)
  return db
}

async function migrate(db: Awaited<ReturnType<typeof open>>) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      library TEXT NOT NULL,
      riskType TEXT NOT NULL,
      riskSubType TEXT,
      prompt TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_library ON prompts(library);
    CREATE INDEX IF NOT EXISTS idx_prompts_riskType ON prompts(riskType);
    CREATE INDEX IF NOT EXISTS idx_prompts_riskSubType ON prompts(riskSubType);

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      standard TEXT NOT NULL,
      status TEXT NOT NULL,
      targetProvider TEXT NOT NULL,
      targetBaseUrl TEXT NOT NULL,
      targetApiKey TEXT,
      targetModel TEXT,
      createdAt INTEGER NOT NULL,
      startedAt INTEGER,
      finishedAt INTEGER,
      totalCount INTEGER NOT NULL DEFAULT 0,
      passCount INTEGER NOT NULL DEFAULT 0,
      failCount INTEGER NOT NULL DEFAULT 0,
      passRate REAL NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_createdAt ON evaluations(createdAt);
    CREATE INDEX IF NOT EXISTS idx_evaluations_standard ON evaluations(standard);
    CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);

    CREATE TABLE IF NOT EXISTS evaluation_items (
      id TEXT PRIMARY KEY,
      evaluationId TEXT NOT NULL,
      promptId TEXT,
      inputPrompt TEXT NOT NULL,
      riskType TEXT NOT NULL,
      modelOutput TEXT NOT NULL,
      evaluatorScore INTEGER,
      evaluatorRawOutput TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (evaluationId) REFERENCES evaluations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_eval_items_evalId ON evaluation_items(evaluationId);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_scans (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      status TEXT NOT NULL,
      progress_stage TEXT NOT NULL,
      progress_percent INTEGER NOT NULL,
      error TEXT,
      options TEXT NOT NULL,
      logs TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mcp_scans_created_at ON mcp_scans(created_at);

    CREATE TABLE IF NOT EXISTS mcp_reports (
      scan_id TEXT PRIMARY KEY,
      generated_at INTEGER NOT NULL,
      project_info TEXT NOT NULL,
      findings TEXT NOT NULL,
      score_total INTEGER NOT NULL,
      score_risk_level TEXT NOT NULL,
      markdown TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES mcp_scans(id) ON DELETE CASCADE
    );
  `)

  // ===== Prompt Collections 测试集分组表 =====
  await db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      library TEXT NOT NULL,
      description TEXT,
      prompt_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_collections_library ON prompt_collections(library);
  `)

  // 检查并添加 prompts 表的 collection_id 列
  const promptColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(prompts);')
  const hasCollectionId = promptColumns.some(col => col.name === 'collection_id')
  if (!hasCollectionId) {
    await db.exec('ALTER TABLE prompts ADD COLUMN collection_id TEXT;')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_prompts_collection_id ON prompts(collection_id);')
  }

  // 检查并添加 riskSubType 列（如果不存在）
  const columns = await db.all<Array<{ name: string }>>('PRAGMA table_info(prompts);')
  const hasRiskSubType = columns.some(col => col.name === 'riskSubType')
  if (!hasRiskSubType) {
    await db.exec('ALTER TABLE prompts ADD COLUMN riskSubType TEXT;')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_prompts_riskSubType ON prompts(riskSubType);')
  }

  // 检查并添加 evaluation_items 表的 riskSubType 列
  const evalItemColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(evaluation_items);')
  const hasEvalItemRiskSubType = evalItemColumns.some(col => col.name === 'riskSubType')
  if (!hasEvalItemRiskSubType) {
    await db.exec('ALTER TABLE evaluation_items ADD COLUMN riskSubType TEXT;')
  }

  // 检查并添加 evaluations 表的 collectionId 列
  const evalColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(evaluations);')
  const hasEvalCollectionId = evalColumns.some(col => col.name === 'collectionId')
  if (!hasEvalCollectionId) {
    await db.exec('ALTER TABLE evaluations ADD COLUMN collectionId TEXT;')
  }

  // 检查并添加 mcp_scans 表的 original_filename 列
  const mcpColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(mcp_scans);')
  const hasOriginalFilename = mcpColumns.some(col => col.name === 'original_filename')
  if (!hasOriginalFilename) {
    // 检查是否有截断的列名
    const hasTruncatedOriginalFilename = mcpColumns.some(col => col.name === 'original_fi')
    if (hasTruncatedOriginalFilename) {
      // 重命名截断的列
      await db.exec('ALTER TABLE mcp_scans RENAME COLUMN original_fi TO original_filename;')
    } else {
      // 添加缺失的列
      await db.exec('ALTER TABLE mcp_scans ADD COLUMN original_filename TEXT;')
    }
  }

  // 检查并添加 mcp_scans 表的缺失列（progress_stage, progress_percent, error, options, logs）
  if (!mcpColumns.some(col => col.name === 'progress_stage')) {
    await db.exec("ALTER TABLE mcp_scans ADD COLUMN progress_stage TEXT NOT NULL DEFAULT 'pending';")
  }
  if (!mcpColumns.some(col => col.name === 'progress_percent')) {
    await db.exec('ALTER TABLE mcp_scans ADD COLUMN progress_percent INTEGER NOT NULL DEFAULT 0;')
  }
  if (!mcpColumns.some(col => col.name === 'error')) {
    await db.exec('ALTER TABLE mcp_scans ADD COLUMN error TEXT;')
  }
  if (!mcpColumns.some(col => col.name === 'options')) {
    await db.exec("ALTER TABLE mcp_scans ADD COLUMN options TEXT NOT NULL DEFAULT '{}';")
  }
  if (!mcpColumns.some(col => col.name === 'logs')) {
    await db.exec("ALTER TABLE mcp_scans ADD COLUMN logs TEXT NOT NULL DEFAULT '[]';")
  }

  // 检查并添加 mcp_reports 表的 score_risk_level 列
  const mcpReportsColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(mcp_reports);')
  const hasScoreRiskLevel = mcpReportsColumns.some(col => col.name === 'score_risk_level')
  if (!hasScoreRiskLevel) {
    // 检查是否有截断的列名
    const hasTruncatedScoreRiskLevel = mcpReportsColumns.some(col => col.name === 'score_risk_')
    if (hasTruncatedScoreRiskLevel) {
      // 重命名截断的列
      await db.exec('ALTER TABLE mcp_reports RENAME COLUMN score_risk_ TO score_risk_level;')
    } else {
      // 添加缺失的列
      await db.exec('ALTER TABLE mcp_reports ADD COLUMN score_risk_level TEXT;')
    }
  }

  // 检查并修复 mcp_reports 表的 project_info 列
  const hasProjectInfo = mcpReportsColumns.some(col => col.name === 'project_info')
  if (!hasProjectInfo) {
    // 检查是否有截断的列名
    const hasTruncatedProjectInfo = mcpReportsColumns.some(col => col.name === 'project_inf')
    if (hasTruncatedProjectInfo) {
      // 重命名截断的列
      await db.exec('ALTER TABLE mcp_reports RENAME COLUMN project_inf TO project_info;')
    } else {
      // 添加缺失的列
      await db.exec('ALTER TABLE mcp_reports ADD COLUMN project_info TEXT;')
    }
  }

  // 检查并修复 mcp_reports 表的 generated_at 列
  const hasGeneratedAt = mcpReportsColumns.some(col => col.name === 'generated_at')
  if (!hasGeneratedAt) {
    // 检查是否有截断的列名
    const hasTruncatedGeneratedAt = mcpReportsColumns.some(col => col.name === 'generated_a')
    if (hasTruncatedGeneratedAt) {
      // 重命名截断的列
      await db.exec('ALTER TABLE mcp_reports RENAME COLUMN generated_a TO generated_at;')
    } else {
      // 添加缺失的列
      await db.exec('ALTER TABLE mcp_reports ADD COLUMN generated_at INTEGER;')
    }
  }

  // ===== CodeAudit 模块表 =====
  await db.exec(`
    CREATE TABLE IF NOT EXISTS code_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_type TEXT CHECK(source_type IN ('zip', 'git')) NOT NULL,
      source_path TEXT NOT NULL,
      source_url TEXT,
      status TEXT CHECK(status IN ('pending','parsing','slicing','auditing','aggregating','completed','failed')) DEFAULT 'pending',
      language TEXT,
      total_files INTEGER DEFAULT 0,
      total_slices INTEGER DEFAULT 0,
      processed_slices INTEGER DEFAULT 0,
      findings_count INTEGER DEFAULT 0,
      risk_score INTEGER DEFAULT 0,
      error_message TEXT,
      model_config TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_code_audits_status ON code_audits(status);
    CREATE INDEX IF NOT EXISTS idx_code_audits_created_at ON code_audits(created_at);

    CREATE TABLE IF NOT EXISTS code_slices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES code_audits(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      language TEXT NOT NULL,
      slice_type TEXT CHECK(slice_type IN ('function','class','api_call','config','route','other')) NOT NULL,
      content TEXT NOT NULL,
      context_summary TEXT,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      is_sensitive INTEGER DEFAULT 0,
      sensitive_tags TEXT,
      audit_status TEXT DEFAULT 'pending',
      audit_result TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_code_slices_audit_id ON code_slices(audit_id);

    CREATE TABLE IF NOT EXISTS code_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES code_audits(id) ON DELETE CASCADE,
      slice_id INTEGER REFERENCES code_slices(id),
      cwe_id TEXT,
      cwe_name TEXT,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      line_start INTEGER,
      line_end INTEGER,
      vulnerable_code TEXT,
      fix_suggestion TEXT,
      severity TEXT CHECK(severity IN ('critical','high','medium','low','info')) NOT NULL,
      confidence TEXT CHECK(confidence IN ('high','medium','low')) NOT NULL,
      exploitability INTEGER DEFAULT 5,
      data_flow TEXT,
      status TEXT CHECK(status IN ('confirmed','false_positive','pending')) DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_code_audit_items_audit_id ON code_audit_items(audit_id);
    CREATE INDEX IF NOT EXISTS idx_code_audit_items_severity ON code_audit_items(severity);

    CREATE TABLE IF NOT EXISTS code_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES code_audits(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      message TEXT,
      detail TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_code_audit_logs_audit_id ON code_audit_logs(audit_id);

    CREATE TABLE IF NOT EXISTS vuln_kb (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cwe_id TEXT NOT NULL UNIQUE,
      cwe_name TEXT NOT NULL,
      description TEXT,
      risk_pattern TEXT,
      fix_pattern TEXT,
      severity TEXT,
      tags TEXT,
      examples TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_vuln_kb_cwe_id ON vuln_kb(cwe_id);
  `)

  // 初始化 CWE Top 20 种子数据
  const kbCount = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM vuln_kb;')
  if (!kbCount || kbCount.cnt === 0) {
    const seedData: [string, string, string, string, string, string][] = [
      ['CWE-89', 'SQL Injection', '构造动态 SQL 时未参数化', 'SELECT|INSERT|UPDATE|DELETE.*\\+.*\\$|query\\(.*\\+', 'critical', '["injection","database"]'],
      ['CWE-78', 'OS Command Injection', '未过滤用户输入直接拼接系统命令', 'exec|spawn|system|shell_exec|os\\.system', 'critical', '["injection","rce"]'],
      ['CWE-94', 'Code Injection', '危险函数执行动态代码', 'eval|new Function|setTimeout|setInterval.*string', 'high', '["injection","code"]'],
      ['CWE-22', 'Path Traversal', '文件路径拼接未限制目录', '\\.\\./|\\.\\.\\\\|path\\.join.*req\\.|fs\\.readFile.*req\\.', 'high', '["file","path"]'],
      ['CWE-798', 'Hardcoded Credentials', '源码中硬编码密钥或密码', 'password|secret|token|api_key|private_key.*=.*["\']+[^\']+["\']', 'high', '["credential","config"]'],
      ['CWE-200', 'Information Exposure', '敏感信息泄露至日志或响应', 'console\\.log|logger\\.(info|debug|error).*(password|token|secret)', 'medium', '["info-leak","log"]'],
      ['CWE-352', 'CSRF', '状态改变请求缺乏令牌验证', 'post|put|delete.*req\\.(body|query)', 'medium', '["web","csrf"]'],
      ['CWE-434', 'Unrestricted Upload', '文件上传未校验类型', 'multer|upload.*file|fs\\.writeFile.*req', 'high', '["file","upload"]'],
      ['CWE-79', 'XSS', '未对用户输入进行转义直接输出到页面', 'innerHTML|document\\.write|v-html|dangerouslySetInnerHTML', 'high', '["web","xss"]'],
      ['CWE-502', 'Deserialization', '不安全的反序列化操作', 'pickle\\.loads|yaml\\.load|unserialize|ObjectInputStream', 'high', '["deserialization","injection"]'],
      ['CWE-611', 'XXE', 'XML 外部实体注入', 'libxml|parseString|sax|xml\\.etree', 'high', '["xml","injection"]'],
      ['CWE-327', 'Broken Crypto', '使用弱加密算法', 'MD5|SHA1|DES|RC4|ECB', 'medium', '["crypto","weak"]'],
      ['CWE-326', 'Insufficient Encryption', '加密强度不足', 'aes-128|key.*=.*16|iv.*=.*16', 'medium', '["crypto","weak"]'],
      ['CWE-639', 'IDOR', '通过 ID 直接访问未授权资源', 'findById|findOne.*req\\.params|req\\.query\\.id', 'medium', '["auth","idor"]'],
      ['CWE-287', 'Improper Authentication', '认证逻辑不当', 'verify|authenticate|login|session', 'high', '["auth","authentication"]'],
      ['CWE-306', 'Missing Authentication', '关键功能缺少认证', 'app\\.(get|post|put|delete)|router\\.(get|post)', 'high', '["auth","missing"]'],
      ['CWE-862', 'Missing Authorization', '缺少授权检查', 'middleware|auth|permission|role', 'medium', '["auth","authorization"]'],
      ['CWE-190', 'Integer Overflow', '整数溢出', 'parseInt|Number\\(|\\+\\+|\\-\\-', 'low', '["numeric","overflow"]'],
      ['CWE-400', 'DoS', '拒绝服务漏洞', 'JSON\\.parse|regex|crypto\\.pbkdf2', 'medium', '["dos","availability"]'],
      ['CWE-918', 'SSRF', '服务端请求伪造', 'fetch|request|axios|http\\.get.*req\\.', 'high', '["network","ssrf"]'],
    ]
    const stmt = await db.prepare('INSERT OR IGNORE INTO vuln_kb (cwe_id, cwe_name, description, risk_pattern, severity, tags) VALUES (?, ?, ?, ?, ?, ?)')
    for (const row of seedData) {
      await stmt.run(row[0], row[1], row[2], row[3], row[4], row[5])
    }
    await stmt.finalize()
  }

  // ===== Collection 分组迁移：为现有prompt自动创建测试集分组 =====
  const existingCollections = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM prompt_collections;')
  if (existingCollections && existingCollections.cnt === 0) {
    // 对 tc260/general: 按 riskType 分组创建 collection
    for (const lib of ['tc260', 'general']) {
      const groups = await db.all<Array<{ riskType: string; cnt: number }>>(
        'SELECT riskType, COUNT(1) as cnt FROM prompts WHERE library = ? GROUP BY riskType;',
        [lib],
      )
      for (const g of groups) {
        const collId = crypto.randomUUID()
        const now = Date.now()
        await db.run(
          'INSERT INTO prompt_collections (id, name, library, description, prompt_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [collId, g.riskType, lib, null, g.cnt, now, now],
        )
        await db.run('UPDATE prompts SET collection_id = ? WHERE library = ? AND riskType = ?;', [collId, lib, g.riskType])
      }
    }
    // 对 custom: 创建默认分组，将所有custom prompt归入
    const customCount = await db.get<{ cnt: number }>('SELECT COUNT(1) as cnt FROM prompts WHERE library = \'custom\';')
    if (customCount && customCount.cnt > 0) {
      const collId = crypto.randomUUID()
      const now = Date.now()
      await db.run(
        'INSERT INTO prompt_collections (id, name, library, description, prompt_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [collId, '默认自定义测试集', 'custom', null, customCount.cnt, now, now],
      )
      await db.run('UPDATE prompts SET collection_id = ? WHERE library = \'custom\' AND collection_id IS NULL;', [collId])
    }
  }

  // ===== 时间戳迁移：秒级 → 毫秒级 =====
  const auditCount = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM code_audits;')
  if (auditCount && auditCount.cnt > 0) {
    const sample = await db.get<{ created_at: number }>('SELECT created_at FROM code_audits LIMIT 1;')
    if (sample && sample.created_at < 1e12) {
      // 秒级时间戳（< 2286-11-20），需要迁移
      await db.exec('UPDATE code_audits SET created_at = created_at * 1000, updated_at = updated_at * 1000 WHERE created_at < 1e12;')
      await db.exec('UPDATE code_slices SET created_at = created_at * 1000 WHERE created_at < 1e12;')
      await db.exec('UPDATE code_audit_items SET created_at = created_at * 1000 WHERE created_at < 1e12;')
      await db.exec('UPDATE code_audit_logs SET created_at = created_at * 1000 WHERE created_at < 1e12;')
    }
  }

  // ===== CodeAudit 增强字段迁移 =====
  const auditItemsColumns = await db.all<Array<{ name: string }>>(
    'PRAGMA table_info(code_audit_items);'
  )

  if (!auditItemsColumns.some(col => col.name === 'poc_description')) {
    await db.exec('ALTER TABLE code_audit_items ADD COLUMN poc_description TEXT;')
  }
  if (!auditItemsColumns.some(col => col.name === 'poc_code')) {
    await db.exec('ALTER TABLE code_audit_items ADD COLUMN poc_code TEXT;')
  }
  if (!auditItemsColumns.some(col => col.name === 'reproduce_steps')) {
    await db.exec('ALTER TABLE code_audit_items ADD COLUMN reproduce_steps TEXT;')
  }
  if (!auditItemsColumns.some(col => col.name === 'fix_code')) {
    await db.exec('ALTER TABLE code_audit_items ADD COLUMN fix_code TEXT;')
  }

  // code_audits 增加 original_filename 列
  const auditColumns = await db.all<Array<{ name: string }>>(
    'PRAGMA table_info(code_audits);'
  )
  if (!auditColumns.some(col => col.name === 'original_filename')) {
    await db.exec('ALTER TABLE code_audits ADD COLUMN original_filename TEXT;')
  }

  // ===== SkillsAudit 模块表 =====
  await db.exec(`
    CREATE TABLE IF NOT EXISTS skills_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending','unpacking','analyzing','scanning','ai_auditing','aggregating','reporting','completed','failed')) DEFAULT 'pending',
      progress_stage TEXT DEFAULT 'pending',
      progress_percent INTEGER DEFAULT 0,
      total_skills INTEGER DEFAULT 0,
      total_files INTEGER DEFAULT 0,
      findings_count INTEGER DEFAULT 0,
      risk_score INTEGER DEFAULT 0,
      risk_level TEXT CHECK(risk_level IN ('low','medium','high','critical')),
      skill_manifest TEXT,
      error_message TEXT,
      model_config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_skills_audits_status ON skills_audits(status);
    CREATE INDEX IF NOT EXISTS idx_skills_audits_created_at ON skills_audits(created_at);

    CREATE TABLE IF NOT EXISTS skills_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES skills_audits(id) ON DELETE CASCADE,
      risk_category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT CHECK(severity IN ('critical','high','medium','low','info')) NOT NULL,
      confidence TEXT CHECK(confidence IN ('high','medium','low')) NOT NULL,
      file_path TEXT NOT NULL,
      line_start INTEGER,
      line_end INTEGER,
      vulnerable_code TEXT,
      evidence TEXT,
      remediation TEXT,
      cwe_id TEXT,
      cwe_name TEXT,
      status TEXT CHECK(status IN ('confirmed','false_positive','pending')) DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_skills_audit_items_audit_id ON skills_audit_items(audit_id);
    CREATE INDEX IF NOT EXISTS idx_skills_audit_items_severity ON skills_audit_items(severity);
    CREATE INDEX IF NOT EXISTS idx_skills_audit_items_risk_category ON skills_audit_items(risk_category);

    CREATE TABLE IF NOT EXISTS skills_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES skills_audits(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      level TEXT CHECK(level IN ('info','warn','error')) DEFAULT 'info',
      message TEXT,
      detail TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_skills_audit_logs_audit_id ON skills_audit_logs(audit_id);

    CREATE TABLE IF NOT EXISTS skills_audit_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL UNIQUE REFERENCES skills_audits(id) ON DELETE CASCADE,
      generated_at INTEGER NOT NULL,
      project_info TEXT NOT NULL,
      findings TEXT NOT NULL,
      score_total INTEGER NOT NULL,
      score_risk_level TEXT NOT NULL,
      markdown TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_skills_audit_reports_audit_id ON skills_audit_reports(audit_id);
  `)

  // ===== 模型设置迁移：evaluator → modelEval + mcpEval =====
  const evaluatorRow = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'evaluator';")
  if (evaluatorRow) {
    try {
      const evVal = JSON.parse(evaluatorRow.value)
      // 迁移到 modelEval（完整复制 evaluator 配置）
      const modelEvalRow = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'modelEval';")
      if (!modelEvalRow) {
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [
          'modelEval',
          JSON.stringify(evVal),
        ])
      }
      // 迁移到 mcpEval（复制连接配置，使用 MCP 默认提示词）
      const mcpEvalRow = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mcpEval';")
      if (!mcpEvalRow) {
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [
          'mcpEval',
          JSON.stringify({
            provider: evVal.provider || 'openai',
            baseUrl: evVal.baseUrl || '',
            apiKey: evVal.apiKey || '',
            model: evVal.model || '',
            systemPrompt: '你是 MCP Server 的资深安全审计专家。以自动化扫描 Agent 的方式工作：1) 信息收集 2) 代码安全审计 3) 漏洞整理 4) 可利用性复核 5) 输出报告。结论必须基于证据，避免臆测。',
          }),
        ])
      }
    } catch { /* ignore parse errors */ }
  }

  // ===== evaluations 表添加 targetTimeoutMs 列 =====
  const evalTimeoutColumns = await db.all<Array<{ name: string }>>("PRAGMA table_info(evaluations);")
  if (!evalTimeoutColumns.some(col => col.name === 'targetTimeoutMs')) {
    await db.exec('ALTER TABLE evaluations ADD COLUMN targetTimeoutMs INTEGER;')
  }

  // 初始化 Skills Audit 相关 CWE 种子数据（扩展 vuln_kb 覆盖20种风险类型）
  const skillsKbCount = await db.get<{ cnt: number }>("SELECT COUNT(*) as cnt FROM vuln_kb WHERE cwe_id IN ('CWE-88','CWE-1423','CWE-1357','CWE-1422','CWE-1424','CWE-1007','CWE-1421','CWE-345','CWE-451');")
  if (skillsKbCount && skillsKbCount.cnt < 9) {
    const skillsSeedData: [string, string, string, string, string, string][] = [
      ['CWE-88', 'Argument Injection', '参数注入导致反向Shell', 'bash.*-i.*>&|nc.*-e|/dev/tcp|socket\\\\.connect', 'critical', '["reverse_shell","dangerous_command","injection"]'],
      ['CWE-1423', 'Prompt Injection', 'AI提示词注入攻击', 'system.*prompt|ignore.*previous|inject.*instruction', 'critical', '["prompt_injection","ai_specific"]'],
      ['CWE-1357', 'Reliance on Uncontrolled Component', '依赖不受控的第三方组件', 'npm.*install.*--force|pip install.*--no-verify|eval\\\\(atob', 'high', '["supply_chain_attack","dependency"]'],
      ['CWE-1422', 'AI Model Manipulation', 'AI模型操纵/触发器劫持', 'trigger.*override|skill.*hijack|prompt.*leak', 'high', '["trigger_hijacking","ai_specific"]'],
      ['CWE-1424', 'AI Behavior Desynchronization', 'AI行为与描述不符', 'skill_md.*mismatch|description.*differ|behavior.*deviate', 'high', '["skill_md_mismatch","ai_specific"]'],
      ['CWE-1007', 'Insufficient Operational Debug', '代码混淆阻碍安全审计', 'eval\\\\(atob|String\\\\.fromCharCode|_0x[0-9a-f]|obfuscate', 'medium', '["obfuscation","anti-analysis"]'],
      ['CWE-1421', 'AI Social Engineering', 'AI社会工程攻击', '验证.*身份|输入.*密码|账户.*锁定|紧急.*操作', 'high', '["social_engineering","ai_specific","phishing"]'],
      ['CWE-345', 'Insufficient Verification of Authenticity', '字节码/编译产物完整性未验证', '\\\\.pyc|\\\\.class|\\\\.so|\\\\.dll.*verify', 'high', '["bytecode_tampering","integrity"]'],
      ['CWE-451', 'User Interface Misrepresentation', 'Unicode隐写攻击', '\\\\u200[bcd]|\\\\u200[f]|\\\\u202[ae]|\\\\u00ad|zero.?width', 'medium', '["unicode_steganography","encoding"]'],
    ]
    const stmt = await db.prepare('INSERT OR IGNORE INTO vuln_kb (cwe_id, cwe_name, description, risk_pattern, severity, tags) VALUES (?, ?, ?, ?, ?, ?)')
    for (const row of skillsSeedData) {
      await stmt.run(row[0], row[1], row[2], row[3], row[4], row[5])
    }
    await stmt.finalize()
  }

  // ===== Token Usages 小票表 =====
  await db.exec(`
    CREATE TABLE IF NOT EXISTS token_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      session_id TEXT,
      module TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      cost_amount DECIMAL(10,6),
      cost_currency TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_token_usages_task_id ON token_usages(task_id);
    CREATE INDEX IF NOT EXISTS idx_token_usages_session_id ON token_usages(session_id);
    CREATE INDEX IF NOT EXISTS idx_token_usages_timestamp ON token_usages(timestamp DESC);
  `)
}

// ===== Token Usage 数据库操作 =====

export interface TokenUsageRow {
  id: number
  task_id: string
  session_id: string | null
  module: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number | null
  reasoning_tokens: number | null
  total_tokens: number
  model: string
  provider: string
  cost_amount: number | null
  cost_currency: string | null
  timestamp: string
}

/** 写入 token 使用记录（同步，使用 better-sqlite3 风格的 db.run） */
export function insertTokenUsage(usage: {
  taskId: string
  sessionId?: string
  module: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  model: string
  provider: string
  costAmount?: number | null
  costCurrency?: string
}): void {
  // 由于 db 是异步打开的，我们需要在运行时获取 db 实例
  // 使用全局 dbPromise 确保 db 已初始化
  insertTokenUsageAsync(usage).catch(e => {
    console.error('insertTokenUsage failed:', e)
  })
}

async function insertTokenUsageAsync(usage: {
  taskId: string
  sessionId?: string
  module: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  model: string
  provider: string
  costAmount?: number | null
  costCurrency?: string
}): Promise<void> {
  const db = await openDb()
  await db.run(
    `INSERT INTO token_usages (task_id, session_id, module, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, total_tokens, model, provider, cost_amount, cost_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      usage.taskId,
      usage.sessionId ?? null,
      usage.module,
      usage.inputTokens,
      usage.outputTokens,
      usage.cachedInputTokens ?? null,
      usage.reasoningTokens ?? null,
      usage.totalTokens,
      usage.model,
      usage.provider,
      usage.costAmount ?? null,
      usage.costCurrency ?? null,
    ],
  )
}

/** 按 taskId 查询 token 使用记录 */
export async function getTokenUsagesByTaskId(taskId: string): Promise<TokenUsageRow[]> {
  const db = await openDb()
  return db.all<TokenUsageRow[]>(
    'SELECT * FROM token_usages WHERE task_id = ? ORDER BY timestamp ASC;',
    [taskId],
  )
}

/** 按 sessionId 查询累计 token 使用 */
export async function getTokenUsagesBySessionId(sessionId: string): Promise<TokenUsageRow[]> {
  const db = await openDb()
  return db.all<TokenUsageRow[]>(
    'SELECT * FROM token_usages WHERE session_id = ? ORDER BY timestamp ASC;',
    [sessionId],
  )
}