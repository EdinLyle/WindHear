# PLAN-004: 多功能增强 - 数据面板/报告导出/QuickStart重构

## 任务概述
4个独立需求：(1)数据面板增加MCP/Skills图表 (2)代码安全审计HTML导出修复 (3)模型/MCP/Skills报告PDF/MD导出 (4)QuickStart重构

## TODO: 需求1 - 数据面板MCP/Skills图表增强
- [ ] 后端: `/api/overview` 新增 mcpSeverityDistribution + skillsSeverityDistribution + skillsRiskCategoryDistribution + skillsAuditTrend
- [ ] 后端: 查询 mcp_scan_items/skills_audit_items 表聚合严重度分布
- [ ] 前端: types.ts Overview 类型扩展
- [ ] 前端: Dashboard.tsx - MCP漏洞严重度使用水平条形图(BarChart horizontal)
- [ ] 前端: Dashboard.tsx - Skills严重度使用雷达图(RadarChart)
- [ ] 前端: Dashboard.tsx - Skills风险类别使用树图(Treemap)
- [ ] 前端: Dashboard.tsx - 趋势图添加Skills 安全审计线
- [ ] 前端: Dashboard.tsx - 最近评估任务增加Skills 安全审计类型

## TODO: 需求2 - 代码安全审计HTML导出修复
- [ ] 后端: index.ts generateHtmlReport - HTML报告改为 attachment 下载而非 inline 渲染
- [ ] 后端: 删除HTML报告中"下载HTML"按钮那一行 no-print div

## TODO: 需求3 - 模型/MCP/Skills报告导出增强
- [ ] 后端: 新建 server/mcpScan/pdfReport.ts - MCP评估PDF报告(参考codeAudit/pdfReport.ts)
- [ ] 后端: 新建 server/skillsAudit/pdfReport.ts - Skills 安全审计PDF报告
- [ ] 后端: index.ts MCP report路由 - 添加 format=pdf/html/md 支持
- [ ] 后端: index.ts Evaluation report路由 - 添加 PDF/MD 导出
- [ ] 后端: index.ts Skills report路由 - 添加 format=pdf 支持
- [ ] 前端: McpScanReport.tsx - 添加导出PDF/MD/HTML按钮
- [ ] 前端: EvaluationReport.tsx - 添加导出PDF/MD按钮
- [ ] 前端: SkillsAuditDetail.tsx - 添加导出PDF按钮
- [ ] 前端: api.ts - 扩展getMcpScanReport/getEvaluationReport支持format参数

## TODO: 需求4 - QuickStart页面重构
- [ ] 分析当前4大功能模块(LLM 模型评估/MCP扫描/代码安全审计/Skills 安全审计)
- [ ] 重构Hero区域 - 增加"Skills 安全审计"统计卡片
- [ ] 重构功能入口 - 4卡片布局增加Skills 安全审计入口
- [ ] 重构最近动态 - 增加Skills 安全审计类型支持
- [ ] 重构引导tour - 增加Skills 安全审计步骤

## 文档需求
- 后端新增API需内联注释
- PDF报告函数需JSDoc注释