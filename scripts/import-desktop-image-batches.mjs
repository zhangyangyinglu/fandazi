import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const desktopRoot = process.env.FANDAZI_IMAGE_INBOX ?? '/Users/miki/Desktop/饭搭子生图'
const archiveRoot = resolve(desktopRoot, '已归档')
const queuePath = resolve(productionDir, 'image-queue.json')
const rulesPath = resolve(productionDir, 'ingredient-rules.json')
const queue = JSON.parse(readFileSync(queuePath, 'utf8'))
const rules = JSON.parse(readFileSync(rulesPath, 'utf8'))
const eligibleDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const imageExtensions = new Set(['.png', '.webp', '.jpg', '.jpeg'])
const isImage = (name) => imageExtensions.has(name.slice(name.lastIndexOf('.')).toLowerCase())
const results = []

if (!existsSync(desktopRoot)) {
  console.log(JSON.stringify({ imported: 0, reason: 'Desktop image inbox does not exist yet.' }, null, 2))
  process.exit(0)
}

for (const folder of readdirSync(desktopRoot).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name <= eligibleDate).sort()) {
  const batchDir = resolve(desktopRoot, folder)
  const manifestPath = resolve(batchDir, 'manifest.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.status !== 'awaiting-images') continue
  const images = readdirSync(batchDir)
    .filter(isImage)
    .map((name) => ({ name, path: resolve(batchDir, name), modifiedAt: statSync(resolve(batchDir, name)).mtimeMs }))
    .sort((a, b) => a.modifiedAt - b.modifiedAt || a.name.localeCompare(b.name))
  if (images.length < manifest.items.length) {
    results.push({ folder, status: 'waiting', expected: manifest.items.length, found: images.length })
    continue
  }
  if (images.length > manifest.items.length) {
    results.push({ folder, status: 'needs-cleanup', expected: manifest.items.length, found: images.length })
    continue
  }

  for (const [index, task] of manifest.items.entries()) {
    const item = queue.items.find((candidate) => candidate.id === task.id)
    if (!item || item.status !== 'prepared') throw new Error(`Queue mismatch for ${task.id}`)
    const targetDir = item.kind === 'ingredient' ? 'public/ingredient-images' : 'public/dish-images'
    const targetPath = resolve(root, targetDir, item.outputFile)
    execFileSync('python3', [
      'scripts/normalize-production-image.py',
      '--input', images[index].path,
      '--out', targetPath,
    ], { cwd: root, stdio: 'inherit' })
    item.status = 'attached'
    item.attachedAt = new Date().toISOString()
    item.finalPath = `/${targetDir.replace('public/', '')}/${item.outputFile}`
  }

  manifest.status = 'imported'
  manifest.importedAt = new Date().toISOString()
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  mkdirSync(archiveRoot, { recursive: true })
  renameSync(batchDir, resolve(archiveRoot, basename(batchDir)))
  results.push({ folder, status: 'imported', count: manifest.items.length })
}

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`)
writeFileSync(rulesPath, `${JSON.stringify(rules, null, 2)}\n`)
console.log(JSON.stringify({ imported: results.filter((result) => result.status === 'imported').length, results }, null, 2))
