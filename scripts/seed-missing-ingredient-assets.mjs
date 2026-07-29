import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const readJson = (file) => JSON.parse(readFileSync(resolve(productionDir, file), 'utf8'))
const writeJson = (file, value) => writeFileSync(resolve(productionDir, file), `${JSON.stringify(value, null, 2)}\n`)
const toId = (name) => createHash('sha256').update(name).digest('hex').slice(0, 10)

const baseline = readJson('reports/asset-baseline.json')
const specs = readJson('visual-specs.json')
const rules = readJson('ingredient-rules.json')
const queue = readJson('image-queue.json')
const template = specs['ingredient-photo-v1'].promptTemplate
const missing = baseline.currentCatalog.ingredientsMissingMappings
const existingNames = new Set(queue.items.map((item) => item.subject))

for (const ingredientName of missing) {
  const id = `ingredient-${toId(ingredientName)}`
  const outputFile = `${id}.webp`
  if (existingNames.has(ingredientName)) {
    const existing = queue.items.find((item) => item.subject === ingredientName)
    if (existing?.outputFile?.includes('%')) existing.outputFile = outputFile
    continue
  }
  queue.items.push({
    id,
    kind: 'ingredient',
    subject: ingredientName,
    status: 'queued',
    priority: 'blocker',
    visualSpecVersion: 'ingredient-photo-v1',
    prompt: template.replaceAll('{{ingredientName}}', ingredientName),
    outputFile,
    attempts: [],
    createdAt: new Date().toISOString(),
  })
  rules.pendingIngredients.push({
    name: ingredientName,
    queueItemId: id,
    status: 'queued',
  })
}

writeJson('ingredient-rules.json', rules)
writeJson('image-queue.json', queue)
console.log(`Queued ${missing.length} missing ingredient assets.`)
