import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
if (!args.id || !args.input) throw new Error('Usage: node scripts/register-production-image.mjs --id=<queue-id> --input=<downloaded-image>')

const queuePath = resolve(productionDir, 'image-queue.json')
const queue = JSON.parse(readFileSync(queuePath, 'utf8'))
const item = queue.items.find((candidate) => candidate.id === args.id)
if (!item) throw new Error(`Unknown queue item: ${args.id}`)
if (item.status === 'attached') throw new Error(`Queue item already attached: ${args.id}`)

const inputPath = resolve(root, args.input)
if (!existsSync(inputPath)) throw new Error(`Input image not found: ${inputPath}`)
const targetDir = item.kind === 'ingredient' ? 'public/ingredient-images' : 'public/dish-images'
const targetPath = resolve(root, targetDir, item.outputFile)

execFileSync('python3', [
  'scripts/normalize-production-image.py',
  '--input', inputPath,
  '--out', targetPath,
], { cwd: root, stdio: 'inherit' })

item.status = 'attached'
item.attachedAt = new Date().toISOString()
item.finalPath = `/${targetDir.replace('public/', '')}/${item.outputFile}`
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`)
console.log(`Registered ${item.id} at ${item.finalPath}`)
