/**
 * DSH Skill Cockpit - Slash Menu Enhancer
 * Intercepts and reorganizes the '/' slash menu into collapsible, drillable categories.
 */

import { matchSkillGroup, loadCockpitConfig, SkillGroupConfig, FALLBACK_GROUP } from './config.ts'

export interface MenuItem {
  name: string
  label?: string
  description?: string
  section?: string
  icon?: string
  drill?: () => MenuItem[]
  action?: () => void
  disabled?: boolean
}

export interface SkillEntry {
  name: string
  description: string
  path?: string
  author?: string
}

/**
 * Transforms a flat list of skills into drillable, categorized MenuItems.
 * 
 * @param skills List of skill entries fetched from DSH
 * @param query Current user input filter (text after '/')
 * @param onSelect Callback when a skill is chosen
 */
export function buildCategorizedSkillMenu(
  skills: SkillEntry[],
  query: string,
  onSelect: (skillName: string) => void
): MenuItem[] {
  const config = loadCockpitConfig()
  const trimmedQuery = query.trim().toLowerCase()

  // 1. Group skills by resolved category
  const groupMap = new Map<string, { group: SkillGroupConfig; items: SkillEntry[] }>()

  // Initialize configured groups to preserve priority order
  const sortedGroups = [...config.groups].sort((a, b) => b.priority - a.priority)
  for (const group of sortedGroups) {
    groupMap.set(group.id, { group, items: [] })
  }
  groupMap.set(FALLBACK_GROUP.id, { group: FALLBACK_GROUP, items: [] })

  for (const skill of skills) {
    const matched = matchSkillGroup(skill.name, config.groups)
    const entry = groupMap.get(matched.id) || groupMap.get(FALLBACK_GROUP.id)!
    entry.items.push(skill)
  }

  // 2. If user is actively searching with keyword, provide filtered flat list with section tags
  if (trimmedQuery.length > 0) {
    const matchedItems: MenuItem[] = []
    for (const [_, entry] of groupMap) {
      for (const skill of entry.items) {
        const nameMatch = skill.name.toLowerCase().includes(trimmedQuery)
        const descMatch = (skill.description || '').toLowerCase().includes(trimmedQuery)
        if (nameMatch || descMatch) {
          matchedItems.push({
            name: skill.name,
            label: `${entry.group.icon || '📦'} ${entry.group.name}`,
            description: skill.description,
            section: entry.group.name,
            action: () => onSelect(skill.name)
          })
        }
      }
    }
    return matchedItems
  }

  // 3. When query is empty, show Top-Level Folders / Groups with drill-down capability
  const topLevelMenuItems: MenuItem[] = []

  for (const [_, entry] of groupMap) {
    if (entry.items.length === 0) continue

    const group = entry.group
    topLevelMenuItems.push({
      name: `${group.icon || '📁'} ${group.name}`,
      label: `共 ${entry.items.length} 个技能 (按 Tab 展开)`,
      description: group.description || `查看 ${group.name} 包含的所有技能`,
      section: '技能分类',
      drill: () => {
        // Returned when user drills into this folder
        return entry.items.map(skill => ({
          name: skill.name,
          label: group.name,
          description: skill.description,
          action: () => onSelect(skill.name)
        }))
      }
    })
  }

  return topLevelMenuItems
}
