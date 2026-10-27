import io

path = r'G:\AI\Claude-Workspace\Projects\dsh-cockpit\tests\client.test.mjs'

with io.open(path, 'r', encoding='utf-8', newline='') as handle:
    text = handle.read()

# --- 1. the sandbox gets a clock -------------------------------------------
old_context_tail = """    JSON,
    Promise,
    AbortController,
    setTimeout,
    clearTimeout
  }
"""
new_context_tail = """    JSON,
    Promise,
    AbortController,
    Date,
    setTimeout,
    clearTimeout
  }
"""
assert old_context_tail in text
text = text.replace(old_context_tail, new_context_tail, 1)

# --- 2. the panel reads Session data, so the mount serves it ----------------
old_head = """  const disposers = []
  const panel = { definition: undefined, component: undefined, inject: undefined, slotName: undefined, key: undefined }
  const ctx = {
    remote: {
      skills: {
        list: async () => (options.listFails === true
          ? { ok: false, error: '技能服务不可用' }
          : { ok: true, value: { skills: CATALOG } })
      }
    },
    sessions: { subagentAddress: () => (options.subagent === true ? 'agent/s1/sub' : undefined) },
    get: name => (name === 'inputTriggers' && options.withInputTriggers !== false ? inputTriggers : undefined),
"""
new_head = """  const disposers = []
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
"""
assert old_head in text
text = text.replace(old_head, new_head, 1)

# --- 3. hand the trajectory out --------------------------------------------
old_return = """  return {
    source: registered.length === 1 ? registered[0] : nativeSource,
    registered,
    live,
    nativeSource,
    panel,
    hookRuntime,
    copied,
    dispose: () => disposers.forEach(fn => fn())
  }
"""
new_return = """  return {
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
"""
assert old_return in text
text = text.replace(old_return, new_return, 1)

# --- 4. the panel behaviour tests ------------------------------------------
old_tests_start = "test('the panel lists every skill under its group', async () => {"
old_tests_end = "test('the panel still registers when the slash menu cannot', () => {"
start = text.index(old_tests_start)
end = text.index(old_tests_end)

new_tests = """const usageSnapshot = () => {
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

"""

text = text[:start] + new_tests + text[end:]

with io.open(path, 'w', encoding='utf-8', newline='') as handle:
    handle.write(text)

print('ok', len(text))
