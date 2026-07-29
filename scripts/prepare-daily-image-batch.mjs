import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const productionDir = resolve(root, 'content/production')
const queuePath = resolve(productionDir, 'image-queue.json')
const requestedDate = process.argv.find((arg) => arg.startsWith('--date='))?.slice(7)
const date = requestedDate ?? new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const outboxDir = resolve(productionDir, 'outbox')
const outputPath = resolve(outboxDir, `${date}-image-batch.md`)
const desktopRoot = process.env.FANDAZI_IMAGE_INBOX ?? '/Users/miki/Desktop/饭搭子生图'
const desktopBatchDir = resolve(desktopRoot, date)
const queue = JSON.parse(readFileSync(queuePath, 'utf8'))

if (existsSync(resolve(desktopBatchDir, 'manifest.json'))) {
  console.log(JSON.stringify({ outputPath, desktopBatchDir, status: 'already-prepared' }, null, 2))
  process.exit(0)
}

const priority = { blocker: 0, high: 1, normal: 2, low: 3 }
const items = queue.items
  .filter((item) => item.status === 'queued')
  .sort((a, b) => (priority[a.priority] ?? 9) - (priority[b.priority] ?? 9) || a.createdAt.localeCompare(b.createdAt))
  .slice(0, queue.dailyAssetLimit)

if (!items.length) throw new Error('No queued image assets.')

const lines = [
  `# 饭搭子图片批次｜${date}`,
  '',
  `本批共 ${items.length} 项，全部使用已冻结的提示词。每项单独提交给 ChatGPT Images，下载原图后按输出文件名保存到待接入目录。`,
  '',
]

for (const [index, item] of items.entries()) {
  lines.push(`## ${index + 1}. ${item.subject}（${item.kind === 'ingredient' ? '食材图' : '菜图'}）`)
  lines.push(`- 队列 ID：\`${item.id}\``)
  lines.push(`- 输出文件：\`${item.outputFile}\``)
  lines.push(`- 视觉规范：\`${item.visualSpecVersion}\``)
  lines.push('')
  lines.push('```text')
  lines.push(item.prompt)
  lines.push('```')
  lines.push('')
}

mkdirSync(outboxDir, { recursive: true })
writeFileSync(outputPath, `${lines.join('\n')}\n`)
mkdirSync(desktopBatchDir, { recursive: true })
writeFileSync(resolve(desktopBatchDir, '今日提示词.md'), `${lines.join('\n')}\n`)
writeFileSync(resolve(desktopBatchDir, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  date,
  status: 'awaiting-images',
  items: items.map((item) => ({ id: item.id, kind: item.kind, subject: item.subject, outputFile: item.outputFile })),
}, null, 2)}\n`)
for (const item of items) {
  item.status = 'prepared'
  item.batchDate = date
}
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, desktopBatchDir, itemCount: items.length }, null, 2))
