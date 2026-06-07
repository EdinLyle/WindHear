export class SkillsAuditStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ===== 审计任务 CRUD =====
    async createAudit(input) {
        const now = Date.now();
        const result = await this.db.run(`INSERT INTO skills_audits (name, original_filename, status, progress_stage, progress_percent, model_config, created_at, updated_at)
       VALUES (?, ?, 'pending', 'pending', 0, ?, ?, ?)`, input.name, input.originalFilename, input.modelConfig ? JSON.stringify(input.modelConfig) : null, now, now);
        return result.lastID;
    }
    async getAudit(id) {
        return await this.db.get('SELECT * FROM skills_audits WHERE id = ?', id);
    }
    async listAudits(limit = 20, offset = 0, options) {
        const where = [];
        const params = [];
        if (options?.query) {
            where.push('name LIKE ?');
            params.push(`%${options.query}%`);
        }
        if (options?.riskLevel) {
            where.push('risk_level = ?');
            params.push(options.riskLevel);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        params.push(limit, offset);
        return await this.db.all(`SELECT * FROM skills_audits ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params);
    }
    async countAudits(options) {
        const where = [];
        const params = [];
        if (options?.query) {
            where.push('name LIKE ?');
            params.push(`%${options.query}%`);
        }
        if (options?.riskLevel) {
            where.push('risk_level = ?');
            params.push(options.riskLevel);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const row = await this.db.get(`SELECT COUNT(*) as cnt FROM skills_audits ${whereClause};`, ...params);
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
        await this.db.run(`UPDATE skills_audits SET ${sets.join(', ')} WHERE id = ?`, ...values);
    }
    async updateProgress(id, stage, percent) {
        await this.db.run('UPDATE skills_audits SET progress_stage = ?, progress_percent = ?, updated_at = ? WHERE id = ?', stage, percent, Date.now(), id);
    }
    async setAuditError(id, errorMessage) {
        await this.db.run("UPDATE skills_audits SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?", errorMessage, Date.now(), id);
    }
    async completeAudit(id, riskScore, riskLevel, findingsCount) {
        await this.db.run(`UPDATE skills_audits SET status = 'completed', risk_score = ?, risk_level = ?, findings_count = ?, completed_at = ?, updated_at = ? WHERE id = ?`, riskScore, riskLevel, findingsCount, Date.now(), Date.now(), id);
    }
    async deleteAudit(id) {
        await this.db.run('DELETE FROM skills_audit_items WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM skills_audit_logs WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM skills_audit_reports WHERE audit_id = ?', id);
        await this.db.run('DELETE FROM skills_audits WHERE id = ?', id);
    }
    // ===== 审计发现项 =====
    async createItem(input) {
        const result = await this.db.run(`INSERT INTO skills_audit_items (audit_id, risk_category, title, description, severity, confidence, file_path, line_start, line_end, vulnerable_code, evidence, remediation, cwe_id, cwe_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.auditId, input.riskCategory, input.title, input.description ?? null, input.severity, input.confidence, input.filePath, input.lineStart ?? null, input.lineEnd ?? null, input.vulnerableCode ?? null, input.evidence ?? null, input.remediation ?? null, input.cweId ?? null, input.cweName ?? null, input.status ?? 'pending', Date.now());
        return result.lastID;
    }
    async getItemsByAudit(auditId, options) {
        const where = ['audit_id = ?'];
        const params = [auditId];
        if (options?.riskCategory) {
            where.push('risk_category = ?');
            params.push(options.riskCategory);
        }
        if (options?.severity) {
            where.push('severity = ?');
            params.push(options.severity);
        }
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        params.push(limit, offset);
        return await this.db.all(`SELECT * FROM skills_audit_items WHERE ${where.join(' AND ')} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
       id ASC LIMIT ? OFFSET ?`, ...params);
    }
    async countItems(auditId, options) {
        const where = ['audit_id = ?'];
        const params = [auditId];
        if (options?.riskCategory) {
            where.push('risk_category = ?');
            params.push(options.riskCategory);
        }
        if (options?.severity) {
            where.push('severity = ?');
            params.push(options.severity);
        }
        const row = await this.db.get(`SELECT COUNT(*) as cnt FROM skills_audit_items WHERE ${where.join(' AND ')}`, ...params);
        return row?.cnt ?? 0;
    }
    async updateItemStatus(id, status) {
        await this.db.run('UPDATE skills_audit_items SET status = ? WHERE id = ?', status, id);
    }
    // ===== 审计日志 =====
    async addLog(auditId, stage, level, message, detail) {
        await this.db.run('INSERT INTO skills_audit_logs (audit_id, stage, level, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', auditId, stage, level, message, detail ?? null, Date.now());
    }
    async getLogs(auditId) {
        return await this.db.all('SELECT * FROM skills_audit_logs WHERE audit_id = ? ORDER BY created_at ASC', auditId);
    }
    // ===== 审计报告 =====
    async createReport(input) {
        await this.db.run(`INSERT OR REPLACE INTO skills_audit_reports (audit_id, generated_at, project_info, findings, score_total, score_risk_level, markdown)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, input.auditId, Date.now(), input.projectInfo, input.findings, input.scoreTotal, input.scoreRiskLevel, input.markdown);
    }
    async getReport(auditId) {
        return await this.db.get('SELECT * FROM skills_audit_reports WHERE audit_id = ?', auditId);
    }
    // ===== 评分计算 =====
    calcRiskScore(findings) {
        const severityWeights = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
        let total = 0;
        for (const finding of findings) {
            if (finding.status === 'false_positive')
                continue;
            total += severityWeights[finding.severity] || 0;
        }
        total = Math.min(total, 100);
        const riskLevel = total >= 75 ? 'critical'
            : total >= 50 ? 'high'
                : total >= 25 ? 'medium'
                    : 'low';
        return { total, riskLevel };
    }
}
