/**
 * DSH Skill Cockpit - Custom Grouping Engine
 */

export interface SkillGroupConfig {
  id: string
  name: string
  priority: number
  patterns: string[]
  icon?: string
  description?: string
}

export interface CockpitConfig {
  groups: SkillGroupConfig[]
}

/** Built-in smart rules for standard skill ecosystem */
export const DEFAULT_GROUPS: SkillGroupConfig[] = [
  {
    id: 'gstack',
    name: '⚡ gstack 工作流',
    priority: 100,
    icon: '⚡',
    description: '全流程自动化交付、代码审查、浏览器测试与发布套件',
    patterns: [
      'gstack*',
      'browse',
      'qa',
      'qa-only',
      'ship',
      'canary',
      'review',
      'investigate',
      'autoplan',
      'devex-review',
      'careful',
      'guard',
      'freeze',
      'unfreeze',
      'learn',
      'retro',
      'spec',
      'health',
      'cso',
      'codex',
      'benchmark*',
      'connect-chrome',
      'context-*',
      'design-*',
      'document-*',
      'ios-*',
      'land-and-deploy',
      'landing-report',
      'make-pdf',
      'office-hours',
      'open-gstack-browser',
      'pair-agent',
      'plan-*',
      'scrape',
      'setup-*',
      'skillify',
      'sync-gbrain'
    ]
  },
  {
    id: 'hmos',
    name: '📱 鸿蒙与 ArkUI',
    priority: 90,
    icon: '📱',
    description: 'OpenHarmony / HarmonyOS Next、ArkTS/ArkUI 开发与 Kit 集成',
    patterns: [
      'hmos-*',
      'arkui*',
      'arkuix*'
    ]
  },
  {
    id: 'media',
    name: '🎬 漫剧与视听创作',
    priority: 80,
    icon: '🎬',
    description: '漫剧工坊、Minimax H3 导演工作流、Krea2、漫画与音视频制作',
    patterns: [
      'manju-*',
      'minimax-*',
      'krea*',
      'fujimoto-*',
      'motion-canvas',
      'remotion-*',
      'infinitetalk',
      'audio-production*',
      'tts-*',
      'cinematic-*',
      'seedance-*',
      'storyboard-*',
      'video-*',
      'asset-*',
      'gpt-image*'
    ]
  },
  {
    id: 'script',
    name: '✍️ 编剧与文学',
    priority: 75,
    icon: '✍️',
    description: '主编剧、分集规划、人物世界观、大纲细纲与审稿工作流',
    patterns: [
      'jubenshi*',
      'novel-*',
      'screenplay-*',
      'creative-writing*',
      'fiction',
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
      'craft-*',
      'code-review*',
      'cascade-review',
      'caveman-review',
      'receiving-code-review',
      'requesting-code-review',
      'review-pr',
      'local-code-*',
      'trusted-patch',
      'diagnosing-bugs',
      'git-safety',
      'git-guardrails*',
      'minimal-change',
      'architect',
      'codebase-design',
      'design-an-interface',
      'tdd',
      'terse-coder'
    ]
  },
  {
    id: 'product',
    name: '📊 产品策划与架构',
    priority: 60,
    icon: '📊',
    description: '商业天演论、PRD 切片、机会地图、用户画像与路线图',
    patterns: [
      'product-*',
      'prd-*',
      'situation-design',
      'user-model*',
      'user-persona',
      'user-story*',
      'destination-first*',
      'jobs-to-be-done',
      'lean-ux*',
      'opportunity-*',
      'prioritization*',
      'problem-*',
      'roadmap-*',
      'epic-*',
      'discovery-*',
      'proto-persona'
    ]
  },
  {
    id: 'growth',
    name: '📢 增长运营与自媒体',
    priority: 50,
    icon: '📢',
    description: '小红书全链路、AI SEO、推文发布、A/B 测试与营销策略',
    patterns: [
      '*xhs*',
      'xiaohongshu*',
      'shuyu-xhs*',
      'ai-seo',
      'seo-*',
      'programmatic-seo',
      'content-*',
      'social-media*',
      'moltbook',
      'x-article*',
      'ad-creative',
      'ab-testing',
      'analytics',
      'churn-prevention',
      'cold-email',
      'emails',
      'launch',
      'marketing-*',
      'onboarding',
      'sales-enablement'
    ]
  },
  {
    id: 'tools',
    name: '🛠️ 通用工具与办公',
    priority: 40,
    icon: '🛠️',
    description: 'Office 格式处理、PDF、图表生成、文档解析与基础组件',
    patterns: [
      'office-*',
      'make-pdf',
      'antinet-*',
      'archify',
      'diagram',
      'icon-generator',
      'baoyu-*',
      'obsidian-*',
      'accessibility',
      'flue'
    ]
  }
]

export const FALLBACK_GROUP: SkillGroupConfig = {
  id: 'other',
  name: '📦 其他实用技能',
  priority: 0,
  icon: '📦',
  description: '其他可用系统与自定义扩展技能',
  patterns: ['*']
}

/** Check if a skill name matches a wildcard pattern */
export function matchPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return name.startsWith(prefix)
  }
  if (pattern.startsWith('*')) {
    const suffix = pattern.slice(1)
    return name.endsWith(suffix)
  }
  return name === pattern
}

/** Resolve which group a skill belongs to */
export function matchSkillGroup(name: string, groups: SkillGroupConfig[]): SkillGroupConfig {
  const sorted = [...groups].sort((a, b) => b.priority - a.priority)
  for (const group of sorted) {
    for (const pattern of group.patterns) {
      if (matchPattern(name, pattern)) {
        return group
      }
    }
  }
  return FALLBACK_GROUP
}

/** Load user config from localStorage with fallback */
export function loadCockpitConfig(): CockpitConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('dsh.cockpit.config')
      if (raw) {
        const parsed = JSON.parse(raw) as CockpitConfig
        if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
          return parsed
        }
      }
    }
  } catch (e) {
    console.warn('[dsh-cockpit] Failed to load custom config, using defaults:', e)
  }
  return { groups: DEFAULT_GROUPS }
}

/** Save user config to localStorage */
export function saveCockpitConfig(config: CockpitConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dsh.cockpit.config', JSON.stringify(config))
    }
  } catch (e) {
    console.error('[dsh-cockpit] Failed to save config:', e)
  }
}
