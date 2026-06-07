import { randomUUID } from 'crypto'
import type { Db } from './db.js'

export type McpScanStatus = 'pending' | 'running' | 'completed' | 'failed'

export class McpScanStore {
  constructor(private db: Db) {}

  async createScan(filename: string, name?: string, options?: { model?: string; baseUrl?: string }): Promise<string> {
    const id = randomUUID()
    const now = Date.now()
    await this.db.run(
      `INSERT INTO mcp_scans (id, name, created_at, updated_at, original_filename, status, progress_stage, progress_percent, error, options, logs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name || null, now, now, filename, 'pending', 'pending', 0, null, JSON.stringify(options || {}), '[]'
    )
    return id
  }

  async getScan(id: string) {
    return await this.db.get('SELECT * FROM mcp_scans WHERE id = ?', id)
  }

  async listScans() {
    return await this.db.all(`
      SELECT s.*, r.score_total, r.score_risk_level
      FROM mcp_scans s
      LEFT JOIN mcp_reports r ON s.id = r.scan_id
      ORDER BY s.created_at DESC
    `)
  }

  async updateStatus(id: string, status: McpScanStatus, stage: string, percent: number) {
    await this.db.run(
      'UPDATE mcp_scans SET status = ?, progress_stage = ?, progress_percent = ?, updated_at = ? WHERE id = ?',
      status, stage, percent, Date.now(), id
    )
  }

  async setError(id: string, error: string) {
    await this.db.run('UPDATE mcp_scans SET error = ?, updated_at = ? WHERE id = ?', error, Date.now(), id)
  }

  async log(id: string, level: 'info' | 'warn' | 'error', message: string) {
    const scan = await this.getScan(id) as { logs?: string } | undefined
    if (!scan) return
    const logs: Array<{ timestamp: number; level: string; message: string }> = JSON.parse(scan.logs || '[]')
    logs.push({ timestamp: Date.now(), level, message })
    if (logs.length > 500) logs.shift()
    await this.db.run('UPDATE mcp_scans SET logs = ?, updated_at = ? WHERE id = ?', JSON.stringify(logs), Date.now(), id)
  }

  async deleteScan(id: string) {
    await this.db.run('DELETE FROM mcp_scans WHERE id = ?', id)
    await this.db.run('DELETE FROM mcp_reports WHERE scan_id = ?', id)
  }

  async saveReport(scanId: string, report: { project: unknown; findings: unknown; score: { total: number; riskLevel: string }; markdown: string }) {
    await this.db.run(
      `INSERT OR REPLACE INTO mcp_reports (scan_id, generated_at, project_info, findings, score_total, score_risk_level, markdown)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      scanId, Date.now(), JSON.stringify(report.project), JSON.stringify(report.findings),
      report.score.total, report.score.riskLevel, report.markdown
    )
  }

  async getReport(scanId: string) {
    const row = await this.db.get('SELECT * FROM mcp_reports WHERE scan_id = ?', scanId) as Record<string, unknown> | undefined
    if (!row) return null
    
    // 处理可能的JSON解析错误
    let project = {}
    let findings = []
    
    try {
      project = row.project_info ? JSON.parse(String(row.project_info)) : {}
    } catch (e) {
      console.warn(`Failed to parse project_info for scan ${scanId}:`, e)
    }
    
    try {
      findings = row.findings ? JSON.parse(String(row.findings)) : []
    } catch (e) {
      console.warn(`Failed to parse findings for scan ${scanId}:`, e)
    }
    
    return {
      scanId: row.scan_id,
      generatedAt: row.generated_at,
      project,
      findings,
      score: { total: row.score_total || 0, riskLevel: row.score_risk_level || 'low' },
      markdown: row.markdown || '',
    }
  }
}
