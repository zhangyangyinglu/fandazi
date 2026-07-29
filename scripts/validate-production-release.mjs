import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const candidates = JSON.parse(readFileSync(resolve(productionDir, 'recipe-candidates.json'), 'utf8'))
const queue = JSON.parse(readFileSync(resolve(productionDir, 'image-queue.json'), 'utf8'))
const mapSource = readFileSync(resolve(root, 'src/data/ingredientImages.ts'), 'utf8')
const mappedNames = new Set([...mapSource.matchAll(/^\s*'([^']+)':\s*'\/ingredient-images\//gm)].map((match) => match[1]))
const failures = []

for (const candidate of candidates.items) {
  if (candidate.status === 'published') continue
  const dishAsset = queue.items.find((item) => item.id === candidate.imageQueueId)
  const missingIngredients = candidate.ingredientNames.filter((name) => !mappedNames.has(name))
  if (dishAsset?.status !== 'attached' || missingIngredients.length) {
    failures.push({
      id: candidate.id,
      name: candidate.name,
      dishImageStatus: dishAsset?.status ?? 'missing',
      ingredientsMissingMappings: missingIngredients,
    })
  }
}

if (failures.length) {
  console.error(JSON.stringify({ releasable: false, failures }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ releasable: true, candidateCount: candidates.items.length }, null, 2))
