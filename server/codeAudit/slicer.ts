import { promises as fs } from 'fs'
import path from 'path'
import type { CodeSlice, SliceType } from './types.js'

const MAX_SLICE_LINES = 80
const MIN_SLICE_LINES = 3

// 函数/方法匹配正则（多语言）
const FUNCTION_PATTERNS: Array<{ regex: RegExp; type: SliceType }> = [
  // JS/TS function declarations
  { regex: /^(export\s+)?(async\s+)?function\s+\w+/m, type: 'function' },
  // JS/TS arrow functions in variables
  { regex: /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/m, type: 'function' },
  // Python def
  { regex: /^(async\s+)?def\s+\w+/m, type: 'function' },
  // Java/C# method
  { regex: /^\s*(public|private|protected|static|\s)+[\w<>]+\s+\w+\s*\([^)]*\)\s*[{]/m, type: 'function' },
  // Go func
  { regex: /^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+/m, type: 'function' },
]

// 类匹配
const CLASS_PATTERNS: Array<{ regex: RegExp; type: SliceType }> = [
  { regex: /^(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+/m, type: 'class' },
  { regex: /^class\s+\w+/m, type: 'class' }, // Python
]

// 路由/API 端点匹配
const ROUTE_PATTERNS: Array<{ regex: RegExp; type: SliceType }> = [
  { regex: /^\s*(app|router)\.(get|post|put|delete|patch|all|use)\s*\(/m, type: 'route' },
  { regex: /^@\w+(Mapping|Route|Get|Post|Put|Delete|Patch)/m, type: 'route' },
  { regex: /^@(app|router)\.(get|post|put|delete|patch)/m, type: 'route' }, // Python Flask/FastAPI
]

export async function sliceProject(rootDir: string, projectFiles: Array<{ path: string; language: string }>): Promise<CodeSlice[]> {
  const allSlices: CodeSlice[] = []

  for (const file of projectFiles) {
    const content = await readSourceFile(rootDir, file.path)
    const slices = sliceFile(content, file.path, file.language)
    allSlices.push(...slices)
  }

  return allSlices
}

async function readSourceFile(rootDir: string, filePath: string): Promise<string> {
  const fullPath = path.join(rootDir, filePath)
  const resolved = path.resolve(fullPath)
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('非法文件路径')
  }
  return await fs.readFile(fullPath, 'utf-8')
}

function sliceFile(content: string, filePath: string, language: string): CodeSlice[] {
  const lines = content.split('\n')
  const slices: CodeSlice[] = []

  // 1. 提取函数/类/路由切片
  const blockStarts = findBlockStarts(lines, language)

  for (const block of blockStarts) {
    const endLine = findBlockEnd(lines, block.line, language)
    const sliceLines = lines.slice(block.line, endLine)

    if (sliceLines.length >= MIN_SLICE_LINES) {
      slices.push({
        filePath,
        language,
        sliceType: block.type,
        content: sliceLines.join('\n'),
        lineStart: block.line + 1, // 1-based
        lineEnd: endLine,
      })
    }
  }

  // 2. 如果没有识别到任何切片，将文件按 MAX_SLICE_LINES 分块
  if (slices.length === 0 && lines.length >= MIN_SLICE_LINES) {
    for (let i = 0; i < lines.length; i += MAX_SLICE_LINES) {
      const end = Math.min(i + MAX_SLICE_LINES, lines.length)
      const chunk = lines.slice(i, end)
      slices.push({
        filePath,
        language,
        sliceType: 'other',
        content: chunk.join('\n'),
        lineStart: i + 1,
        lineEnd: end,
      })
    }
  }

  return slices
}

interface BlockStart {
  line: number // 0-based
  type: SliceType
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findBlockStarts(lines: string[], language: string): BlockStart[] {
  const starts: BlockStart[] = []
  const content = lines.join('\n')

  // 检查类
  for (const pattern of CLASS_PATTERNS) {
    const match = pattern.regex.exec(content)
    if (match) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1
      starts.push({ line: lineNum, type: 'class' })
    }
  }

  // 检查路由
  for (const pattern of ROUTE_PATTERNS) {
    let match: RegExpExecArray | null
    const regex = new RegExp(pattern.regex.source, 'gm')
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1
      starts.push({ line: lineNum, type: 'route' })
    }
  }

  // 检查函数
  for (const pattern of FUNCTION_PATTERNS) {
    let match: RegExpExecArray | null
    const regex = new RegExp(pattern.regex.source, 'gm')
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1
      // 避免重复（如果该行已经是类起始行）
      if (!starts.some(s => s.line === lineNum)) {
        starts.push({ line: lineNum, type: 'function' })
      }
    }
  }

  // 按行号排序
  starts.sort((a, b) => a.line - b.line)

  // 检测配置文件模式（如包含 password, secret, token 等关键词的代码段）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    if (/(password|secret|token|api_key|private_key|apikey)\s*[:=]/.test(line)) {
      if (!starts.some(s => s.line === i)) {
        const startLine = Math.max(0, i - 2)
        starts.push({ line: startLine, type: 'config' })
      }
    }
  }

  return starts
}

function findBlockEnd(lines: string[], startLine: number, language: string): number {
  const isPython = language === 'python'
  const maxEnd = Math.min(startLine + MAX_SLICE_LINES, lines.length)

  if (isPython) {
    // Python: 依赖缩进来判断代码块结束
    const startIndent = getIndentLevel(lines[startLine])
    for (let i = startLine + 1; i < maxEnd; i++) {
      const line = lines[i].trim()
      if (line === '') continue
      if (getIndentLevel(lines[i]) <= startIndent && line.length > 0) {
        return i
      }
    }
  } else {
    // 花括号语言：匹配大括号
    let braceCount = 0
    let foundOpen = false
    for (let i = startLine; i < maxEnd; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') { braceCount++; foundOpen = true }
        if (ch === '}') braceCount--
      }
      if (foundOpen && braceCount <= 0) return i + 1
    }
  }

  return maxEnd
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/)
  return match ? match[1].length : 0
}