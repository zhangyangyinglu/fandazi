import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const candidatesPath = resolve(productionDir, 'recipe-candidates.json')
const queue = JSON.parse(readFileSync(resolve(productionDir, 'image-queue.json'), 'utf8'))
const candidates = JSON.parse(readFileSync(candidatesPath, 'utf8'))
const mapSource = readFileSync(resolve(root, 'src/data/ingredientImages.ts'), 'utf8')
const mappedNames = new Set([...mapSource.matchAll(/^\s*'([^']+)':\s*'\/ingredient-images\//gm)].map((match) => match[1]))
const changes = []

for (const candidate of candidates.items) {
  if (candidate.status === 'published') continue
  const dishAsset = queue.items.find((item) => item.id === candidate.imageQueueId)
  const ingredientsReady = candidate.ingredientNames.every((name) => mappedNames.has(name))
  const nextStatus = dishAsset?.status === 'attached' && ingredientsReady ? 'ready-for-release' : 'asset-blocked'
  if (candidate.status !== nextStatus) {
    changes.push({ id: candidate.id, from: candidate.status, to: nextStatus })
    candidate.status = nextStatus
    candidate.updatedAt = new Date().toISOString()
  }
}

writeFileSync(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`)
console.log(JSON.stringify({ changes }, null, 2))
