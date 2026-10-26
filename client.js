// DSH Skill Cockpit — client bundle.
//
// Turns the flat `/` skill list into grouped folders with Tab drill-down, and
// (下一步) adds a cockpit tab to the right sidebar.
//
// Contract notes (verified against the harness sources, do not guess):
//   * `InputTriggerCandidate.drill` is a BOOLEAN flag, not a callback.
//     `.../ui-input-trigger/src/types.ts:72`
//   * A drill pick reaches `onPick` with `action: 'drill'`; the text it returns
//     replaces the token and, with `continue: true`, re-opens the menu on the
//     new query. `.../ui-input-trigger/src/client/controller.ts:591`
//   * `header(session, req)` publishes breadcrumbs; a crumb pick routes back
//     through `onPick` with `action: 'drill'`. (same file, `pickCrumb`)
//   * Skill catalog RPC: `ctx.remote.skills.list({ sessionId }, signal)` returns
//     `{ ok, value: { skills } }`.
window.__ModuleLoader__.load({
  id: '@local/dsh-cockpit',
  factory: function (require) {
    // --- 1. Groups and the wildcard matcher ---
    var DEFAULT_GROUPS = [
      {
        id: 'gstack',
        name: '⚡ gstack 工作流',
        priority: 100,
        icon: '⚡',
        description: '全流程自动化交付、代码审查、浏览器测试与发布套件',
        patterns: [
          'gstack*', 'browse', 'qa', 'qa-only', 'ship', 'canary', 'review', 'investigate',
          'autoplan', 'devex-review', 'careful', 'guard', 'freeze', 'unfreeze', 'learn',
          'retro', 'spec', 'health', 'cso', 'codex', 'benchmark*', 'connect-chrome',
          'context-*', 'design-*', 'document-*', 'ios-*', 'land-and-deploy', 'landing-report',
          'make-pdf', 'office-hours', 'open-gstack-browser', 'pair-agent', 'plan-*', 'scrape',
          'setup-*', 'skillify', 'sync-gbrain'
        ]
      },
      {
        id: 'hmos',
        name: '📱 鸿蒙与 ArkUI',
        priority: 90,
        icon: '📱',
        description: 'OpenHarmony / HarmonyOS Next、ArkTS/ArkUI 开发与 Kit 集成',
        patterns: ['hmos-*', 'arkui*', 'arkuix*']
      },
      {
        id: 'media',
        name: '🎬 漫剧与视听创作',
        priority: 80,
        icon: '🎬',
        description: '漫剧工坊、Minimax H3 导演工作流、Krea2、漫画与音视频制作',
        patterns: [
          'manju-*', 'minimax-*', 'krea*', 'fujimoto-*', 'motion-canvas', 'remotion-*',
          'infinitetalk', 'audio-production*', 'tts-*', 'cinematic-*', 'seedance-*',
          'storyboard-*', 'video-*', 'asset-*', 'gpt-image*'
        ]
      },
      {
        id: 'script',
        name: '✍️ 编剧与文学',
        priority: 75,
        icon: '✍️',
        description: '主编剧、分集规划、人物世界观、大纲细纲与审稿工作流',
        patterns: [
          'jubenshi*', 'novel-*', 'screenplay-*', 'creative-writing*', 'fiction',
          'history-long-video*'
        ]
      },
      {
        id: 'craft',
        name: '💻 代码手艺与审查',
        priority: 70,
        icon: '💻',
        description: '结构内聚、代码正确性、演化重构、安全防御与严谨审查',
        patterns: [
          'craft-*', 'code-review*', 'cascade-review', 'caveman-review', 'receiving-code-review',
          'requesting-code-review', 'review-pr', 'local-code-*', 'trusted-patch',
          'diagnosing-bugs', 'git-safety', 'git-guardrails*', 'minimal-change',
          'architect', 'codebase-design', 'design-an-interface', 'tdd', 'terse-coder'
        ]
      },
      {
        id: 'product',
        name: '📊 产品策划与架构',
        priority: 60,
        icon: '📊',
        description: '商业天演论、PRD 切片、机会地图、用户画像与路线图',
        patterns: [
          'product-*', 'prd-*', 'situation-design', 'user-model*', 'user-persona',
          'user-story*', 'destination-first*', 'jobs-to-be-done', 'lean-ux*',
          'opportunity-*', 'prioritization*', 'problem-*', 'roadmap-*', 'epic-*',
          'discovery-*', 'proto-persona'
        ]
      },
      {
        id: 'growth',
        name: '📢 增长运营与自媒体',
        priority: 50,
        icon: '📢',
        description: '小红书全链路、AI SEO、推文发布、A/B 测试与营销策略',
        patterns: [
          '*xhs*', 'xiaohongshu*', 'shuyu-xhs*', 'ai-seo', 'seo-*', 'programmatic-seo',
          'content-*', 'social-media*', 'moltbook', 'x-article*', 'ad-creative',
          'ab-testing', 'analytics', 'churn-prevention', 'cold-email', 'emails',
          'launch', 'marketing-*', 'onboarding', 'sales-enablement'
        ]
      },
      {
        id: 'tools',
        name: '🛠️ 通用工具与办公',
        priority: 40,
        icon: '🛠️',
        description: 'Office 格式处理、PDF、图表生成、文档解析与基础组件',
        patterns: [
          'office-*', 'make-pdf', 'antinet-*', 'archify', 'diagram',
          'icon-generator', 'baoyu-*', 'obsidian-*', 'accessibility', 'flue'
        ]
      }
    ]

    var FALLBACK_GROUP = {
      id: 'other',
      name: '📦 其他实用技能',
      priority: 0,
      icon: '📦',
      description: '其他可用系统与自定义扩展技能',
      patterns: ['*']
    }

    /** Leading/trailing `*` wildcard match: `gstack*`, `*xhs*`, `craft-*`. */
    function matchPattern(name, pattern) {
      if (pattern === '*') return true
      var prefix = pattern.charAt(0) !== '*'
      var suffix = pattern.charAt(pattern.length - 1) !== '*'
      var core = pattern
      if (!prefix) core = core.slice(1)
      if (!suffix) core = core.slice(0, -1)
      if (core === '') return true
      if (prefix && suffix) return name === core
      if (prefix) return name.slice(0, core.length) === core
      if (suffix) return name.length >= core.length && name.slice(-core.length) === core
      return name.indexOf(core) !== -1
    }

    function matchSkillGroup(name, groups) {
      var sorted = sortGroups(groups)
      for (var i = 0; i < sorted.length; i++) {
        var patterns = sorted[i].patterns || []
        for (var j = 0; j < patterns.length; j++) {
          if (matchPattern(name, patterns[j])) return sorted[i]
        }
      }
      return FALLBACK_GROUP
    }

    function sortGroups(groups) {
      return groups.slice().sort(function (a, b) {
        return (b.priority || 0) - (a.priority || 0)
      })
    }

    function loadCockpitConfig() {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('dsh.cockpit.config')
          if (raw) {
            var parsed = JSON.parse(raw)
            if (parsed && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
              return { groups: parsed.groups, replaceNative: parsed.replaceNative !== false }
            }
          }
        }
      } catch (error) {
        console.warn('[dsh-cockpit] config unreadable, using defaults:', error)
      }
      return { groups: DEFAULT_GROUPS, replaceNative: true }
    }

    function saveCockpitConfig(config) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('dsh.cockpit.config', JSON.stringify(config))
        }
      } catch (error) {
        console.warn('[dsh-cockpit] config not saved:', error)
      }
    }

    // --- 2. Candidate building ---

    /** `{ kind: 'group', id }` / `{ kind: 'root' }` as the opaque pick payload. */
    function encode(payload) {
      return JSON.stringify(payload)
    }

    function decode(value) {
      if (typeof value !== 'string' || value === '') return undefined
      try {
        var parsed = JSON.parse(value)
        return parsed && typeof parsed.kind === 'string' ? parsed : undefined
      } catch (error) {
        return undefined
      }
    }

    function byName(a, b) {
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    }

    /** Bucket the catalog into the configured groups, dropping empty ones. */
    function bucketSkills(skills, groups) {
      var buckets = []
      var byId = {}
      var ordered = sortGroups(groups).concat([FALLBACK_GROUP])
      for (var i = 0; i < ordered.length; i++) {
        var group = ordered[i]
        if (byId[group.id]) continue
        var bucket = { group: group, skills: [] }
        byId[group.id] = bucket
        buckets.push(bucket)
      }
      for (var j = 0; j < skills.length; j++) {
        var skill = skills[j]
        var home = matchSkillGroup(skill.name, groups)
        var target = byId[home.id] || byId[FALLBACK_GROUP.id]
        target.skills.push(skill)
      }
      for (var k = 0; k < buckets.length; k++) buckets[k].skills.sort(byName)
      return buckets.filter(function (bucket) { return bucket.skills.length > 0 })
    }

    function folderRow(group, count) {
      return {
        name: group.id + '/',
        label: group.name,
        description: (group.description ? group.description + ' · ' : '') + count + ' 个技能 · Tab 进入',
        icon: 'folder',
        drill: true,
        value: encode({ kind: 'group', id: group.id })
      }
    }

    function skillRow(skill, section) {
      return {
        name: skill.name,
        description: skill.description,
        value: encode({ kind: 'skill', name: skill.name }),
        ...(section === undefined ? {} : { section: section })
      }
    }

    function matches(text, needle) {
      return typeof text === 'string' && text.toLowerCase().indexOf(needle) !== -1
    }

    /** Rows for one drilled-in group, filtered by the text typed after the slash. */
    function groupRows(bucket, filter) {
      var rows = []
      var section = bucket.group.name
      for (var i = 0; i < bucket.skills.length; i++) {
        var skill = bucket.skills[i]
        if (filter !== '' && !matches(skill.name, filter) && !matches(skill.description, filter)) continue
        rows.push(skillRow(skill, section))
      }
      return rows
    }

    /**
     * The rows for one query.
     *
     * `<groupId>/<filter>` lists one group; anything else is the root: folders
     * when nothing is typed, folders plus matching skills when searching.
     */
    function buildCandidates(skills, query, groups) {
      var buckets = bucketSkills(skills, groups)
      var trimmed = (query || '').trim()
      var slash = trimmed.indexOf('/')
      if (slash >= 0) {
        var groupId = trimmed.slice(0, slash)
        var filter = trimmed.slice(slash + 1).trim().toLowerCase()
        for (var i = 0; i < buckets.length; i++) {
          if (buckets[i].group.id === groupId) return groupRows(buckets[i], filter)
        }
      }
      var needle = trimmed.toLowerCase()
      if (needle === '') {
        return buckets.map(function (bucket) { return folderRow(bucket.group, bucket.skills.length) })
      }
      // Search across groups: a folder that matches stays reachable, and every
      // matching skill shows under its own group heading.
      var rows = []
      for (var f = 0; f < buckets.length; f++) {
        var group = buckets[f].group
        if (matches(group.name, needle) || matches(group.id, needle) || matches(group.description, needle)) {
          rows.push(folderRow(group, buckets[f].skills.length))
        }
      }
      for (var g = 0; g < buckets.length; g++) {
        var bucket = buckets[g]
        for (var s = 0; s < bucket.skills.length; s++) {
          var skill = bucket.skills[s]
          if (matches(skill.name, needle) || matches(skill.description, needle)) {
            rows.push(skillRow(skill, bucket.group.name))
          }
        }
      }
      return rows
    }

    /** Breadcrumbs for a drilled listing: the root and the open group. */
    function buildHeader(query, drilled, groups) {
      if (!drilled) return undefined
      var trimmed = (query || '').trim()
      var slash = trimmed.indexOf('/')
      if (slash < 0) return undefined
      var groupId = trimmed.slice(0, slash)
      var group = undefined
      var ordered = sortGroups(groups).concat([FALLBACK_GROUP])
      for (var i = 0; i < ordered.length; i++) {
        if (ordered[i].id === groupId) group = ordered[i]
      }
      if (group === undefined) return undefined
      return [
        { label: '技能分类', value: encode({ kind: 'root' }) },
        { label: group.name, value: encode({ kind: 'group', id: group.id }), current: true }
      ]
    }

    // --- 3. Plugin body ---

    /**
     * The live source roster behind `ctx.inputTriggers`.
     *
     * The published contract only faces `registerSource`/`sessionOf`, but the
     * service keeps every source in one array and hands that same array to each
     * session controller, so replacing the native flat source means editing it.
     * Read defensively: when the field is gone we fall back to registering our
     * own source and accept that the native list stays next to it.
     */
    function liveSources(inputTriggers) {
      var live = inputTriggers === undefined ? undefined : inputTriggers.live
      if (live && Array.isArray(live.sources)) return live.sources
      return undefined
    }

    function findNativeSkillSource(inputTriggers) {
      var list = liveSources(inputTriggers)
      if (list === undefined) return undefined
      for (var i = 0; i < list.length; i++) {
        var entry = list[i]
        if (entry && entry.trigger === '/' && entry.name === 'skill') return entry
      }
      return undefined
    }

    return {
      inject: ['inputTriggers', 'sessions', 'remote', 'remote.skills'],
      apply: function (ctx) {
        var skillsRemote = ctx.remote && ctx.remote.skills
        var sessions = ctx.sessions
        var inputTriggers = ctx.get('inputTriggers')
        if (!skillsRemote || !inputTriggers) {
          console.warn('[dsh-cockpit] required services missing; slash grouping disabled')
          return
        }

        var config = loadCockpitConfig()

        function isSubagent(session) {
          return sessions && typeof sessions.subagentAddress === 'function' &&
            sessions.subagentAddress(session.sessionId) !== undefined
        }

        function candidatesFor(session, request) {
          if (isSubagent(session)) return Promise.resolve([])
          var signal = request.signal
          return skillsRemote.list({ sessionId: session.sessionId }, signal).then(function (result) {
            if (signal && signal.aborted) return []
            if (!result || !result.ok) {
              console.warn('[dsh-cockpit] skills/list failed:', result && result.error)
              return []
            }
            var skills = (result.value && result.value.skills) || []
            return buildCandidates(skills, request.query, config.groups)
          }, function (error) {
            console.warn('[dsh-cockpit] skills/list rejected:', error)
            return []
          })
        }

        function headerFor(session, request) {
          return buildHeader(request.query, request.drilled, config.groups)
        }

        function pickFor(pick) {
          var payload = decode(pick.candidate.value)
          if (payload && payload.kind === 'group') {
            // Descend: the replacement text is the whole new token, trigger
            // included, because the pick replaces trigger+query under the caret.
            return { text: '/' + payload.id + '/', continue: true }
          }
          if (payload && payload.kind === 'root') {
            return { text: '/', continue: true }
          }
          return { text: '/' + pick.candidate.name + ' ' }
        }

        // Preferred path: take the native '/' source over in place. One list,
        // and whatever else that source provides (lexicon, reference preview)
        // keeps working. The fields are `readonly` in TypeScript only.
        var native = config.replaceNative === false
          ? undefined
          : findNativeSkillSource(inputTriggers)
        if (native !== undefined) {
          try {
            native.candidates = candidatesFor
            native.header = headerFor
            native.onPick = pickFor
            return
          } catch (error) {
            console.warn('[dsh-cockpit] native source not writable, registering a second one:', error)
          }
        }

        /** Hide a native source that registers after us (its order is not ours to pick). */
        function dropNativeSkillSource() {
          if (config.replaceNative === false) return
          var list = liveSources(inputTriggers)
          if (list === undefined) return
          for (var i = list.length - 1; i >= 0; i--) {
            if (list[i] && list[i].trigger === '/' && list[i].name === 'skill') list.splice(i, 1)
          }
        }

        var source = {
          trigger: '/',
          name: 'skill-cockpit',
          order: 2,
          candidates: function (session, request) {
            if (config.replaceNative !== false) dropNativeSkillSource()
            return candidatesFor(session, request)
          },
          header: headerFor,
          onPick: pickFor
        }

        ctx.effect(function () {
          var unregister = inputTriggers.registerSource(source)
          return function () { unregister() }
        }, 'dsh-cockpit: grouped slash source')
      }
    }
  }
})
