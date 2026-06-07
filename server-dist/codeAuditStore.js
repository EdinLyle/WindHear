export class CodeAuditStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ===== 审计任务 CRUD =====
    async createAudit(input) {
        const result = await this.db.run(`INSERT INTO code_audits (name, source_type, source_path, source_url, status, language, model_config, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`, input.name, input.sourceType, input.sourcePath, input.sourceUrl ?? null, input.language ?? null, input.modelConfig ? JSON.stringify(input.modelConfig) : null, Date.now(), Date.now());
        return result.lastID;
    }
    async getAudit(id) {
        return await this.db.get('SELECT * FROM code_audits WHERE id = ?', id);
    }
    async listAudits(limit = 20, offset = 0, options) {
        const where = [];
        const params = [];
        if (options?.query) {
            where.push('name LIKE ?');
            params.push(`%${options.query}%`);
        }
        if (options?.language) {
            where.push('language = ?');
            params.push(options.language);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        params.push(limit, offset);
        return await this.db.all(`SELECT * FROM code_audits ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params);
    }
    async countAudits(options) {
        const where = [];
        const params = [];
        if (options?.query) {
            where.push('name LIKE ?');
            params.push(`%${options.query}%`);
        }
        if (options?.language) {
            where.push('language = ?');
            params.push(options.language);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const row = await this.db.get(`SELECT COUNT(*) as cnt FROM code_audits ${whereClause};`, ...params);
        return row?.cnt ?? 0;
    }
    async updateAuditStatus(id, status, extra) {
        const sets = ['status = ?', 'updated_at = ?'];
        const values = [status, Date.now()];
        if (extra) {
            for (const [key, val] of Object.entries(extra)) {
                sets.push(`${key} = ?`);
                values.push(val);
            }
        }
        values.push(id);
        await this.db.run(`UPDATE code_audits SET ${sets.join(', ')} WHERE id = ?`, ...values);
    }
    async setAuditError(id, errorMessage) {
        await this.db.run("UPDATE code_audits SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?", errorMessage, Date.now(), id);
    }
    async deleteAudit(id) {
        await this.db.run('DELETE FROM code_audit_items WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM code_audit_logs WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM code_slices WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM code_audits WHERE id = ?', id);
    }
    // ===== 代码切片 =====
    async createSlice(input) {
        const result = await this.db.run(`INSERT INTO code_slices (audit_id, file_path, language, slice_type, content, context_summary, line_start, line_end, is_sensitive, sensitive_tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.auditId, input.filePath, input.language, input.sliceType, input.content, input.contextSummary ?? null, input.lineStart, input.lineEnd, input.isSensitive ? 1 : 0, input.sensitiveTags ? JSON.stringify(input.sensitiveTags) : null, Date.now());
        return result.lastID;
    }
    async getSlicesByAudit(auditId) {
        return await this.db.all('SELECT * FROM code_slices WHERE audit_id = ? ORDER BY file_path, line_start', auditId);
    }
    async getSlicesByFile(auditId, filePath) {
        return await this.db.all('SELECT * FROM code_slices WHERE audit_id = ? AND file_path = ? ORDER BY line_start', auditId, filePath);
    }
    async updateSliceAuditResult(id, status, result) {
        await this.db.run('UPDATE code_slices SET audit_status = ?, audit_result = ? WHERE id = ?', status, result, id);
    }
    async updateSliceSensitive(auditId, filePath, lineStart, sensitiveTags) {
        await this.db.run('UPDATE code_slices SET is_sensitive = 1, sensitive_tags = ? WHERE audit_id = ? AND file_path = ? AND line_start = ?', sensitiveTags, auditId, filePath, lineStart);
    }
    async countSensitiveSlices(auditId) {
        const row = await this.db.get('SELECT COUNT(*) as cnt FROM code_slices WHERE audit_id = ? AND is_sensitive = 1', auditId);
        return row?.cnt ?? 0;
    }
    // ===== 审计发现项 =====
    async createItem(input) {
        const result = await this.db.run(`INSERT INTO code_audit_items (audit_id, slice_id, cwe_id, cwe_name, title, description, file_path, line_start, line_end, vulnerable_code, fix_suggestion, severity, confidence, exploitability, data_flow, poc_description, poc_code, reproduce_steps, fix_code, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.auditId, input.sliceId ?? null, input.cweId ?? null, input.cweName ?? null, input.title, input.description ?? null, input.filePath, input.lineStart ?? null, input.lineEnd ?? null, input.vulnerableCode ?? null, input.fixSuggestion ?? null, input.severity, input.confidence, input.exploitability ?? 5, input.dataFlow ?? null, input.pocDescription ?? null, input.pocCode ?? null, input.reproduceSteps ?? null, input.fixCode ?? null, input.status ?? 'pending');
        return result.lastID;
    }
    async getItemsByAudit(auditId, options) {
        const where = ['audit_id = ?'];
        const params = [auditId];
        if (options?.severity) {
            where.push('severity = ?');
            params.push(options.severity);
        }
        if (options?.confidence) {
            where.push('confidence = ?');
            params.push(options.confidence);
        }
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        params.push(limit, offset);
        return await this.db.all(`SELECT * FROM code_audit_items WHERE ${where.join(' AND ')} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
       id ASC LIMIT ? OFFSET ?`, ...params);
    }
    async countItems(auditId, options) {
        const where = ['audit_id = ?'];
        const params = [auditId];
        if (options?.severity) {
            where.push('severity = ?');
            params.push(options.severity);
        }
        if (options?.confidence) {
            where.push('confidence = ?');
            params.push(options.confidence);
        }
        const row = await this.db.get(`SELECT COUNT(*) as cnt FROM code_audit_items WHERE ${where.join(' AND ')}`, ...params);
        return row?.cnt ?? 0;
    }
    async updateItemStatus(id, status) {
        await this.db.run('UPDATE code_audit_items SET status = ? WHERE id = ?', status, id);
    }
    // ===== 审计日志 =====
    async addLog(auditId, stage, message, detail) {
        await this.db.run('INSERT INTO code_audit_logs (audit_id, stage, message, detail, created_at) VALUES (?, ?, ?, ?, ?)', auditId, stage, message, detail ?? null, Date.now());
    }
    async getLogs(auditId) {
        return await this.db.all('SELECT * FROM code_audit_logs WHERE audit_id = ? ORDER BY created_at ASC', auditId);
    }
    // ===== 漏洞知识库 =====
    async listVulnKb() {
        return await this.db.all('SELECT * FROM vuln_kb ORDER BY cwe_id ASC');
    }
    async createVulnKb(input) {
        await this.db.run(`INSERT OR IGNORE INTO vuln_kb (cwe_id, cwe_name, description, risk_pattern, fix_pattern, severity, tags, examples)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, input.cweId, input.cweName, input.description ?? null, input.riskPattern ?? null, input.fixPattern ?? null, input.severity ?? null, input.tags ?? null, input.examples ?? null);
    }
    async deleteVulnKb(cweId) {
        await this.db.run('DELETE FROM vuln_kb WHERE cwe_id = ?', cweId);
    }
}
