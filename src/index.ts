/**
 * DSH Skill Cockpit - Plugin Entry Point
 * Registers:
 * 1. Categorized & drillable '/' Slash Menu Trigger (enhances/replaces flat skill source)
 * 2. Rightbar Cockpit Tab & Header Action Button
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { matchSkillGroup, loadCockpitConfig, FALLBACK_GROUP } from './config.ts'
import { CockpitPanel } from './components/CockpitPanel.tsx'
import React from 'react'

export const inject = ['inputTriggers', 'sessions', 'slots', 'locale', 'remote', 'remote.skills', 'sidebarRight']

const TAB_KIND = 'cockpit'

export function apply(ctx: ClientContext): void {
  console.log('[dsh-cockpit] Initializing Skill Cockpit Plugin...')

  const skillsRemote = ctx.remote.skills
  const sessions = ctx.sessions
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract

  // 1. Register Rightbar Tab & Action
  if (ctx.sidebarRightTabs) {
    try {
      ctx.sidebarRightTabs.register({
        kind: TAB_KIND,
        title: () => '🧭 驾驶舱',
        priority: 15,
      })

      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_KIND,
      }, (props: any) => {
        const [skills, setSkills] = React.useState<SkillEntry[]>([])

        React.useEffect(() => {
          let active = true
          const abort = new AbortController()
          const sess = sessions.sessionOf?.(props?.actx)
          const sid = sess?.sessionId || (props?.sessionId as SessionId)
          if (sid) {
            skillsRemote.list({ sessionId: sid }, abort.signal).then(res => {
              if (active && res.ok) {
                setSkills(res.value.skills as SkillEntry[])
              }
            }).catch(() => {})
          }
          return () => { active = false; abort.abort() }
        }, [props?.sessionId])

        return React.createElement(CockpitPanel, {
          skills,
          onInsertSkill: (name: string) => {
            // Find input and insert /name
            const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
            if (textarea) {
              textarea.focus()
              const text = `/${name} `
              const start = textarea.selectionStart
              const end = textarea.selectionEnd
              textarea.setRangeText(text, start, end, 'end')
              textarea.dispatchEvent(new Event('input', { bubbles: true }))
            }
          }
        })
      }))
    } catch (e) {
      console.warn('[dsh-cockpit] Could not register rightbar tab:', e)
    }
  }

  // 2. Enhance Slash Menu with Grouping & Drilldown
  // By registering with order: 1 (ahead of order: 2), or overriding candidates
  const cockpitSource: InputTriggerSource = {
    trigger: '/',
    name: 'cockpit-skill',
    order: 1.5, // Priority higher than flat skill (order: 2)
    async candidates(session, { query, signal }) {
      if (sessions.subagentAddress(session.sessionId) !== undefined) return []

      const result = await skillsRemote.list({ sessionId: session.sessionId }, signal)
      if (!result.ok || signal.aborted) return []

      const allSkills = result.value.skills as SkillEntry[]
      const config = loadCockpitConfig()
      const trimmedQuery = query.trim().toLowerCase()

      // If actively querying, return matched skills with clear section/group tags
      if (trimmedQuery.length > 0) {
        return allSkills
          .filter(s => s.name.toLowerCase().includes(trimmedQuery) || (s.description || '').toLowerCase().includes(trimmedQuery))
          .map(skill => {
            const group = matchSkillGroup(skill.name, config.groups)
            return {
              name: skill.name,
              label: `${group.icon || '🏷️'} ${group.name}`,
              description: skill.description,
              section: group.name,
            }
          })
      }

      // Top level: Group folders with drill-down
      const groupMap = new Map<string, SkillEntry[]>()
      for (const g of config.groups) groupMap.set(g.id, [])
      groupMap.set(FALLBACK_GROUP.id, [])

      for (const s of allSkills) {
        const g = matchSkillGroup(s.name, config.groups)
        const list = groupMap.get(g.id) || groupMap.get(FALLBACK_GROUP.id)!
        list.push(s)
      }

      const topItems: any[] = []
      const sortedGroups = [...config.groups].sort((a, b) => b.priority - a.priority)

      for (const group of sortedGroups) {
        const items = groupMap.get(group.id) || []
        if (items.length === 0) continue

        topItems.push({
          name: `${group.icon || '📁'} ${group.name}`,
          label: `${items.length} 个技能 [按 Tab 展开]`,
          description: group.description,
          section: '⚡ 技能分组导航 (Tab 展开)',
          drill: () => {
            return items.map(skill => ({
              name: skill.name,
              label: group.name,
              description: skill.description,
            }))
          }
        })
      }

      // Append fallback
      const otherItems = groupMap.get(FALLBACK_GROUP.id) || []
      if (otherItems.length > 0) {
        topItems.push({
          name: `${FALLBACK_GROUP.icon} ${FALLBACK_GROUP.name}`,
          label: `${otherItems.length} 个技能 [按 Tab 展开]`,
          description: FALLBACK_GROUP.description,
          section: '⚡ 技能分组导航 (Tab 展开)',
          drill: () => {
            return otherItems.map(skill => ({
              name: skill.name,
              label: FALLBACK_GROUP.name,
              description: skill.description,
            }))
          }
        })
      }

      return topItems
    },
    onPick({ candidate }) {
      // Picked an actual skill name
      const cleanName = candidate.name.replace(/^[^\w-]+/, '').trim()
      return { text: `/${cleanName} ` }
    }
  }

  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(cockpitSource)
    return () => unregister()
  }, 'dsh-cockpit: slash source')

  console.log('[dsh-cockpit] Plugin applied successfully.')
}
