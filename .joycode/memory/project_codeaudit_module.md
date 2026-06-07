---
name: CodeAudit Module Implementation
description: CodeAudit模块全栈开发完成 + Anthropic Provider支持
type: project
---

CodeAudit (AI代码安全审计) 模块全栈开发完成，含后端引擎+前端页面。

2026-06-03: 系统新增Anthropic Provider支持，Provider类型从 'ollama'|'openai' 扩展为 'ollama'|'openai'|'anthropic'。
- 后端: modelClients.ts新增anthropicChat函数（x-api-key头部、system顶层字段、content[0].text响应解析）
- 前端: 所有模型配置页面Provider下拉框增加anthropic选项，API Key输入框条件渲染扩展
- 修改文件: modelClients.ts, runner.ts, codeAudit/pipeline.ts, codeAudit/types.ts, mcpScan/types.ts, mcpScan/util/llmAdapter.ts, index.ts, src/types.ts, ModelSettings.tsx, NewEvaluation.tsx, NewMcpScan.tsx, NewCodeAudit.tsx, QuickStart.tsx