// Unit tests for the delivered client bundle (client.js).
//
// The bundle is a classic script that hands its plugin object to
// `window.__ModuleLoader__.load`, so it runs here inside a vm context with the
// loader, `localStorage` and `console` stubbed. Everything asserted below is
// protocol the harness actually implements:
//   * `drill` is a boolean on a candidate (`ui-input-trigger/src/types.ts:72`)
//   * a drill pick returns `{ text, continue: true }` where `text` is the WHOLE
//     new token, trigger included — the pick replaces trigger+query
//     (`ui-reference/src/client/index.ts:96-97` returns `value.mention`, i.e.
//     the full `@path`)
//   * `header` publishes crumbs whose values come back through `onPick`
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const bundle = readFileSync(join(root, 'client.js'), 'utf8')

/** The catalog shape `remote.skills.list` returns. */
const CATALOG = [
  { name: 'gstack', description: 'Router for the gstack skill suite.' },
  { name: 'browse', description: 'Fast headless browser for QA testing.' },
  { name: 'qa', description: 'Interactive QA session.' },
  { name: 'craft-correctness', description: '代码正确性手艺。' },
  { name: 'hmos-arkui-develop-skill', description: 'ArkTS/ArkUI 开发。' },
  { name: 'manju-cinematic-previs', description: '漫剧镜头预演。' },
  { name: 'jubenshi-01-lead-writer', description: '剧本开发案。' },
  { name: 'product-definition', description: '产品定义。' },
  { name: 'xiaohongshu-ops', description: '小红书运营。' },
  { name: 'office-docx', description: 'Word 文档处理。' },
  { name: 'totally-custom-thing', description: 'A skill nobody classified.' }
]

/**
 * Load the bundle and mount it against a fake client context.
 *
 * `inputTriggers.live.sources` mirrors the real service (`InputTriggerService`
 * keeps one live array and hands it to every session controller), which is what
 * lets the bundle take the native source over in place.
 *
 * @returns the object that ends up carrying the grouped behaviour, plus the
 *   fake services it talks to.
 */
function mount(options = {}) {
  let plugin
  const context = {
    window: {
      __ModuleLoader__: {
        load: mod => { plugin = mod }
      }
    },
    localStorage: {
      store: options.storedConfig === undefined ? {} : { 'dsh.cockpit.config': options.storedConfig },
      getItem(key) { return this.store[key] ?? null },
      setItem(key, value) { this.store[key] = value }
    },
    console: { warn() {}, log() {}, error() {} },
    JSON,
    Promise,
    AbortController
  }
  vm.runInNewContext(bundle, context, { filename: 'client.js' })
  assert.ok(plugin, 'bundle must call __ModuleLoader__.load')
  assert.equal(plugin.id, '@local/dsh-cockpit')

  const registered = []
  const nativeSource = { trigger: '/', name: 'skill', order: 2, candidates: async () => [] }
  const live = []
  const inputTriggers = {
    live: { sources: live },
    registerSource(src) {
      registered.push(src)
      live.push(src)
      return () => {
        const at = live.indexOf(src)
        if (at >= 0) live.splice(at, 1)
      }
    }
  }
  if (options.withNative !== false) live.push(nativeSource)
  const disposers = []
  const ctx = {
    remote: { skills: { list: async () => ({ ok: true, value: { skills: CATALOG } }) } },
    sessions: { subagentAddress: () => (options.subagent === true ? 'agent/s1/sub' : undefined) },
    get: name => (name === 'inputTriggers' ? inputTriggers : undefined),
    effect: (fn) => { disposers.push(fn()) }
  }
  const built = plugin.factory(() => { throw new Error('bundle must not require modules') })
  built.apply(ctx)
  assert.ok(registered.length <= 1, 'never registers more than one source')
  return {
    source: registered.length === 1 ? registered[0] : nativeSource,
    registered,
    live,
    nativeSource,
    dispose: () => disposers.forEach(fn => fn())
  }
}

const plain = value => JSON.parse(JSON.stringify(value))
const signal = () => new AbortController().signal
const ask = (source, query, drilled = false) =>
  source.candidates({ sessionId: 's1' }, { query, drilled, position: 'leading', signal: signal() })
const pick = (source, candidate, action = 'pick') => plain(source.onPick({
  candidate,
  session: { sessionId: 's1' },
  position: 'leading',
  via: 'menu',
  action,
  span: {}
}))

test('root query lists one folder per non-empty group', async () => {
  const { source } = mount()
  const rows = await ask(source, '')
  assert.ok(rows.length >= 5)
  for (const row of rows) {
    assert.equal(row.drill, true, 'folder rows declare a real drill')
    assert.ok(row.name.endsWith('/'), `${row.name} descends like a path`)
    assert.equal(typeof row.value, 'string')
  }
  const names = rows.map(row => row.name)
  assert.ok(names.includes('gstack/'), 'gstack has its own group')
  assert.ok(names.includes('hmos/'))
  assert.ok(names.includes('other/'), 'unclassified skills stay reachable')
})

test('the native slash source is taken over instead of duplicated', async () => {
  const { source, registered, live, nativeSource } = mount()
  assert.equal(registered.length, 0, 'no second trigger source competes with the native one')
  assert.equal(source, nativeSource)
  assert.ok(live.includes(nativeSource))
  assert.equal(typeof source.header, 'function', 'the adopted source grew our header')
  const rows = await ask(source, '')
  assert.ok(rows.every(row => row.drill === true), 'the adopted source serves grouped rows')
})

test('a group drill opens that group and reports the groups it holds', async () => {
  const { source } = mount()
  const rows = await ask(source, 'gstack/')
  const names = rows.map(row => row.name)
  assert.ok(names.includes('gstack'), 'gstack itself stays listed')
  assert.ok(names.includes('browse'))
  assert.ok(!names.includes('office-docx'), 'rows stay inside the group')
  assert.equal(rows[0].section, '⚡ gstack 工作流')
})

test('typing after the slash filters inside the open group', async () => {
  const { source } = mount()
  const rows = await ask(source, 'craft/correct', true)
  assert.deepEqual(plain(rows.map(row => row.name)), ['craft-correctness'])
})

test('a plain query searches every group and keeps matching folders', async () => {
  const { source } = mount()
  const rows = await ask(source, 'office')
  assert.ok(rows.some(row => row.name === 'office-docx'))
  const folders = rows.filter(row => row.drill === true)
  assert.ok(folders.every(row => row.name.endsWith('/')))
})

test('picking a folder descends by rewriting the whole token', () => {
  const { source } = mount()
  assert.deepEqual(
    pick(source, { name: 'gstack/', value: JSON.stringify({ kind: 'group', id: 'gstack' }) }, 'drill'),
    { text: '/gstack/', continue: true }
  )
})

test('picking a skill inserts the slash command', () => {
  const { source } = mount()
  assert.deepEqual(
    pick(source, { name: 'craft-correctness', value: JSON.stringify({ kind: 'skill', name: 'craft-correctness' }) }),
    { text: '/craft-correctness ' }
  )
})

test('a drilled listing publishes breadcrumbs back to the root', () => {
  const { source } = mount()
  const crumbs = source.header({ sessionId: 's1' }, { query: 'craft/', drilled: true })
  assert.equal(crumbs.length, 2)
  assert.equal(crumbs[0].label, '技能分类')
  assert.equal(crumbs[1].current, true)
  assert.equal(source.header({ sessionId: 's1' }, { query: 'craft/', drilled: false }), undefined,
    'a typed path needs no header')
  assert.deepEqual(
    pick(source, { name: crumbs[0].label, value: crumbs[0].value }, 'drill'),
    { text: '/', continue: true }
  )
})

test('without the native source the bundle registers its own and drops a late native', async () => {
  const { source, registered, live, nativeSource } = mount({ withNative: false })
  assert.equal(registered.length, 1, 'own source registered when there is nothing to adopt')
  const rows = await ask(source, '')
  assert.ok(rows.some(row => row.name === 'gstack/'))
  live.push(nativeSource)
  await ask(source, '')
  assert.ok(!live.includes(nativeSource), 'a late native source is dropped')
  assert.ok(live.includes(source))
})

test('a stored config replaces the built-in groups and can keep the native list', async () => {
  const stored = JSON.stringify({
    replaceNative: false,
    groups: [{ id: 'mine', name: '🧪 我的分组', priority: 1, icon: '🧪', description: '自定义', patterns: ['craft-*'] }]
  })
  const { source, registered, live, nativeSource } = mount({ storedConfig: stored })
  assert.equal(registered.length, 1, 'replaceNative:false registers its own source')
  assert.equal(source.name, 'skill-cockpit')
  const rows = await ask(source, '')
  assert.deepEqual(plain(rows.map(row => row.name)), ['mine/', 'other/'])
  assert.ok(live.includes(nativeSource), 'replaceNative:false keeps the native list')
})

test('a subagent session offers no skills', async () => {
  const { source } = mount({ subagent: true })
  assert.deepEqual(plain(await ask(source, '')), [])
})
