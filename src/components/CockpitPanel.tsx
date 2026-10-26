/**
 * DSH Skill Cockpit - Right Sidebar Panel Components
 */

import React, { useState, useEffect } from 'react'
import {
  loadCockpitConfig,
  saveCockpitConfig,
  DEFAULT_GROUPS,
  SkillGroupConfig,
  matchSkillGroup,
  FALLBACK_GROUP
} from '../config.ts'

interface SkillItem {
  name: string
  description?: string
  author?: string
}

interface CockpitProps {
  ctx?: any
  skills?: SkillItem[]
  onInsertSkill?: (name: string) => void
}

export const CockpitPanel: React.FC<CockpitProps> = ({ ctx, skills = [], onInsertSkill }) => {
  const [config, setConfig] = useState(loadCockpitConfig())
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'skills' | 'settings'>('skills')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [editingGroups, setEditingGroups] = useState<SkillGroupConfig[]>(config.groups)
  const [jsonConfigStr, setJsonConfigStr] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  // Compute skill counts per group
  const groupStats = React.useMemo(() => {
    const map = new Map<string, SkillItem[]>()
    for (const g of config.groups) map.set(g.id, [])
    map.set(FALLBACK_GROUP.id, [])

    for (const s of skills) {
      const g = matchSkillGroup(s.name, config.groups)
      const list = map.get(g.id) || map.get(FALLBACK_GROUP.id)!
      list.push(s)
    }
    return map
  }, [skills, config])

  // Filter skills by search & selected tab
  const filteredSkills = React.useMemo(() => {
    let list = skills
    if (selectedGroupId !== 'all') {
      list = groupStats.get(selectedGroupId) || []
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
  }, [skills, selectedGroupId, groupStats, search])

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonConfigStr)
      if (Array.isArray(parsed.groups)) {
        saveCockpitConfig(parsed)
        setConfig(parsed)
        setSaveMessage('✅ 保存成功！已更新配置')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage('❌ 格式错误：缺少 groups 数组')
      }
    } catch (e: any) {
      setSaveMessage(`❌ JSON 解析失败: ${e.message}`)
    }
  }

  const handleResetDefaults = () => {
    const def = { groups: DEFAULT_GROUPS }
    saveCockpitConfig(def)
    setConfig(def)
    setJsonConfigStr(JSON.stringify(def, null, 2))
    setSaveMessage('✅ 已重置为官方默认分类')
    setTimeout(() => setSaveMessage(''), 3000)
  }

  useEffect(() => {
    setJsonConfigStr(JSON.stringify(config, null, 2))
  }, [config])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--dsh-bg-base, #1e1e24)',
      color: 'var(--dsh-text-base, #e2e8f0)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      overflow: 'hidden'
    }}>
      {/* Header Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--dsh-border-subtle, rgba(255,255,255,0.08))',
        padding: '8px 12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🧭</span> 研发驾驶舱
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('skills')}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'skills' ? 'var(--dsh-accent, #3b82f6)' : 'transparent',
              color: '#fff',
              fontSize: '12px'
            }}
          >
            技能库 ({skills.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'settings' ? 'var(--dsh-accent, #3b82f6)' : 'transparent',
              color: '#fff',
              fontSize: '12px'
            }}
          >
            ⚙️ 分类配置
          </button>
        </div>
      </div>

      {activeTab === 'skills' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Search Bar */}
          <div style={{ padding: '8px 12px' }}>
            <input
              type="text"
              placeholder="搜索技能名、描述..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--dsh-border-base, rgba(255,255,255,0.15))',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          {/* Group Chips Filter */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '0 12px 8px 12px',
            scrollbarWidth: 'none'
          }}>
            <button
              onClick={() => setSelectedGroupId('all')}
              style={{
                padding: '3px 8px',
                borderRadius: '12px',
                border: '1px solid ' + (selectedGroupId === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
                background: selectedGroupId === 'all' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: selectedGroupId === 'all' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '11px'
              }}
            >
              全部 ({skills.length})
            </button>
            {config.groups.map(g => {
              const count = groupStats.get(g.id)?.length || 0
              if (count === 0) return null
              const isSelected = selectedGroupId === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: '1px solid ' + (isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
                    background: isSelected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#60a5fa' : '#94a3b8',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: '11px'
                  }}
                >
                  {g.icon} {g.name.split(' ')[1] || g.name} ({count})
                </button>
              )
            })}
          </div>

          {/* Skills Scroll List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {filteredSkills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                没有找到匹配的技能
              </div>
            ) : (
              filteredSkills.map(skill => {
                const group = matchSkillGroup(skill.name, config.groups)
                return (
                  <div
                    key={skill.name}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                        {skill.name}
                      </div>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#94a3b8'
                      }}>
                        {group.icon} {group.name.split(' ')[1] || group.name}
                      </span>
                    </div>

                    {skill.description && (
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {skill.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        onClick={() => onInsertSkill?.(skill.name)}
                        style={{
                          background: 'rgba(59,130,246,0.15)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        填入对话 /
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* Configuration Tab */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '12px',
          gap: '8px',
          minHeight: 0
        }}>
          <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.4 }}>
            💡 支持在此直接编辑分组名称、优先级（数值越大越优先匹配）及通配符规则（如 <code>gstack*</code>, <code>hmos-*</code>）。
          </div>

          <textarea
            value={jsonConfigStr}
            onChange={e => setJsonConfigStr(e.target.value)}
            style={{
              flex: 1,
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.3)',
              color: '#38bdf8',
              fontFamily: 'Consolas, monospace',
              fontSize: '11px',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              resize: 'none',
              outline: 'none'
            }}
          />

          {saveMessage && (
            <div style={{ fontSize: '11px', fontWeight: 600 }}>{saveMessage}</div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleResetDefaults}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              恢复默认
            </button>
            <button
              onClick={handleSaveJson}
              style={{
                background: '#2563eb',
                border: 'none',
                color: '#fff',
                borderRadius: '4px',
                padding: '4px 14px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              保存生效
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
