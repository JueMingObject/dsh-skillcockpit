// Collect the skill catalog from the configured skill roots.
//
// This is the data-gathering half of the Chinese layer: it walks every SKILL.md
// under the skill roots this machine actually loads, pulls `name` and
// `description` out of the frontmatter, and writes them to `zh-skills.json`:
//
//   { "<skill name>": { "en": "<frontmatter description>" } }
//
// Translations live separately in `zh-i18n.json` (`{ name: { label, desc } }`),
// so re-running this script never overwrites hand-written Chinese, and adding a
// skill needs no edit here — the embed step picks up whatever is missing.
//
// Usage: node scripts/collect-skills.mjs [root ...]
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const DEFAULT_ROOTS = [
  join(process.env.USERPROFILE ?? 'C:/Users/liuyiyu', '.dsh', 'skills'),
  join(process.env.USERPROFILE ?? 'C:/Users/liuyiyu', '.claude', 'skills'),
  'G:/杂活/决明工作室/Glyph/story-os/skills'
]

const OUT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'zh-skills.json')
const I18N = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'zh-i18n.json')

/** Every SKILL.md below one root (symlinks are followed one level by readdir). */
function findSkillFiles(root, out = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) findSkillFiles(path, out)
    else if (entry.name === 'SKILL.md') out.push(path)
  }
  return out
}

/** The `name` / `description` fields of a SKILL.md frontmatter block. */
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) return {}
  const body = match[1]
  const fields = {}
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const field = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i])
    if (field === null) continue
    const key = field[1]
    let value = field[2].trim()
    if (value === '' || value === '>' || value === '|' || value === '>-' || value === '|-') {
      // Block scalar: swallow the following indented lines.
      const parts = []
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
        i += 1
        parts.push(lines[i].trim())
      }
      value = parts.join(' ').trim()
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    fields[key] = value
  }
  return fields
}

const hasCJK = text => /[\u3400-\u9fff]/.test(text ?? '')

const roots = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_ROOTS
const catalog = new Map()

for (const root of roots) {
  const files = findSkillFiles(root)
  process.stdout.write(`${root}: ${files.length} SKILL.md\n`)
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const meta = frontmatter(text)
    const name = meta.name
    if (typeof name !== 'string' || name === '') continue
    const description = (meta.description ?? '').replace(/\s+/g, ' ').trim()
    const existing = catalog.get(name)
    // First definition wins; a later duplicate only fills a missing description.
    if (existing === undefined) catalog.set(name, { en: description, file })
    else if (existing.en === '' && description !== '') existing.en = description
  }
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const manual = existsSync(I18N) ? JSON.parse(readFileSync(I18N, 'utf8')) : {}
const merged = {}
let translated = 0
for (const name of [...catalog.keys()].sort()) {
  const found = catalog.get(name)
  const old = previous[name] ?? {}
  const row = { en: found.en }
  if (typeof old.label === 'string' && old.label !== '') row.label = old.label
  if (typeof old.desc === 'string' && old.desc !== '') row.desc = old.desc
  if (row.label !== undefined || row.desc !== undefined) translated += 1
  merged[name] = row
}

// "Pending" means: no hand-written row in zh-i18n.json and nothing Chinese to fall back on.
const pending = Object.entries(merged).filter(([name, row]) => manual[name] === undefined && !hasCJK(row.en))
writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

process.stdout.write(
  `\n${Object.keys(merged).length} skills, ${translated} with Chinese text, ${pending.length} still English-only\n` +
  `written: ${OUT}\n`
)
process.stdout.write(`sample pending: ${pending.slice(0, 12).map(([name]) => name).join(', ')}\n`)
