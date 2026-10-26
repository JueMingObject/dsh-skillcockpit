// Embed the Chinese skill layer into client.js.
//
// Inputs:
//   zh-skills.json  collected by scripts/collect-skills.mjs — `{ name: { en } }`
//   zh-i18n.json    hand-written translations         — `{ name: { label, desc } }`
//
// Output: the `SKILL_ZH` literal between the `<zh:begin>` / `<zh:end>` markers in
// client.js. Rows that already read as Chinese keep their own description (the
// runtime falls back to it), so only the interesting fields are embedded.
//
// The client bundle is a single file the host serves as one module — it cannot
// fetch a sibling JSON at runtime, which is why this is an embed step.
//
// Usage: node scripts/embed-i18n.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'))

const catalog = read('zh-skills.json')
const i18n = read('zh-i18n.json')

const hasCJK = text => /[\u3400-\u9fff]/.test(text ?? '')

/** One embedded row: `{ l, d }`, either field omitted when nothing to add. */
const rows = {}
const untranslated = []
for (const name of Object.keys(catalog).sort()) {
  const en = (catalog[name].en ?? '').replace(/\s+/g, ' ').trim()
  const manual = i18n[name] ?? {}
  const row = {}
  if (typeof manual.label === 'string' && manual.label.trim() !== '') row.l = manual.label.trim()
  const desc = typeof manual.desc === 'string' ? manual.desc.trim() : ''
  if (desc !== '') row.d = desc
  if (Object.keys(row).length > 0) rows[name] = row
  else if (!hasCJK(en)) untranslated.push(name)
}

const body = Object.keys(rows)
  .map(name => `      ${JSON.stringify(name)}: ${JSON.stringify(rows[name])}`)
  .join(',\n')
const literal = `    var SKILL_ZH = {\n${body}\n    }`

const clientPath = join(root, 'client.js')
const client = readFileSync(clientPath, 'utf8')
const block = /(\/\/ <zh:begin>\n)[\s\S]*?(\n[ \t]*\/\/ <zh:end>)/
if (!block.test(client)) {
  process.stdout.write('client.js has no <zh:begin> / <zh:end> markers\n')
  process.exit(1)
}
const next = client.replace(block, (_match, head, tail) => `${head}${literal}${tail}`)

if (process.argv.includes('--check')) {
  if (next !== client) {
    process.stdout.write('client.js is stale: run node scripts/embed-i18n.mjs\n')
    process.exit(1)
  }
  process.stdout.write(`chinese layer up to date (${Object.keys(rows).length} rows)\n`)
  process.exit(0)
}

writeFileSync(clientPath, next, 'utf8')
process.stdout.write(
  `embedded ${Object.keys(rows).length} Chinese rows (${Object.keys(rows).length - untranslated.length} translated, ` +
  `${untranslated.length} still English-only)\n`
)
if (untranslated.length > 0) {
  process.stdout.write(`untranslated: ${untranslated.slice(0, 15).join(', ')}\n`)
}
