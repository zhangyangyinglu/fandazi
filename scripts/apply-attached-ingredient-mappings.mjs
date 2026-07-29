import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const queuePath = resolve(productionDir, 'image-queue.json')
const rulesPath = resolve(productionDir, 'ingredient-rules.json')
const mapPath = resolve(root, 'src/data/ingredientImages.ts')
const queue = JSON.parse(readFileSync(queuePath, 'utf8'))
const rules = JSON.parse(readFileSync(rulesPath, 'utf8'))
let mapSource = readFileSync(mapPath, 'utf8')
const ready = queue.items.filter((item) => item.kind === 'ingredient' && item.status === 'attached' && !item.mappingAppliedAt)

for (const item of ready) {
  if (mapSource.includes(`'${item.subject}':`)) {
    item.mappingAppliedAt = new Date().toISOString()
    continue
  }
  const marker = '\n}\n\n/**\n * 按食材名查找图片路径'
  const entry = `  '${item.subject}': '/ingredient-images/${item.outputFile}',\n`
  if (!mapSource.includes(marker)) throw new Error('Ingredient image map marker not found; refusing to edit source.')
  mapSource = mapSource.replace(marker, `\n${entry}}\n\n/**\n * 按食材名查找图片路径`)
  item.mappingAppliedAt = new Date().toISOString()
  const pending = rules.pendingIngredients.find((ingredient) => ingredient.queueItemId === item.id)
  if (pending) pending.status = 'mapped'
}

writeFileSync(mapPath, mapSource)
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`)
writeFileSync(rulesPath, `${JSON.stringify(rules, null, 2)}\n`)
console.log(`Applied ${ready.length} attached ingredient mappings.`)
