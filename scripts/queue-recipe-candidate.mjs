import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
if (!args.input) throw new Error('Usage: node scripts/queue-recipe-candidate.mjs --input=content/production/inbox/<candidate>.json')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const productionJson = (file) => readJson(resolve(productionDir, file))
const writeJson = (file, value) => writeFileSync(resolve(productionDir, file), `${JSON.stringify(value, null, 2)}\n`)
const stableId = (prefix, value) => `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 10)}`

function loadDishes() {
  const source = readFileSync(resolve(root, 'src/data/dishes.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', compiled)(module, module.exports)
  return module.exports.DISHES
}

const candidatePath = resolve(root, args.input)
if (!existsSync(candidatePath)) throw new Error(`Candidate not found: ${candidatePath}`)
const candidate = readJson(candidatePath)
const required = ['id', 'name', 'source', 'category', 'tags', 'cookMethod', 'cookTime', 'ingredients', 'steps']
const missing = required.filter((field) => !candidate[field] || (Array.isArray(candidate[field]) && !candidate[field].length))
if (missing.length) throw new Error(`Candidate missing required fields: ${missing.join(', ')}`)
if (!candidate.source.url || !candidate.source.platform) throw new Error('Candidate source requires platform and url.')

const dishes = loadDishes()
const candidates = productionJson('recipe-candidates.json')
const rules = productionJson('ingredient-rules.json')
const queue = productionJson('image-queue.json')
const specs = productionJson('visual-specs.json')
const existingNames = new Set([...dishes, ...candidates.items].map((dish) => dish.name.trim()))
if (existingNames.has(candidate.name.trim())) throw new Error(`Duplicate dish name: ${candidate.name}`)
if (candidates.items.some((item) => item.id === candidate.id)) throw new Error(`Duplicate candidate ID: ${candidate.id}`)

const mapSource = readFileSync(resolve(root, 'src/data/ingredientImages.ts'), 'utf8')
const mappedNames = new Set([...mapSource.matchAll(/^\s*'([^']+)':\s*'\/ingredient-images\//gm)].map((match) => match[1]))
const alias = (name) => rules.aliases[name] ?? name
const missingIngredients = [...new Set(candidate.ingredients.map((ingredient) => alias(ingredient.name)))].filter((name) => !mappedNames.has(name))
const ingredientTemplate = specs['ingredient-photo-v1'].promptTemplate

for (const name of missingIngredients) {
  if (!queue.items.some((item) => item.kind === 'ingredient' && item.subject === name)) {
    const id = stableId('ingredient', name)
    queue.items.push({
      id,
      kind: 'ingredient',
      subject: name,
      status: 'queued',
      priority: 'blocker',
      visualSpecVersion: 'ingredient-photo-v1',
      prompt: ingredientTemplate.replaceAll('{{ingredientName}}', name),
      outputFile: `${id}.webp`,
      attempts: [],
      createdAt: new Date().toISOString(),
    })
    rules.pendingIngredients.push({ name, queueItemId: id, status: 'queued' })
  }
}

const dishQueueId = `dish-${candidate.id}`
const dishTemplate = specs['dish-photo-v1'].promptTemplate
const keyIngredients = candidate.ingredients.slice(0, 4).map((ingredient) => ingredient.name).join('、')
queue.items.push({
  id: dishQueueId,
  kind: 'dish',
  subject: candidate.name,
  status: 'queued',
  priority: 'normal',
  visualSpecVersion: 'dish-photo-v1',
  prompt: dishTemplate
    .replaceAll('{{dishName}}', candidate.name)
    .replaceAll('{{keyIngredients}}', keyIngredients)
    .replaceAll('{{cookMethod}}', candidate.cookMethod),
  outputFile: `${dishQueueId}.webp`,
  attempts: [],
  createdAt: new Date().toISOString(),
})

const importedCandidate = {
  ...candidate,
  ingredientNames: candidate.ingredients.map((ingredient) => alias(ingredient.name)),
  imageQueueId: dishQueueId,
  status: 'asset-blocked',
  importedAt: new Date().toISOString(),
}

if (args['dry-run'] === 'true') {
  console.log(JSON.stringify({ candidate: importedCandidate, missingIngredients }, null, 2))
} else {
  candidates.items.push(importedCandidate)
  writeJson('recipe-candidates.json', candidates)
  writeJson('ingredient-rules.json', rules)
  writeJson('image-queue.json', queue)
  console.log(`Queued candidate ${candidate.id}: ${candidate.name}`)
}
