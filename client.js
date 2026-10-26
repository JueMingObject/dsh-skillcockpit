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
          'setup-*', 'skillify', 'sync-gbrain', 'captain', 'claude', 'deslop-shared-libs',
          'eval-plan', 'hackernews-frontpage', 'memory-curation', 'reuse-gate', 'test-audit'
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
        id: 'film',
        name: '🎬 影视与漫剧',
        priority: 85,
        icon: '🎬',
        description: '影视全流程、漫剧工坊、分镜预演、图像与音视频生成',
        patterns: [
          'film-*', 'ai-film*', 'manju-*', 'minimax-*', 'krea*', 'fujimoto-*',
          'asset-*', 'scene-*', 'shot-*', 'story-*', 'storyboard-*', 'character-*',
          'world-*', 'creative-review', 'director-review', 'foundation-interview',
          'book-binding-*', 'local-revision', 'material-sync', 'music-video',
          'motion-canvas', 'remotion-*', 'video-*', 'gpt-image*', 'cinematic-*',
          'seedance-*', 'tts-*', 'audio-production*', 'infinitetalk'
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
          'discovery-*', 'proto-persona', 'ai-company', 'budget-calculus'
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
          'icon-generator', 'baoyu-*', 'obsidian-*', 'accessibility', 'flue',
          'find-skills', 'alpha', 'beta'
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

    // --- 1b. Chinese layer ---
    //
    // Skill frontmatter is written in English. The menu shows `label` as a row's
    // primary text and keeps the raw `name` beside it as an alias, so translating
    // here renames the row without hiding the identifier people actually type.
    // Generated by `node scripts/embed-i18n.mjs` — edit zh-i18n.json, not this block.

    // <zh:begin>
    var SKILL_ZH = {
      "ai-film-router": {"l":"影视流程路由","d":"把一个影视项目分派到唯一正确的制作阶段"},
      "alpha": {"l":"测试夹具","d":"带模式表与强制读取的固定测试技能"},
      "arkuix-flowlog-diagnose-skill": {"l":"ArkUI-X日志诊断","d":"按 logcat/os_log 排查白屏、卡顿、启动慢与崩溃"},
      "arkuix-migration-skeleton": {"l":"ArkUI-X迁移骨架","d":"为 Stage 工程生成 Android/iOS 壳与共享 ArkTS 骨架"},
      "autoplan": {"l":"自动评审流水线","d":"顺序跑 CEO/设计/工程/DX 四份评审并按决策原则自动裁决"},
      "benchmark": {"l":"性能基准","d":"用浏览守护进程做性能回归检测"},
      "benchmark-models": {"l":"模型横评","d":"对 gstack 技能做跨模型基准对比"},
      "beta": {"l":"测试夹具·净版","d":"无强制读取、无模式表的干净测试技能"},
      "browse": {"l":"无头浏览器","d":"快速无头浏览器，用于站点 QA 与自测"},
      "canary": {"l":"发布后金丝雀","d":"部署后按金丝雀指标盯生产健康"},
      "captain": {"l":"多智能体调度","d":"一个主控带多路编码 agent，分道交付不互相合并"},
      "careful": {"l":"危险命令护栏","d":"破坏性命令执行前的安全提醒"},
      "claude": {"l":"Claude Code 桥","d":"在非 Claude 宿主上调用 Claude Code 的三种模式"},
      "codex": {"l":"Codex 桥","d":"调用 OpenAI Codex CLI 的三种模式"},
      "context-restore": {"l":"恢复上下文","d":"还原之前 /context-save 存下的工作上下文"},
      "context-save": {"l":"保存上下文","d":"把当前工作上下文存档，供之后恢复"},
      "cso": {"l":"安全总裁模式","d":"以首席安全官视角审代码与风险"},
      "design-consultation": {"l":"设计咨询","d":"读懂产品、调研竞品，给出成套设计系统"},
      "design-html": {"l":"设计定稿出页面","d":"生成生产级的 HTML/CSS 页面"},
      "design-review": {"l":"设计评审","d":"按设计维度找视觉不一致、间距层级与 AI 味问题"},
      "design-shotgun": {"l":"设计多方案","d":"批量生成多版设计，开对比板收结构化反馈"},
      "deslop-shared-libs": {"l":"抽公共库","d":"从近期改动里找出值得抽成共享代码的部分"},
      "devex-review": {"l":"开发者体验体检","d":"对真实开发体验做现场审计"},
      "diagram": {"l":"画架构图","d":"把描述或 Mermaid 转成可编辑图并导出"},
      "document-generate": {"l":"补文档","d":"给功能、模块或整仓从零生成缺失文档"},
      "document-release": {"l":"发版文档","d":"发布后更新文档与变更说明"},
      "eval-plan": {"l":"评测预注册","d":"先登记分臂、基线、停止规则，再零成本演练并核价"},
      "film-acting": {"l":"表演层","d":"只为已定场次写表演与演出块"},
      "film-characters": {"l":"人物设定","d":"只为已定梗概写或改人物圣经"},
      "film-lira-assets": {"l":"角色资产","d":"从定稿剧本生成可生产的角色参考图提示词与资产简报"},
      "film-screenplay": {"l":"定稿剧本","d":"把已定素材深度合并成导演可用的剧本"},
      "film-synopsis": {"l":"梗概与概念","d":"只为项目写或改 AI 影视梗概与概念锚点"},
      "film-treatment": {"l":"场次处理稿","d":"把已定素材转成逐场处理稿"},
      "film-worldbuilding": {"l":"世界观","d":"只写世界规则、地点、势力与关键物件"},
      "find-skills": {"l":"找技能","d":"帮用户发现并安装需要的技能"},
      "flue": {"l":"桌面应用控制","d":"通过本地桥驱动 Windows/macOS 桌面应用"},
      "freeze": {"l":"冻结编辑范围","d":"本会话内把文件编辑限制在一个目录"},
      "gstack": {"l":"gstack 总入口","d":"把任何 gstack 请求路由到正确的子技能"},
      "gstack-openclaw-ceo-review": {"l":"CEO式挑刺","d":"用一把手视角挑方案毛病、把想法想得更大"},
      "gstack-openclaw-investigate": {"l":"根因排查","d":"调试、修 bug、查清错误根因"},
      "gstack-openclaw-office-hours": {"l":"想法评估","d":"判断一个想法值不值得做"},
      "gstack-openclaw-retro": {"l":"周度复盘","d":"按提交与工作模式做工程复盘"},
      "gstack-upgrade": {"l":"升级 gstack","d":"检测全局还是随仓安装，并升到最新版"},
      "guard": {"l":"全面护栏","d":"危险命令提醒 + 目录级编辑限制"},
      "hackernews-frontpage": {"l":"HN首页抓取","d":"抓 Hacker News 首页标题、分数与评论数"},
      "health": {"l":"代码健康看板","d":"汇总类型检查、lint、测试、死代码等指标"},
      "hmos-ability-insight-intent-generator": {"l":"意图装饰器","d":"自动选装饰器生成 OpenHarmony intent 代码"},
      "hmos-arkts-knowledge-retriever": {"l":"ArkTS知识检索","d":"按仓库文档检索 ArkTS 语法与 API 依据"},
      "hmos-arkui-develop-skill": {"l":"ArkUI开发必读","d":"写第一个 .ets 前的致命坑清单与 API 速查"},
      "hmos-arkui-navigation-transition": {"l":"导航转场","d":"配置 Navigation/NavDestination 的转场动画"},
      "hmos-arkui-statemgt-migration": {"l":"状态管理V1转V2","d":"把 @State/@Link 等 V1 装饰器迁移到 V2"},
      "hmos-one-sdk-skill": {"l":"Kit接口速查","d":"25 个 Kit 的签名、错误码与权限速查"},
      "investigate": {"l":"系统排查","d":"四阶段：调查、分析、假设、实现"},
      "ios-clean": {"l":"清理iOS调试桥","d":"移除 DebugBridge SPM 包与 DEBUG 接线"},
      "ios-design-review": {"l":"iOS视觉审计","d":"连真机审 SwiftUI 视觉"},
      "ios-fix": {"l":"iOS自动修bug","d":"读源码、写修复、重编译重装"},
      "ios-qa": {"l":"iOS真机QA","d":"通过 USB 隧道在真机上跑 QA"},
      "ios-sync": {"l":"同步iOS调试桥","d":"按上游模板重新生成调试桥"},
      "land-and-deploy": {"l":"合并并部署","d":"合 PR、等 CI、部署后用金丝雀验健康"},
      "landing-report": {"l":"合并队列看板","d":"只读展示哪些 VERSION 槽位被占用"},
      "learn": {"l":"经验管理","d":"复盘、检索、清理与导出 gstack 积累的经验"},
      "make-pdf": {"l":"Markdown转PDF","d":"排版成出版级 PDF：页边距、智能分页、页码"},
      "memory-curation": {"l":"记忆治理","d":"维护现状、决策、交接与复盘等记忆文件"},
      "motion-canvas": {"l":"矢量动效","d":"用 TypeScript 做程序化动效与讲解片"},
      "office-hours": {"l":"YC办公时间","d":"创业六问与投前拷问两种模式"},
      "open-gstack-browser": {"l":"打开GStack浏览器","d":"启动内置侧栏扩展的 AI 控制浏览器"},
      "pair-agent": {"l":"配对接管浏览器","d":"生成配对密钥，让远端 agent 接管这台浏览器"},
      "plan-ceo-review": {"l":"CEO式方案审","d":"重定义问题、找满分方案、扩范围"},
      "plan-design-review": {"l":"设计视角方案审","d":"逐维度 0-10 打分并给出改法"},
      "plan-devex-review": {"l":"开发体验方案审","d":"对比竞品、探查开发者画像"},
      "plan-eng-review": {"l":"工程视角方案审","d":"锁架构、数据流、边界与测试"},
      "plan-tune": {"l":"提问敏感度调参","d":"依据历史提问与画像调整提问策略"},
      "qa": {"l":"QA并修bug","d":"系统测网页并顺手把找到的 bug 修掉"},
      "qa-only": {"l":"只测不修","d":"只出结构化 QA 报告与健康评分"},
      "retro": {"l":"周度复盘","d":"按提交历史与工作模式做工程复盘"},
      "reuse-gate": {"l":"复用门禁","d":"动手前先判断能不能不写新代码"},
      "review": {"l":"合入前评审","d":"查 SQL 安全、信任边界、并发等问题"},
      "scrape": {"l":"抓网页","d":"从页面取数据，并把流程沉淀成可复用原型"},
      "setup-browser-cookies": {"l":"导入浏览器cookie","d":"从真实 Chromium 导 cookie 到无头会话"},
      "setup-deploy": {"l":"配置部署","d":"识别平台并写好部署配置"},
      "setup-gbrain": {"l":"配置gbrain","d":"装 CLI、初始化本地或 Supabase 记忆库并注册 MCP"},
      "ship": {"l":"发布流水线","d":"合基线、跑测试、审 diff、升版本、改日志、提交推送"},
      "skillify": {"l":"流程固化","d":"把最近一次成功的抓取流程固化成永久技能"},
      "spec": {"l":"写成可执行规格","d":"五阶段把模糊意图固化成规格与工单"},
      "sync-gbrain": {"l":"同步gbrain","d":"让记忆库跟上仓库现状并刷新检索指引"},
      "test-audit": {"l":"测试体检","d":"找出低价值、重复的测试及其养活的测试专用代码"},
      "unfreeze": {"l":"解除冻结","d":"放开 /freeze 设的编辑边界"}
    }
    // <zh:end>

    /** Merged table, refreshed on apply() so overrides need no restart. */
    var ZH = {}

    function zhOf(name) {
      return Object.prototype.hasOwnProperty.call(ZH, name) ? ZH[name] : undefined
    }

    /** One row is `{ l, d }`; `{ label, desc }` is accepted for pasted JSON. */
    function normalizeZh(entry) {
      if (entry === undefined || entry === null || typeof entry !== 'object') return undefined
      var label = typeof entry.l === 'string' ? entry.l : entry.label
      var desc = typeof entry.d === 'string' ? entry.d : entry.desc
      var row = {}
      if (typeof label === 'string' && label.trim() !== '') row.l = label.trim()
      if (typeof desc === 'string' && desc.trim() !== '') row.d = desc.trim()
      return Object.keys(row).length === 0 ? undefined : row
    }

    function mergeZh(base, overrides) {
      var merged = {}
      var name
      for (name in base) {
        var own = normalizeZh(base[name])
        if (own !== undefined) merged[name] = own
      }
      for (name in overrides) {
        var extra = normalizeZh(overrides[name])
        if (extra !== undefined) merged[name] = extra
      }
      return merged
    }

    /** Per-user translations: `localStorage['dsh.cockpit.zh'] = { name: { l, d } }`. */
    function readZhOverrides() {
      try {
        if (typeof localStorage === 'undefined') return {}
        var raw = localStorage.getItem('dsh.cockpit.zh')
        if (!raw) return {}
        var parsed = JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' ? parsed : {}
      } catch (error) {
        console.warn('[dsh-cockpit] zh overrides unreadable:', error)
        return {}
      }
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
      var zh = zhOf(skill.name)
      var row = {
        name: skill.name,
        description: zh !== undefined && zh.d !== undefined ? zh.d : skill.description,
        value: encode({ kind: 'skill', name: skill.name })
      }
      if (zh !== undefined && zh.l !== undefined) row.label = zh.l
      if (section !== undefined) row.section = section
      return row
    }

    function matches(text, needle) {
      return typeof text === 'string' && text.toLowerCase().indexOf(needle) !== -1
    }

    /** Name or description, English or the Chinese layer: `浏览器` finds `browse`. */
    function skillMatches(skill, needle) {
      if (matches(skill.name, needle) || matches(skill.description, needle)) return true
      var zh = zhOf(skill.name)
      if (zh === undefined) return false
      return matches(zh.l, needle) || matches(zh.d, needle)
    }

    /** Rows for one drilled-in group, filtered by the text typed after the slash. */
    function groupRows(bucket, filter) {
      var rows = []
      var section = bucket.group.name
      for (var i = 0; i < bucket.skills.length; i++) {
        var skill = bucket.skills[i]
        if (filter !== '' && !skillMatches(skill, filter)) continue
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
          if (skillMatches(skill, needle)) {
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
        ZH = mergeZh(SKILL_ZH, readZhOverrides())

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
