import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync, watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEBOUNCE_MS = 1800
const IGNORED_PATHS = new Set(['.git', 'node_modules', 'dist', '.vercel'])
let timer = null
let running = false
let rerun = false

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', shell: false })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(' ')} 退出码 ${code ?? 'unknown'}`)))
  })
}

function gitStatus() {
  return new Promise((resolvePromise, reject) => {
    execFile('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error)
      else resolvePromise(stdout.trim())
    })
  })
}

async function publish() {
  if (running) { rerun = true; return }
  running = true
  try {
    if (!await gitStatus()) return
    console.log('\n[饭搭子自动发布] 检测到改动，开始构建检查…')
    await run('npm', ['run', 'build'])
    await run('git', ['add', '-A'])
    await run('git', ['commit', '-m', '自动发布最新饭搭子改动'])
    await run('git', ['push', 'origin', 'main'])
    console.log('[饭搭子自动发布] 已推送 GitHub，Vercel 将自动部署。')
  } catch (error) {
    console.error('[饭搭子自动发布] 发布失败，改动保留在本地，修复后会再次尝试。')
    console.error(error instanceof Error ? error.message : error)
  } finally {
    running = false
    if (rerun) { rerun = false; schedulePublish() }
  }
}

function schedulePublish() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void publish() }, DEBOUNCE_MS)
}

function isIgnored(path) {
  const relative = path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path
  return relative.split('/').some((part) => IGNORED_PATHS.has(part))
}

const gitPath = resolve(ROOT, '.git')
if (!existsSync(gitPath) || !statSync(gitPath).isDirectory()) throw new Error('当前目录不是 Git 仓库，无法自动发布。')

console.log('[饭搭子自动发布] 已启动。保存或上传文件后会自动构建、提交并推送。')
console.log('[饭搭子自动发布] 按 Ctrl+C 停止。')
schedulePublish()
watch(ROOT, { recursive: true }, (_eventType, filename) => {
  if (filename && !isIgnored(resolve(ROOT, filename.toString()))) schedulePublish()
})

