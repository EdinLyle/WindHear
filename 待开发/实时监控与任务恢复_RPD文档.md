---
# 实时审计监控增强 & 任务恢复功能 RPD文档

## 一、需求概述

### 需求1：实时审计监控运行中任务实时显示发现的问题
**现状**：运行中的审计任务，findings只在pipeline完成后的aggregating阶段才写入DB，导致实时监控页面在任务运行期间看不到任何发现项，必须等任务结束后点击才能查看。
**目标**：pipeline各阶段每发现一个finding就立即写入DB，SSE推送时实时展示。

### 需求2：同类任务展开互不阻塞
**现状**：当正在评估某个代码审计项目时，实时监控中其他代码审计项目点击展开无反应；但其他类型（如MCP评估）可以正常展开。
**根因**：不同模块的taskId来自不同表的自增ID，可能重复（如code-audit id=5 和 skills-audit id=5）。前端使用 `key={task.taskId}` 只取数字ID作为React key，导致不同模块同ID任务的组件实例冲突，React无法正确区分和复用组件，造成展开状态混乱。
**目标**：每个任务的唯一标识包含模块前缀，确保React key全局唯一。

### 需求3：任务暂停/恢复/断点续传
**现状**：任务启动后无法中途停止；异常中断后无法恢复到断点继续执行。
**目标**：
- 支持暂停运行中的任务（优雅停止，保存已完成进度）
- 支持恢复已暂停的任务（从断点继续执行）
- 异常中断的任务可检测并支持手动恢复
- 前端实时监控页面提供暂停/恢复操作按钮

---

## 二、技术方案

### 需求1：运行中任务实时显示findings

#### 后端改造

**1.1 代码审计 pipeline（`server/codeAudit/pipeline.ts`）**

当前流程：parsing → slicing → auditing(Parser→Hunter→Validator) → aggregating(批量写入items) → completed

改造方案：在Hunter/Validator每个Agent完成后，立即将已验证的findings写入DB，而不是等到aggregating阶段。

```
改造前：
  auditing阶段: Parser → Hunter → Validator（全在内存中处理）
  aggregating阶段: 批量写入所有items到DB

改造后：
  auditing阶段: Parser → Hunter → 每发现一个rawFinding立即createItem → Validator → 每验证一个立即updateItem → aggregating阶段: 仅做去重和统计更新
```

具体修改：
- Hunter完成后，遍历 `ctx.rawFindings`，立即调用 `store.createItem()` 写入DB
- Validator完成后，遍历 `ctx.validatedFindings`，调用 `store.updateItemStatus()` 更新状态
- aggregating阶段改为：统计findings_count，更新audit状态

**1.2 Skills审计 pipeline（`server/skillsAudit/pipeline.ts`）**

当前流程：unpacking → analyzing → scanning → ai_auditing(逐Agent执行) → aggregating(批量写入items) → reporting → completed

改造方案：每个Agent完成后，立即将该Agent的findings写入DB。

```
改造后：
  ai_auditing阶段: Agent1执行 → 立即createItem → Agent2执行 → 立即createItem → ...
  aggregating阶段: 仅做去重、统计、风险评分
```

**1.3 MCP扫描 pipeline（`server/mcpScanner.ts`）**

当前流程：unpacking → project_analysis → ai_audit → exploitability_review → reporting(写入report) → completed

改造方案：MCP扫描的findings是整体存入report对象的，需要改为也实时写入中间结果。

- 在 `runAiAudit` 完成后，将初始findings存入一个临时表或report的中间状态
- 在 `reviewExploitability` 每处理完一个finding后更新

**1.4 审计监控聚合（`server/auditMonitor.ts`）**

当前逻辑已正确：每个任务的 `getItemsByAudit` 会查询最新的items。改造后，由于items在运行中就被写入DB，`aggregateData()` 在心跳推送时就能获取到运行中任务的findings。

无需额外修改，核心改动在pipeline中提前写入items。

---

### 需求2：同类任务展开互不阻塞

#### 前端改造

**2.1 TaskCard组件key修复（`src/pages/AuditMonitor/AuditMonitor.tsx`）**

```tsx
// 改造前
<TaskCard key={task.taskId} task={task} severityFilter={severityFilter} />

// 改造后：key包含moduleId前缀确保全局唯一
<TaskCard key={`${task.moduleId}-${task.taskId}`} task={task} severityFilter={severityFilter} />
```

**2.2 后端taskId增加模块前缀（`server/auditMonitor.ts`）**

在后端聚合数据时，将taskId改为包含模块前缀的复合ID：

```typescript
// 改造前
taskId: audit.id as number,

// 改造后
taskId: `code-audit-${audit.id}`,
```

前端SSE hook中保持 `String(t.taskId)` 即可，无需额外映射。

---

### 需求3：任务暂停/恢复/断点续传

#### 3.1 数据库层改造

**新增状态**：

| 模块 | 新增状态 | 状态列表 |
|------|---------|---------|
| code-audit | `paused` | pending/parsing/slicing/auditing/aggregating/paused/completed/failed |
| skills-audit | `paused` | pending/unpacking/analyzing/scanning/ai_auditing/aggregating/reporting/paused/completed/failed |
| mcp-scan | `paused` | pending/running/paused/completed/failed |

**新增字段**（所有审计表）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `paused_at` | INTEGER | 暂停时间戳 |
| `resume_from` | TEXT | 恢复时从哪个阶段/步骤继续 |

**新增表 `task_checkpoints`**：

```sql
CREATE TABLE IF NOT EXISTS task_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL,     -- 'code-audit' / 'skills-audit' / 'mcp-scan' / 'evaluation'
  task_id TEXT NOT NULL,       -- 任务ID
  stage TEXT NOT NULL,         -- 当前阶段
  step_index INTEGER DEFAULT 0, -- 当前步骤索引（如第几个Agent/第几个切片）
  checkpoint_data TEXT,        -- JSON格式断点数据（如已处理的切片ID列表）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(task_type, task_id)
);
```

#### 3.2 Pipeline改造 - 支持暂停检查

**代码审计 pipeline（`server/codeAudit/pipeline.ts`）**：

```typescript
// 在每个阶段转换前检查是否暂停
async function checkPaused(store: CodeAuditStore, auditId: number): Promise<boolean> {
  const audit = await store.getAudit(auditId)
  if (audit?.status === 'paused') {
    // 保存断点
    await saveCheckpoint('code-audit', String(auditId), audit.status, 0, {})
    return true
  }
  return false
}

// pipeline中每个阶段前插入检查
export async function runCodeAuditPipeline(input: ...) {
  // ... parsing阶段
  if (await checkPaused(store, auditId)) return

  // ... slicing阶段
  if (await checkPaused(store, auditId)) return

  // auditing阶段 - 逐切片处理时检查
  for (let i = 0; i < slices.length; i++) {
    if (await checkPaused(store, auditId)) return
    // 处理切片...
    // 保存checkpoint
    await saveCheckpoint('code-audit', String(auditId), 'auditing', i, { processedSlices: i + 1 })
  }
  // ...
}
```

**Skills审计 pipeline（`server/skillsAudit/pipeline.ts`）**：

```typescript
// 类似改造 - 每个Agent执行前检查暂停
for (let i = 0; i < ALL_AGENTS.length; i++) {
  if (await checkPaused(store, auditId)) return
  const agent = ALL_AGENTS[i]
  // 执行Agent...
  // 保存checkpoint
  await saveCheckpoint('code-audit', String(auditId), 'ai_auditing', i, { completedAgents: i + 1 })
}
```

#### 3.3 恢复Pipeline

新增恢复函数，从checkpoint恢复执行：

```typescript
export async function resumeCodeAuditPipeline(input: { auditId: number; store: CodeAuditStore; ... }) {
  const checkpoint = await getCheckpoint('code-audit', String(input.auditId))
  if (!checkpoint) {
    // 无断点，从头开始
    return runCodeAuditPipeline(input)
  }

  // 根据checkpoint.stage和checkpoint.step_index恢复
  const { stage, step_index, checkpoint_data } = checkpoint
  // ... 跳过已完成的阶段，从断点继续
}
```

#### 3.4 API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/code-audit/:id/pause` | POST | 暂停代码审计任务 |
| `/api/code-audit/:id/resume` | POST | 恢复代码审计任务 |
| `/api/skills-audit/:id/pause` | POST | 暂停Skills审计任务 |
| `/api/skills-audit/:id/resume` | POST | 恢复Skills审计任务 |
| `/api/mcp-scan/:id/pause` | POST | 暂停MCP扫描任务 |
| `/api/mcp-scan/:id/resume` | POST | 恢复MCP扫描任务 |

#### 3.5 前端改造

**TaskCard组件**：增加暂停/恢复按钮

```tsx
// 运行中任务显示暂停按钮
{task.status === 'running' && (
  <button onClick={() => pauseTask(task.moduleId, task.taskId)}>暂停</button>
)}

// 暂停任务显示恢复按钮
{task.status === 'paused' && (
  <button onClick={() => resumeTask(task.moduleId, task.taskId)}>恢复</button>
)}
```

**API函数（`src/api.ts`）**：新增暂停/恢复API调用

**SSE类型**：MonitorTask.status 增加 `'paused'` 状态

---

## 三、实施计划

### 阶段1：需求1 - 实时显示findings（优先级最高）
1. 改造代码审计pipeline - Hunter/Validator后立即写入items
2. 改造Skills审计pipeline - 每个Agent后立即写入items
3. 改造MCP扫描pipeline - AI审计后立即写入中间结果
4. 验证：运行中任务的实时监控页面能看到实时findings

### 阶段2：需求2 - 修复同类任务展开bug（快速修复）
1. 后端auditMonitor.ts - taskId添加模块前缀
2. 前端AuditMonitor.tsx - TaskCard key使用复合key
3. 验证：同类型多个任务可独立展开/收起

### 阶段3：需求3 - 任务暂停/恢复/断点续传（最复杂）
1. DB迁移 - 新增paused状态、paused_at字段、task_checkpoints表
2. Store层 - 新增暂停/恢复方法
3. Pipeline改造 - 添加暂停检查点和checkpoint保存
4. 恢复Pipeline - 实现从checkpoint恢复执行
5. API端点 - 新增暂停/恢复路由
6. 前端改造 - TaskCard增加暂停/恢复按钮
7. 验证：暂停→恢复任务可继续执行；异常中断后可恢复

---

## 四、影响范围

| 文件 | 改动类型 | 需求 |
|------|---------|------|
| `server/codeAudit/pipeline.ts` | 修改 | 需求1+3 |
| `server/skillsAudit/pipeline.ts` | 修改 | 需求1+3 |
| `server/mcpScanner.ts` | 修改 | 需求1+3 |
| `server/auditMonitor.ts` | 修改 | 需求2 |
| `server/codeAuditStore.ts` | 修改 | 需求3 |
| `server/skillsAuditStore.ts` | 修改 | 需求3 |
| `server/mcpScanStore.ts` | 修改 | 需求3 |
| `server/db.ts` | 修改 | 需求3 |
| `server/index.ts` | 修改 | 需求3 |
| `src/pages/AuditMonitor/AuditMonitor.tsx` | 修改 | 需求2 |
| `src/pages/AuditMonitor/components/TaskCard.tsx` | 修改 | 需求3 |
| `src/pages/AuditMonitor/types.ts` | 修改 | 需求2+3 |
| `src/pages/AuditMonitor/hooks/useAuditMonitorSSE.ts` | 修改 | 需求2+3 |
| `src/api.ts` | 修改 | 需求3 |