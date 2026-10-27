// A React small enough to drive the sidebar panel in a test.
//
// The body is a function component with hooks, so the harness keeps hook values
// across renders and re-runs an effect only when its dependency list changes —
// the two behaviours the panel actually relies on. Nothing here pretends to be
// React beyond that: no reconciliation, no batching, no context.

/** Walk an element tree, visiting every node object. */
export function walk(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  visit(node)
  for (const child of node.props?.children ?? []) walk(child, visit)
}

/** Every node whose className contains `name`, in render order. */
export function byClass(tree, name) {
  const found = []
  walk(tree, node => {
    if (typeof node.props?.className === 'string' && node.props.className.split(/\s+/).includes(name)) found.push(node)
  })
  return found
}

/** The text a node renders, concatenated depth-first. */
export function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (node === null || node === undefined || typeof node !== 'object') return ''
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.props?.children ?? [])
}

/**
 * Render the registered panel body and let its request settle.
 *
 * @param mounted - the value `mount()` returned, which owns the hook runtime.
 * @param props - the props the tab's `inject` factory would hand the body.
 * @returns the render driver: `render()` for a fresh tree, `settle()` to let
 *   promises resolve, and the effects' cleanups.
 */
export function createPanelRenderer(mounted, props) {
  const store = { values: [], deps: [], pending: [], cursor: 0, dirty: false }
  mounted.hookRuntime.current = {
    useState(initial) {
      const at = store.cursor++
      if (!(at in store.values)) store.values[at] = typeof initial === 'function' ? initial() : initial
      const set = next => {
        store.values[at] = typeof next === 'function' ? next(store.values[at]) : next
        // React re-renders after a state write; the harness has to as well, or
        // state set from an effect would only show up on the caller's next call.
        store.dirty = true
      }
      return [store.values[at], set]
    },
    useEffect(run, watch) {
      const at = store.cursor++
      const prev = store.deps[at]
      const changed = prev === undefined || watch === undefined
        || watch.length !== prev.length || watch.some((value, index) => !Object.is(value, prev[index]))
      store.deps[at] = watch
      if (changed) store.pending.push(run)
    }
  }
  const cleanups = []
  return {
    cleanups,
    render() {
      let tree
      for (let pass = 0; pass < 8; pass += 1) {
        store.cursor = 0
        store.dirty = false
        // The component registers its effects while rendering, so commit them
        // after the tree exists — the same order React uses.
        tree = mounted.panel.component(props)
        const effects = store.pending.splice(0)
        for (const effect of effects) {
          const cleanup = effect()
          if (typeof cleanup === 'function') cleanups.push(cleanup)
        }
        if (store.dirty === false) break
      }
      return tree
    },
    /** Two macrotasks: enough for the mocked `skills.list` promise chain. */
    async settle() {
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))
    }
  }
}
