    // --- 4. Right-sidebar cockpit panel ---
    //
    // The panel answers one question: which skills are in play right now, and
    // which ones this session already used. That is Session data, not catalog
    // data: a skill load is written either as a `skill` tool call (model-
    // invoked) or as the literal `/name` user message the host's pre-step
    // injection recognises, so both are read off the per-session Trajectory
    // target. `runningCalls` carries the in-flight ones.
    //
    // A tab type is two registrations: the static `SidebarRightTabDefinition`
    // (id/kind/title/guide) into `sidebarRightTabs`, and the body under the very
    // same `id` into the keyed seat `sidebar.right.pane.tab`
    // (`ui-sidebar-right/src/client/contract/slots.ts:40-95`). The body gets the
    // session id through its `inject` props factory — the same shape
    // `ui-sidebar-browser/src/client/index.ts:39-42` uses.

    var COCKPIT_TAB_ID = '@local/dsh-cockpit:panel'
    var COCKPIT_TAB_KIND = 'skill-cockpit'
    var SKILL_TOOL = 'skill'
    var USAGE_KEY = 'dsh.cockpit.usage'
    var SESSIONS
    var ROOT_CTX
    var EMPTY_TRAJECTORY = { eventNodes: [], runningCalls: [] }

    var PANEL_CSS = [
      '.dsh-cockpit-panel{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;font-size:12.5px;color:inherit}',
      '.dsh-cockpit-head{display:flex;align-items:baseline;gap:8px;padding:10px 12px 6px}',
      '.dsh-cockpit-title{font-weight:600;font-size:13px}',
      '.dsh-cockpit-sub{opacity:.55;font-size:11px;font-variant-numeric:tabular-nums}',
      '.dsh-cockpit-action{margin-left:auto;border:0;background:transparent;color:inherit;opacity:.55;cursor:pointer;font:inherit;font-size:11px;padding:2px 5px;border-radius:4px}',
      '.dsh-cockpit-action:hover{opacity:1;background:rgba(127,127,127,.16)}',
      '.dsh-cockpit-search{margin:0 12px 8px;padding:5px 8px;border:1px solid rgba(127,127,127,.3);border-radius:6px;background:rgba(127,127,127,.08);color:inherit;font:inherit;font-size:12px;outline:none}',
      '.dsh-cockpit-search:focus{border-color:rgba(127,127,127,.55)}',
      '.dsh-cockpit-list{flex:1;min-height:0;overflow:auto;padding:0 8px 8px}',
      '.dsh-cockpit-section{display:flex;align-items:baseline;gap:6px;padding:9px 4px 3px;font-size:11px;font-weight:600;opacity:.62}',
      '.dsh-cockpit-row{display:flex;flex-direction:column;gap:1px;width:100%;border:0;background:transparent;color:inherit;cursor:pointer;padding:4px 6px;border-radius:5px;font:inherit;text-align:left}',
      '.dsh-cockpit-row:hover{background:rgba(127,127,127,.14)}',
      '.dsh-cockpit-row-main{display:flex;align-items:baseline;gap:6px;min-width:0;width:100%}',
      '.dsh-cockpit-row-label{font-size:12px;white-space:nowrap}',
      '.dsh-cockpit-row-name{opacity:.45;font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-cockpit-meta{margin-left:auto;opacity:.45;font-size:10.5px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dsh-cockpit-live{color:#6fbf8f;font-weight:600}',
      '.dsh-cockpit-failed{color:#e0a79b}',
      '.dsh-cockpit-row-desc{opacity:.55;font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.dsh-cockpit-empty{padding:18px 12px;opacity:.55;text-align:center;font-size:12px;line-height:1.6}',
      '.dsh-cockpit-error{padding:14px 12px;font-size:12px;color:#e0a79b}',
      '.dsh-cockpit-foot{padding:6px 12px 10px;opacity:.45;font-size:11px;border-top:1px solid rgba(127,127,127,.18)}',
      '.dsh-cockpit-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(38,38,38,.94);color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;pointer-events:none;white-space:nowrap}'
    ].join('')

    /**
     * Text carried by a message's content blocks.
     *
     * Read defensively by `text`, because the bundle ships to clients whose
     * content-block union is not literally this build's.
     */
    function blocksText(blocks) {
      if (blocks === undefined || blocks === null || typeof blocks.length !== 'number') return ''
      var text = ''
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i]
        if (block === undefined || block === null) continue
        if (typeof block.text === 'string') text += block.text
      }
      return text
    }

    /** The skill a call names, or undefined when the call is not a skill load. */
    function skillNameOfCall(call) {
      if (call === undefined || call === null) return undefined
      if (call.name !== SKILL_TOOL) return undefined
      var args = call.argsRaw
      if (typeof args !== 'string' || args === '') return undefined
      try {
        var parsed = JSON.parse(args)
        var name = parsed === undefined || parsed === null ? undefined : parsed.name
        if (typeof name === 'string' && name !== '') return name
      } catch (error) {
        // Fall through to the tolerant read: a truncated argsRaw is still a name.
      }
      var match = /"name"\s*:\s*"([^"]+)"/.exec(args)
      return match === null ? undefined : match[1]
    }

    /** `/name` at the head of a user message — the literal slash invocation. */
    function slashSkillOf(text) {
      if (typeof text !== 'string') return undefined
      var match = /^\s*\/([A-Za-z0-9][A-Za-z0-9._:-]*)(\s|$)/.exec(text)
      return match === null ? undefined : match[1]
    }

    function bumpSkill(map, name, time, failed) {
      var entry = map[name]
      if (entry === undefined) {
        entry = { name: name, count: 0, last: 0, failed: false }
        map[name] = entry
      }
      entry.count += 1
      if (typeof time === 'number' && time > entry.last) entry.last = time
      if (failed === true) entry.failed = true
      return entry
    }

    /** Nested dispatch (PTC) keeps child calls, so walk them too. */
    function collectCalls(calls, used, running) {
      if (calls === undefined || calls === null || typeof calls.length !== 'number') return
      for (var i = 0; i < calls.length; i++) {
        var call = calls[i]
        if (call === undefined || call === null) continue
        var name = skillNameOfCall(call)
        if (name !== undefined) {
          if (running === undefined) {
            bumpSkill(used, name, Math.max(call.time || 0, call.callTime || 0), call.isError === true)
          } else {
            running[name] = { name: name, time: call.time || 0 }
          }
        }
        collectCalls(call.subCalls, used, running)
      }
    }

    /**
     * Which skills this session is using and has used.
     *
     * `used` counts settled loads (tool results and literal slash messages);
     * `running` holds the calls still in flight, which have no result yet and
     * therefore never reach the history.
     */
    function collectUsage(snapshot) {
      var used = {}
      var running = {}
      var nodes = snapshot === undefined || snapshot === null || snapshot.eventNodes === undefined
        ? [] : snapshot.eventNodes
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i]
        if (node === undefined || node === null) continue
        if (node.kind === 'tool-result') {
          var name = skillNameOfCall(node.call)
          if (name !== undefined) {
            bumpSkill(used, name, Math.max(node.time || 0, node.callTime || 0), node.isError === true)
          }
          collectCalls(node.subCalls, used, undefined)
        } else if (node.kind === 'user') {
          var slash = slashSkillOf(blocksText(node.content))
          if (slash !== undefined) bumpSkill(used, slash, node.time, false)
        }
      }
      collectCalls(snapshot === undefined || snapshot === null ? undefined : snapshot.runningCalls, used, running)
      return { used: used, running: running }
    }

    /** The session's Trajectory snapshot, or undefined when nothing is open. */
    function trajectorySource(sessionId) {
      if (sessionId === undefined || sessionId === null || sessionId === '') return undefined
      var root = ROOT_CTX
      if (root === undefined || root === null || typeof root.get !== 'function') return undefined
      try {
        var sessions = root.get('sessions')
        var conversation = root.get('uiConversation')
        if (sessions === undefined || sessions === null || conversation === undefined || conversation === null) {
          return undefined
        }
        var binding = sessions.binding(sessionId)
        if (binding === undefined || binding === null) return undefined
        var target = conversation.binding(binding).target('trajectory')
        if (target === undefined || target === null) return undefined
        return {
          getSnapshot: function () {
            var snapshot = target.getSnapshot()
            return snapshot === undefined || snapshot === null ? EMPTY_TRAJECTORY : snapshot
          },
          subscribe: function (listener) { return target.subscribe(listener) }
        }
      } catch (error) {
        console.warn('[dsh-cockpit] the session trajectory is unavailable:', error)
        return undefined
      }
    }

    function readUsageLedger() {
      var empty = { sessions: {}, totals: {} }
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return empty
        var raw = localStorage.getItem(USAGE_KEY)
        if (typeof raw !== 'string' || raw === '') return empty
        var parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return empty
        return {
          sessions: parsed.sessions === undefined || parsed.sessions === null ? {} : parsed.sessions,
          totals: parsed.totals === undefined || parsed.totals === null ? {} : parsed.totals
        }
      } catch (error) {
        return empty
      }
    }

    function writeUsageLedger(ledger) {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return
        localStorage.setItem(USAGE_KEY, JSON.stringify(ledger))
      } catch (error) {
        console.warn('[dsh-cockpit] the usage ledger could not be saved:', error)
      }
    }

    /**
     * Fold a session's absolute counts into the cross-session ledger.
     *
     * The snapshot reports totals for the whole session, so the ledger keeps
     * each session's last seen count and adds only the difference — replaying
     * the same snapshot twice must not inflate the history.
     */
    function ledgerBump(sessionId, used) {
      var ledger = readUsageLedger()
      if (sessionId === undefined || sessionId === null || sessionId === '') return ledger.totals
      var key = String(sessionId)
      var mine = ledger.sessions[key] === undefined ? {} : ledger.sessions[key]
      var totals = ledger.totals
      var changed = false
      for (var name in used) {
        var current = used[name]
        var seen = mine[name]
        var delta = current.count - (seen === undefined ? 0 : seen.count)
        if (delta > 0) {
          var total = totals[name]
          if (total === undefined) {
            total = { count: 0, last: 0 }
            totals[name] = total
          }
          total.count += delta
          if (current.last > total.last) total.last = current.last
          changed = true
        }
        if (seen === undefined || seen.count !== current.count || seen.last !== current.last) {
          mine[name] = { count: current.count, last: current.last }
          changed = true
        }
      }
      if (changed === true) {
        ledger.sessions[key] = mine
        writeUsageLedger(ledger)
      }
      return totals
    }

    function matchesSkillName(name, needle) {
      if (needle === '') return true
      if (name.toLowerCase().indexOf(needle) !== -1) return true
      var zh = zhOf(name)
      if (zh === undefined) return false
      if (zh.l !== undefined && zh.l.toLowerCase().indexOf(needle) !== -1) return true
      return zh.d !== undefined && zh.d.toLowerCase().indexOf(needle) !== -1
    }

    function agoText(time) {
      if (typeof time !== 'number' || time <= 0) return ''
      var diff = Date.now() - time
      if (diff < 0) diff = 0
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
      return Math.floor(diff / 86400000) + ' 天前'
    }

    /**
     * The three sections the panel shows, filtered by the search box.
     *
     * Kept out of the component so the ordering rule (most recent first) is
     * testable without a DOM.
     */
    function usageModel(usage, totals, query) {
      var needle = (query || '').trim().toLowerCase()
      var running = []
      var mine = []
      var all = []
      var name
      for (name in usage.running) {
        if (matchesSkillName(name, needle)) running.push({ name: name, running: true })
      }
      for (name in usage.used) {
        if (!matchesSkillName(name, needle)) continue
        var entry = usage.used[name]
        mine.push({ name: name, count: entry.count, last: entry.last, failed: entry.failed })
      }
      for (name in totals) {
        if (!matchesSkillName(name, needle)) continue
        var total = totals[name]
        all.push({ name: name, count: total.count, last: total.last })
      }
      var recent = function (left, right) { return (right.last || 0) - (left.last || 0) }
      mine.sort(recent)
      all.sort(recent)
      running.sort(function (left, right) { return left.name.localeCompare(right.name) })
      return { running: running, mine: mine, all: all }
    }

    /** Copy `/name ` — the clipboard API, with the textarea trick as the fallback. */
    function copyCommand(name, done) {
      var text = '/' + name + ' '
      var fallback = function () {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', '')
          area.style.position = 'fixed'
          area.style.top = '-1000px'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
        } catch (error) {
          console.warn('[dsh-cockpit] copy failed:', error)
        }
        done(text)
      }
      if (typeof navigator !== 'undefined' && navigator !== null && navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(function () { done(text) }, fallback)
        return
      }
      fallback()
    }

    function usageRowElement(row, copied, copy, setCopied) {
      var zh = zhOf(row.name)
      var label = zh !== undefined && zh.l !== undefined ? zh.l : row.name
      var desc = zh !== undefined && zh.d !== undefined ? zh.d : ''
      var meta
      if (row.running === true) {
        meta = React.createElement('span', { className: 'dsh-cockpit-meta dsh-cockpit-live', key: 'meta' }, '运行中')
      } else {
        var parts = []
        if (row.count !== undefined && row.count > 0) parts.push(row.count + ' 次')
        if (row.last !== undefined && row.last > 0) parts.push(agoText(row.last))
        if (row.failed === true) parts.push('上次失败')
        meta = React.createElement('span', {
          className: row.failed === true ? 'dsh-cockpit-meta dsh-cockpit-failed' : 'dsh-cockpit-meta',
          key: 'meta'
        }, parts.join(' · '))
      }
      return React.createElement('button', {
        className: 'dsh-cockpit-row',
        type: 'button',
        key: 'u:' + row.name,
        title: (desc === '' ? '' : desc + '\n') + '/' + row.name,
        onClick: function () {
          copy(row.name, function () { setCopied('/' + row.name + ' ') })
        }
      },
        React.createElement('span', { className: 'dsh-cockpit-row-main' },
          React.createElement('span', { className: 'dsh-cockpit-row-label' }, label),
          label === row.name ? null : React.createElement('span', { className: 'dsh-cockpit-row-name' }, row.name),
          meta
        ),
        desc === '' ? null : React.createElement('span', { className: 'dsh-cockpit-row-desc' }, desc)
      )
    }

    function sectionElement(title, rows, copied, copy, setCopied, key) {
      if (rows.length === 0) return null
      var children = [React.createElement('div', { className: 'dsh-cockpit-section', key: 'title' }, title)]
      for (var i = 0; i < rows.length; i++) {
        children.push(usageRowElement(rows[i], copied, copy, setCopied))
      }
      return React.createElement('div', { className: 'dsh-cockpit-group', key: key }, children)
    }

    function CockpitPanel(props) {
      var sessionId = props === undefined ? undefined : props.sessionId

      var usagePair = React.useState({ used: {}, running: {} })
      var totalsPair = React.useState({})
      var queryPair = React.useState('')
      var copiedPair = React.useState('')
      var problemPair = React.useState('')
      var tickPair = React.useState(0)

      var usage = usagePair[0]
      var totals = totalsPair[0]
      var query = queryPair[0]
      var copied = copiedPair[0]
      var problem = problemPair[0]
      var tick = tickPair[0]

      React.useEffect(function () {
        var cancelled = false
        var source = trajectorySource(sessionId)
        if (source === undefined) {
          problemPair[1]('读不到这个会话的轨迹：它可能还没打开，或本版本没有轨迹服务')
          usagePair[1]({ used: {}, running: {} })
          return undefined
        }
        var applySnapshot = function (snapshot) {
          if (cancelled) return
          var next = collectUsage(snapshot)
          usagePair[1](next)
          totalsPair[1](ledgerBump(sessionId, next.used))
          problemPair[1]('')
        }
        applySnapshot(source.getSnapshot())
        var unsubscribe = source.subscribe(function () { applySnapshot(source.getSnapshot()) })
        return function () {
          cancelled = true
          if (typeof unsubscribe === 'function') unsubscribe()
        }
      }, [sessionId, tick])

      React.useEffect(function () {
        if (copied === '') return undefined
        var timer = setTimeout(function () { copiedPair[1]('') }, 1200)
        return function () { clearTimeout(timer) }
      }, [copied])

      var model = usageModel(usage, totals, query)
      var usedCount = 0
      for (var name in usage.used) usedCount += 1
      var totalCount = 0
      for (var total in totals) totalCount += 1

      var head = React.createElement('div', { className: 'dsh-cockpit-head', key: 'head' },
        React.createElement('span', { className: 'dsh-cockpit-title' }, '技能驾驶舱'),
        React.createElement('span', { className: 'dsh-cockpit-sub' },
          '本会话 ' + usedCount + ' 个 · 累计 ' + totalCount + ' 个'),
        React.createElement('button', {
          className: 'dsh-cockpit-action',
          type: 'button',
          title: '重新读取会话记录',
          onClick: function () { tickPair[1](tick + 1) }
        }, '刷新')
      )

      var search = React.createElement('input', {
        className: 'dsh-cockpit-search',
        key: 'search',
        type: 'search',
        placeholder: '在用的和用过的里搜',
        value: query,
        onChange: function (event) { queryPair[1](event.target.value) }
      })

      var children = []
      if (problem !== '') {
        children.push(React.createElement('div', { className: 'dsh-cockpit-error', key: 'problem' }, problem))
      }
      var usedNow = sectionElement('正在运行', model.running, copied, copyCommand, copiedPair[1], 'running')
      if (usedNow !== null) children.push(usedNow)
      var sessionRows = sectionElement('本会话用过', model.mine, copied, copyCommand, copiedPair[1], 'mine')
      if (sessionRows !== null) children.push(sessionRows)
      var ledgerRows = sectionElement('全部会话累计', model.all, copied, copyCommand, copiedPair[1], 'all')
      if (ledgerRows !== null) children.push(ledgerRows)
      if (children.length === 0 && problem === '') {
        children.push(React.createElement('div', { className: 'dsh-cockpit-empty', key: 'empty' },
          query === ''
            ? '这个会话还没用过技能。在输入框敲 / 选一个，用过的会出现在这里。'
            : '没找到：' + query))
      }

      var foot = React.createElement('div', { className: 'dsh-cockpit-foot', key: 'foot' },
        '点一下复制斜杠命令；「全部会话累计」是本机历史记账')
      var toast = copied === ''
        ? null
        : React.createElement('div', { className: 'dsh-cockpit-toast', key: 'toast' }, '已复制 ' + copied)

      return React.createElement('div', { className: 'dsh-cockpit-panel' },
        head, search, React.createElement('div', { className: 'dsh-cockpit-list' }, children), foot, toast)
    }

    /** Inject the panel stylesheet once; the tab body renders many times over. */
    function installPanelStyles() {
      if (typeof document === 'undefined' || document.head === undefined) return
      var id = 'dsh-cockpit-styles'
      if (document.getElementById(id) !== null) return
      var style = document.createElement('style')
      style.id = id
      style.textContent = PANEL_CSS
      document.head.appendChild(style)
    }

    /**
     * Register the cockpit tab type and its body.
     *
     * Declared through `ctx.inject` rather than the module `inject` list so a
     * build without the sidebar package still gets the grouped slash menu —
     * losing a sidebar is not a reason to lose the menu.
     */
    function registerPanel(ctx) {
      if (React === undefined) return
      ctx.inject(['sidebarRightTabs', 'slots'], function (owner) {
        var tabs = owner.get('sidebarRightTabs')
        if (tabs === undefined) return
        // `owner.slots` is how `ui-sidebar-browser` reaches the seat; `get` is
        // the same service without relying on the property accessor.
        var slots = owner.slots !== undefined && owner.slots !== null ? owner.slots : owner.get('slots')
        owner.effect(function () {
          return tabs.register({
            id: COCKPIT_TAB_ID,
            kind: COCKPIT_TAB_KIND,
            priority: 'extension',
            title: function () { return '驾驶舱' },
            guide: [{
              id: 'open',
              order: 60,
              title: function () { return '技能驾驶舱' },
              description: function () { return '正在运行和用过的技能，点一下复制斜杠命令' }
            }]
          })
        }, 'dsh-cockpit: sidebar tab type')
        if (slots === undefined) {
          console.warn('[dsh-cockpit] slots service missing; the cockpit tab has no body')
          return
        }
        owner.effect(function () {
          return slots.register({
            name: 'sidebar.right.pane.tab',
            key: COCKPIT_TAB_ID,
            inject: function (sessionId) { return { sessionId: sessionId } }
          }, CockpitPanel)
        }, 'dsh-cockpit: sidebar tab body')
      })
    }

