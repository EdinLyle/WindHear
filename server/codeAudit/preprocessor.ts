import { promises as fs } from 'fs'
import path from 'path'
import { unzipToDirectory } from '../mcpScan/util/unzip.js'

const MAX_FILES = 200
const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.vue': 'vue',
  '.svelte': 'svelte',
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'out',
  '.venv', 'venv', 'vendor', '.gradle', '.idea', '.vscode', 'target',
  'bin', 'obj', 'coverage', '.cache', '.tox', 'egg-info',
])

export async function preprocessZip(zipBuffer: Buffer, extractDir: string): Promise<{
  files: Array<{ path: string; language: string; size: number }>
  totalFiles: number
  languages: string[]
}> {
  await fs.mkdir(extractDir, { recursive: true })
  await unzipToDirectory(zipBuffer, extractDir)
  return scanProject(extractDir)
}

export async function preprocessGit(gitUrl: string, extractDir: string): Promise<{
  files: Array<{ path: string; language: string; size: number }>
  totalFiles: number
  languages: string[]
}> {
  await fs.mkdir(extractDir, { recursive: true })

  const { execFile } = await import('child_process')
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Git 克隆超时（120秒）')), 120_000)
    execFile('git', ['clone', '--depth', '1', gitUrl, extractDir], (err) => {
      clearTimeout(timeout)
      if (err) reject(new Error(`Git 克隆失败: ${err.message}`))
      else resolve()
    })
  })

  // 删除 .git 目录
  try {
    await fs.rm(path.join(extractDir, '.git'), { recursive: true, force: true })
  } catch { /* ignore */ }

  return scanProject(extractDir)
}

async function scanProject(rootDir: string) {
  const files: Array<{ path: string; language: string; size: number }> = []
  const langSet = new Set<string>()
  let totalFiles = 0

  async function walk(dir: string) {
    if (files.length >= MAX_FILES) return
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(fullPath)
      } else if (entry.isFile()) {
        totalFiles++
        const ext = path.extname(entry.name).toLowerCase()
        const language = SUPPORTED_EXTENSIONS[ext]
        if (language) {
          const stat = await fs.stat(fullPath)
          const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/')
          files.push({ path: relativePath, language, size: stat.size })
          langSet.add(language)
        }
      }
    }
  }

  await walk(rootDir)
  return { files, totalFiles, languages: Array.from(langSet) }
}

export async function readSourceFile(rootDir: string, filePath: string): Promise<string> {
  const fullPath = path.join(rootDir, filePath)
  // 防止路径遍历
  const resolved = path.resolve(fullPath)
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('非法文件路径')
  }
  return await fs.readFile(fullPath, 'utf-8')
}