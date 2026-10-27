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
import { byClass, createPanelRenderer, textOf } from './panel.helper.mjs'

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
  const copied = []
  const context = {
    window: {
      __ModuleLoader__: {
        load: mod => { plugin = mod }
      }
    },
    localStorage: {
      store: {
        ...(options.storedConfig === undefined ? {} : { 'dsh.cockpit.config': options.storedConfig }),
        ...(options.storedZh === undefined ? {} : { 'dsh.cockpit.zh': options.storedZh })
      },
      getItem(key) { return this.store[key] ?? null },
      setItem(key, value) { this.store[key] = value }
    },
    navigator: { clipboard: { writeText: async text => { copied.push(text) } } },
    console: { warn() {}, log() {}, error() {} },
    JSON,
    Promise,
    AbortController,
    Date,
    setTimeout,
    clearTimeout
  }
  vm.runInNewContext(bundle, context, { filename: 'client.js' })
  assert.ok(plugin, 'bundle must call __ModuleLoader__.load')
  assert.equal(plugin.id, 'dsh-skills-cockpit')

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
  const panel = { definition: undefined, component: undefined, inject: undefined, slotName: undefined, key: undefined }
  // The panel reads Session data, not the catalog: one Trajectory target whose
  // snapshot the test replaces to simulate live and settled skill loads.
  const trajectory = {
    snapshot: options.trajectory ?? { eventNodes: [], runningCalls: [] },
    listeners: new Set()
  }
  const binding = { session: 's1' }
  const sessionsService = {
    subagentAddress: () => (options.subagent === true ? 'agent/s1/sub' : undefined),
    binding: id => (options.withSession === false || id !== 's1' ? undefined : binding)
  }
  const conversationService = {
    binding: () => ({
      target: name => (name !== 'trajectory' ? undefined : {
        getSnapshot: () => trajectory.snapshot,
        subscribe: listener => {
          trajectory.listeners.add(listener)
          return () => { trajectory.listeners.delete(listener) }
        }
      })
    })
  }
  const ctx = {
    remote: {
      skills: {
        list: async () => (options.listFails === true
          ? { ok: false, error: '技能服务不可用' }
          : { ok: true, value: { skills: CATALOG } })
      }
    },
    sessions: sessionsService,
    get: name => {
      if (name === 'inputTriggers') return options.withInputTriggers === false ? undefined : inputTriggers
      if (name === 'sessions') return sessionsService
      if (name === 'uiConversation') return conversationService
      return undefined
    },
    effect: (fn) => { disposers.push(fn()) },
    inject: (services, callback) => {
      const owner = {
        get: name => (name === 'sidebarRightTabs'
          ? { register: definition => { panel.definition = definition; return () => { panel.definition = undefined } } }
          : undefined),
        slots: {
          register: (spec, component) => {
            panel.slotName = spec.name
            panel.key = spec.key
            panel.inject = spec.inject
            panel.component = component
            return () => { panel.component = undefined }
          }
        },
        effect: (fn) => { disposers.push(fn()) }
      }
      callback(owner)
    }
  }
  // The sidebar body is React; every other specifier must stay unresolved, so a
  // bundle that quietly reached for a package the host does not inject fails here.
  const hookRuntime = { current: undefined }
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false) }
    }),
    useState: (...args) => hookRuntime.current.useState(...args),
    useEffect: (...args) => hookRuntime.current.useEffect(...args)
  }
  const built = plugin.factory(specifier => {
    if (specifier === 'react') return react
    throw new Error(`unexpected require: ${specifier}`)
  })
  built.apply(ctx)
  assert.ok(registered.length <= 1, 'never registers more than one source')
  return {
    source: registered.length === 1 ? registered[0] : nativeSource,
    registered,
    live,
    nativeSource,
    panel,
    hookRuntime,
    copied,
    trajectory,
    /** Publish a new snapshot the way the Conversation target would. */
    emitTrajectory: snapshot => {
      trajectory.snapshot = snapshot
      for (const listener of [...trajectory.listeners]) listener()
    },
    /** The cross-session ledger this mount has written so far. */
    usageLedger: () => JSON.parse(context.localStorage.store['dsh.cockpit.usage'] ?? '{}'),
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

// --- Chinese layer -------------------------------------------------------
//
// The menu renders `label` as a row's primary text and the raw `name` beside it
// as an alias (`ui-input-trigger/src/client/MenuView.tsx:178-181`), so the
// translation renames a row without hiding the identifier people type.

test('a translated skill shows a Chinese label and keeps its identifier', async () => {
  const { source } = mount()
  const rows = plain(await ask(source, 'gstack/'))
  const browse = rows.find(row => row.name === 'browse')
  assert.equal(browse.label, '无头浏览器')
  assert.equal(browse.description, '快速无头浏览器，用于站点 QA 与自测')
  // The pick still inserts the English identifier, never the label.
  assert.deepEqual(pick(source, browse), { text: '/browse ' })
})

test('an untranslated skill keeps its own description and gets no label', async () => {
  const { source } = mount()
  const rows = plain(await ask(source, 'custom'))
  const custom = rows.find(row => row.name === 'totally-custom-thing')
  assert.equal(custom.label, undefined)
  assert.equal(custom.description, 'A skill nobody classified.')
})

test('typing Chinese finds the skill through its translation', async () => {
  const { source } = mount()
  assert.ok(plain(await ask(source, '浏览器')).some(row => row.name === 'browse'),
    'the translated label is searchable')
  assert.ok(plain(await ask(source, '无头')).some(row => row.name === 'browse'),
    'the translated description is searchable')
})

test('a stored translation overrides the built-in one', async () => {
  const storedZh = JSON.stringify({ browse: { label: '我的浏览器', desc: '自定义简介' } })
  const { source } = mount({ storedZh })
  const browse = plain(await ask(source, 'gstack/')).find(row => row.name === 'browse')
  assert.equal(browse.label, '我的浏览器')
  assert.equal(browse.description, '自定义简介')
  // A `{ label, desc }` row is accepted too, so people can paste readable JSON.
  const readable = mount({ storedZh: JSON.stringify({ qa: { label: '质检', desc: '手写' } }) })
  const qa = plain(await ask(readable.source, 'gstack/')).find(row => row.name === 'qa')
  assert.equal(qa.label, '质检')
})


// --- the right-sidebar cockpit panel ---------------------------------------
//
// A tab type is two registrations under one id: the static definition into
// `sidebarRightTabs` and the body into the keyed `sidebar.right.pane.tab` seat
// (`ui-sidebar-right/src/client/contract/slots.ts:40-95`).

test('the cockpit tab type and its body register under one id', () => {
  const { panel } = mount()
  assert.equal(panel.slotName, 'sidebar.right.pane.tab')
  assert.equal(panel.definition.id, panel.key, 'the body dispatch key is the definition id')
  assert.equal(panel.definition.kind, 'skill-cockpit')
  assert.equal(panel.definition.priority, 'extension')
  assert.equal(panel.definition.title('sidebar://skill-cockpit'), '驾驶舱')
  assert.equal(panel.definition.guide[0].title(), '技能驾驶舱')
  assert.equal(panel.inject('s1').sessionId, 's1', 'the body learns its session from inject')
})

const usageSnapshot = () => {
  const now = Date.now()
  return {
    eventNodes: [
      {
        kind: 'tool-result', seq: 1, time: now - 180000, callTime: now - 190000, isError: false, subCalls: [],
        call: { name: 'skill', argsRaw: '{"name":"browse"}' }
      },
      {
        kind: 'tool-result', seq: 2, time: now - 60000, callTime: now - 60000, isError: false, subCalls: [],
        call: { name: 'skill', argsRaw: '{"name":"ship"}' }
      },
      { kind: 'user', seq: 3, time: now - 30000, content: [{ type: 'text', text: '/qa 跑一遍' }] },
      {
        kind: 'tool-result', seq: 4, time: now - 20000, callTime: now - 20000, isError: false, subCalls: [],
        call: { name: 'read', argsRaw: '{"file_path":"x"}' }
      }
    ],
    runningCalls: [{ callId: 'c1', name: 'skill', argsRaw: '{"name":"browse"}', time: now }]
  }
}

test('the panel splits running skills from the ones already used', () => {
  const mounted = mount({ trajectory: usageSnapshot() })
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  const tree = view.render()

  assert.deepEqual(byClass(tree, 'dsh-cockpit-section').map(textOf),
    ['正在运行', '本会话用过', '全部会话累计'])
  const names = byClass(tree, 'dsh-cockpit-row-name').map(textOf)
  assert.deepEqual(names, ['browse', 'qa', 'ship', 'browse', 'qa', 'ship', 'browse'],
    'running first, then this session by recency, then the ledger by recency')
  assert.deepEqual(byClass(tree, 'dsh-cockpit-live').map(textOf), ['运行中'])
  assert.match(textOf(tree), /本会话 3 个/)
  assert.ok(!names.includes('read'), 'a non-skill tool call is not a skill use')
  view.cleanups.forEach(cleanup => cleanup())
})

test('a literal /name message counts as a use, not only the tool call', () => {
  const mounted = mount({ trajectory: usageSnapshot() })
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  const tree = view.render()

  const qa = byClass(tree, 'dsh-cockpit-row').find(row => textOf(byClass(row, 'dsh-cockpit-row-name')[0]) === 'qa')
  assert.ok(qa, 'the slash message produced a row')
  assert.match(textOf(qa), /1 次 · /)
  view.cleanups.forEach(cleanup => cleanup())
})

test('replaying a snapshot does not inflate the cross-session ledger', () => {
  const mounted = mount({ trajectory: usageSnapshot() })
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  view.render()
  mounted.emitTrajectory(usageSnapshot())

  const ledger = mounted.usageLedger()
  assert.equal(ledger.totals.browse.count, 1, 'the same absolute count is not added twice')
  assert.equal(ledger.totals.qa.count, 1)

  const grown = usageSnapshot()
  grown.eventNodes.push({
    kind: 'tool-result', seq: 9, time: Date.now(), callTime: Date.now(), isError: false, subCalls: [],
    call: { name: 'skill', argsRaw: '{"name":"qa"}' }
  })
  mounted.emitTrajectory(grown)
  assert.equal(mounted.usageLedger().totals.qa.count, 2, 'only the delta is added')
  view.cleanups.forEach(cleanup => cleanup())
})

test('a session that used nothing explains what to do', () => {
  const mounted = mount()
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  const tree = view.render()

  assert.equal(byClass(tree, 'dsh-cockpit-section').length, 0)
  assert.match(textOf(byClass(tree, 'dsh-cockpit-empty')[0]), /还没用过技能/)
  view.cleanups.forEach(cleanup => cleanup())
})

test('an unopened session says why there is no history', () => {
  const mounted = mount({ withSession: false })
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  const tree = view.render()

  assert.match(textOf(byClass(tree, 'dsh-cockpit-error')[0]), /读不到这个会话的轨迹/)
  view.cleanups.forEach(cleanup => cleanup())
})

test('a skill that starts running shows up without reopening the panel', () => {
  const mounted = mount()
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  view.render()
  mounted.emitTrajectory({
    eventNodes: [],
    runningCalls: [{ callId: 'c9', name: 'skill', argsRaw: '{"name":"ship"}', time: Date.now() }]
  })

  const tree = view.render()
  assert.deepEqual(byClass(tree, 'dsh-cockpit-section').map(textOf), ['正在运行'])
  assert.deepEqual(byClass(tree, 'dsh-cockpit-row-name').map(textOf), ['ship'])
  view.cleanups.forEach(cleanup => cleanup())
})

test('clicking a used skill copies its slash command', async () => {
  const mounted = mount({ trajectory: usageSnapshot() })
  const view = createPanelRenderer(mounted, mounted.panel.inject('s1'))
  view.render()
  const rows = byClass(view.render(), 'dsh-cockpit-row')
  const ship = rows.find(row => textOf(byClass(row, 'dsh-cockpit-row-name')[0]) === 'ship')
  ship.props.onClick()
  await view.settle()

  assert.deepEqual(mounted.copied, ['/ship '])
  assert.match(textOf(view.render()), /已复制 \/ship/)
  view.cleanups.forEach(cleanup => cleanup())
})

test('the panel still registers when the slash menu cannot', () => {
  const mounted = mount({ withInputTriggers: false })
  assert.equal(mounted.registered.length, 0, 'no slash source without the input-trigger service')
  assert.ok(mounted.panel.definition, 'the sidebar panel is independent of the slash menu')
  assert.ok(mounted.panel.component)
})
