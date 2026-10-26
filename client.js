// DSH Skill Cockpit Client Plugin Bundle
window.__ModuleLoader__.load({
  id: '@dsh-community/dsh-cockpit',
  factory: function (require) {
    var React = require('react');
    var h = React.createElement;

    // --- 1. Built-in Configurations & Wildcard Match Engine ---
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
    ];

    var FALLBACK_GROUP = {
      id: 'other',
      name: '📦 其他实用技能',
      priority: 0,
      icon: '📦',
      description: '其他可用系统与自定义扩展技能',
      patterns: ['*']
    };

    function matchPattern(name, pattern) {
      if (pattern === '*') return true;
      if (pattern.slice(-1) === '*') return name.indexOf(pattern.slice(0, -1)) === 0;
      if (pattern.charAt(0) === '*') return name.indexOf(pattern.slice(1), name.length - pattern.length + 1) !== -1;
      return name === pattern;
    }

    function matchSkillGroup(name, groups) {
      var sorted = groups.slice().sort(function (a, b) { return b.priority - a.priority; });
      for (var i = 0; i < sorted.length; i++) {
        var g = sorted[i];
        for (var j = 0; j < g.patterns.length; j++) {
          if (matchPattern(name, g.patterns[j])) return g;
        }
      }
      return FALLBACK_GROUP;
    }

    function loadCockpitConfig() {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('dsh.cockpit.config');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed.groups) && parsed.groups.length > 0) return parsed;
          }
        }
      } catch (e) {}
      return { groups: DEFAULT_GROUPS };
    }

    function saveCockpitConfig(cfg) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('dsh.cockpit.config', JSON.stringify(cfg));
        }
      } catch (e) {}
    }

    // --- 2. Cockpit Panel Component (Rightbar) ---
    function CockpitPanel(props) {
      var skills = props.skills || [];
      var onInsertSkill = props.onInsertSkill;

      var configState = React.useState(loadCockpitConfig());
      var config = configState[0];
      var setConfig = configState[1];

      var searchState = React.useState('');
      var search = searchState[0];
      var setSearch = searchState[1];

      var tabState = React.useState('skills');
      var activeTab = tabState[0];
      var setActiveTab = tabState[1];

      var groupSelectState = React.useState('all');
      var selectedGroupId = groupSelectState[0];
      var setSelectedGroupId = groupSelectState[1];

      var jsonState = React.useState(JSON.stringify(config, null, 2));
      var jsonConfigStr = jsonState[0];
      var setJsonConfigStr = jsonState[1];

      var msgState = React.useState('');
      var saveMessage = msgState[0];
      var setSaveMessage = msgState[1];

      var groupStats = React.useMemo(function () {
        var map = new Map();
        for (var i = 0; i < config.groups.length; i++) map.set(config.groups[i].id, []);
        map.set(FALLBACK_GROUP.id, []);

        for (var j = 0; j < skills.length; j++) {
          var s = skills[j];
          var g = matchSkillGroup(s.name, config.groups);
          var list = map.get(g.id) || map.get(FALLBACK_GROUP.id);
          list.push(s);
        }
        return map;
      }, [skills, config]);

      var filteredSkills = React.useMemo(function () {
        var list = skills;
        if (selectedGroupId !== 'all') {
          list = groupStats.get(selectedGroupId) || [];
        }
        var q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter(function (s) {
          return s.name.toLowerCase().indexOf(q) !== -1 || (s.description || '').toLowerCase().indexOf(q) !== -1;
        });
      }, [skills, selectedGroupId, groupStats, search]);

      var handleSaveJson = function () {
        try {
          var parsed = JSON.parse(jsonConfigStr);
          if (Array.isArray(parsed.groups)) {
            saveCockpitConfig(parsed);
            setConfig(parsed);
            setSaveMessage('✅ 保存成功！已更新配置');
            setTimeout(function () { setSaveMessage(''); }, 3000);
          } else {
            setSaveMessage('❌ 格式错误：缺少 groups 数组');
          }
        } catch (e) {
          setSaveMessage('❌ JSON 解析失败: ' + e.message);
        }
      };

      var handleResetDefaults = function () {
        var def = { groups: DEFAULT_GROUPS };
        saveCockpitConfig(def);
        setConfig(def);
        setJsonConfigStr(JSON.stringify(def, null, 2));
        setSaveMessage('✅ 已重置为官方默认分类');
        setTimeout(function () { setSaveMessage(''); }, 3000);
      };

      return h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: 'var(--dsh-bg-base, #1e1e24)',
          color: 'var(--dsh-text-base, #e2e8f0)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
          overflow: 'hidden'
        }
      },
        // Header
        h('div', {
          style: {
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.1)'
          }
        },
          h('div', { style: { fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' } },
            h('span', null, '🧭'), ' 研发驾驶舱'
          ),
          h('div', { style: { display: 'flex', gap: '4px' } },
            h('button', {
              onClick: function () { setActiveTab('skills'); },
              style: {
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'skills' ? 'var(--dsh-accent, #3b82f6)' : 'transparent',
                color: '#fff',
                fontSize: '12px'
              }
            }, '技能库 (' + skills.length + ')'),
            h('button', {
              onClick: function () { setActiveTab('settings'); },
              style: {
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'settings' ? 'var(--dsh-accent, #3b82f6)' : 'transparent',
                color: '#fff',
                fontSize: '12px'
              }
            }, '⚙️ 分类配置')
          )
        ),

        activeTab === 'skills' ? (
          h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
            // Search
            h('div', { style: { padding: '8px 12px' } },
              h('input', {
                type: 'text',
                placeholder: '搜索技能名、描述...',
                value: search,
                onChange: function (e) { setSearch(e.target.value); },
                style: {
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none'
                }
              })
            ),
            // Group chips
            h('div', {
              style: {
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                padding: '0 12px 8px 12px',
                scrollbarWidth: 'none'
              }
            },
              h('button', {
                onClick: function () { setSelectedGroupId('all'); },
                style: {
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid ' + (selectedGroupId === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
                  background: selectedGroupId === 'all' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedGroupId === 'all' ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: '11px'
                }
              }, '全部 (' + skills.length + ')'),
              config.groups.map(function (g) {
                var cnt = (groupStats.get(g.id) || []).length;
                if (cnt === 0) return null;
                var isSel = selectedGroupId === g.id;
                return h('button', {
                  key: g.id,
                  onClick: function () { setSelectedGroupId(g.id); },
                  style: {
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: '1px solid ' + (isSel ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
                    background: isSel ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isSel ? '#60a5fa' : '#94a3b8',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: '11px'
                  }
                }, (g.icon || '') + ' ' + (g.name.split(' ')[1] || g.name) + ' (' + cnt + ')');
              })
            ),
            // Skill cards
            h('div', {
              style: {
                flex: 1,
                overflowY: 'auto',
                padding: '4px 12px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }
            },
              filteredSkills.length === 0 ?
                h('div', { style: { textAlign: 'center', padding: '30px 0', color: '#64748b' } }, '没有找到匹配的技能') :
                filteredSkills.map(function (s) {
                  var g = matchSkillGroup(s.name, config.groups);
                  return h('div', {
                    key: s.name,
                    style: {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }
                  },
                    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                      h('div', { style: { fontWeight: 600, color: '#f8fafc', fontSize: '13px' } }, s.name),
                      h('span', {
                        style: {
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#94a3b8'
                        }
                      }, (g.icon || '') + ' ' + (g.name.split(' ')[1] || g.name))
                    ),
                    s.description ? h('div', {
                      style: {
                        fontSize: '11px',
                        color: '#94a3b8',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }
                    }, s.description) : null,
                    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '2px' } },
                      h('button', {
                        onClick: function () { onInsertSkill && onInsertSkill(s.name); },
                        style: {
                          background: 'rgba(59,130,246,0.15)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }
                      }, '填入对话 /')
                    )
                  );
                })
            )
          )
        ) : (
          // Settings Tab
          h('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '12px',
              gap: '8px',
              minHeight: 0
            }
          },
            h('div', { style: { color: '#94a3b8', fontSize: '12px', lineHeight: 1.4 } },
              '💡 在此直接编辑分组名称、优先级（越大越优先）及通配符规则（如 gstack*, hmos-*）。'
            ),
            h('textarea', {
              value: jsonConfigStr,
              onChange: function (e) { setJsonConfigStr(e.target.value); },
              style: {
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
              }
            }),
            saveMessage ? h('div', { style: { fontSize: '11px', fontWeight: 600 } }, saveMessage) : null,
            h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              h('button', {
                onClick: handleResetDefaults,
                style: {
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }
              }, '恢复默认'),
              h('button', {
                onClick: handleSaveJson,
                style: {
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '4px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px'
                }
              }, '保存生效')
            )
          )
        )
      );
    }

    // --- 3. DSH Client Plugin Exports & Hooking ---
    return {
      inject: ['inputTriggers', 'sessions', 'slots', 'locale', 'remote', 'remote.skills', 'sidebarRight'],
      apply: function (ctx) {
        console.log('[dsh-cockpit] Applying DSH Skill Cockpit plugin...');

        var skillsRemote = ctx.remote && ctx.remote.skills;
        var sessions = ctx.sessions;
        var inputTriggers = ctx.get('inputTriggers');
        var TAB_KIND = 'cockpit';

        // 1. Rightbar Cockpit Tab
        if (ctx.sidebarRightTabs && ctx.slots) {
          try {
            ctx.sidebarRightTabs.register({
              kind: TAB_KIND,
              title: function () { return '🧭 驾驶舱'; },
              priority: 15
            });

            ctx.slots.inject('sidebar.right.pane.tab', function () {
              return ctx.slots.register({
                name: 'sidebar.right.pane.tab',
                key: TAB_KIND
              }, function (props) {
                var skillListState = React.useState([]);
                var skillsList = skillListState[0];
                var setSkillsList = skillListState[1];

                React.useEffect(function () {
                  var active = true;
                  var abort = new AbortController();
                  var sess = sessions && sessions.sessionOf ? sessions.sessionOf(props && props.actx) : null;
                  var sid = sess ? sess.sessionId : (props && props.sessionId);
                  if (sid && skillsRemote) {
                    skillsRemote.list({ sessionId: sid }, abort.signal).then(function (res) {
                      if (active && res.ok) {
                        setSkillsList(res.value.skills || []);
                      }
                    }).catch(function () {});
                  }
                  return function () { active = false; abort.abort(); };
                }, [props && props.sessionId]);

                return h(CockpitPanel, {
                  skills: skillsList,
                  onInsertSkill: function (name) {
                    var textarea = document.querySelector('textarea');
                    if (textarea) {
                      textarea.focus();
                      var text = '/' + name + ' ';
                      var start = textarea.selectionStart;
                      var end = textarea.selectionEnd;
                      textarea.setRangeText(text, start, end, 'end');
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }
                });
              });
            });
          } catch (e) {
            console.warn('[dsh-cockpit] Rightbar tab registration failed:', e);
          }
        }

        // 2. Slash Menu Categorization & Drill-down (/cockpit-skill or enhanced slash)
        if (inputTriggers && skillsRemote) {
          var cockpitSource = {
            trigger: '/',
            name: 'cockpit-skill',
            order: 1.5, // Intercepts before standard flat skill (order: 2)
            candidates: function (session, filter) {
              var query = filter.query;
              var signal = filter.signal;

              if (sessions && sessions.subagentAddress && sessions.subagentAddress(session.sessionId) !== undefined) {
                return Promise.resolve([]);
              }

              return skillsRemote.list({ sessionId: session.sessionId }, signal).then(function (result) {
                if (!result.ok || signal.aborted) return [];
                var allSkills = result.value.skills || [];
                var config = loadCockpitConfig();
                var trimmed = query.trim().toLowerCase();

                // If user is actively searching keywords, return matched skills with group tags
                if (trimmed.length > 0) {
                  return allSkills
                    .filter(function (s) {
                      return s.name.toLowerCase().indexOf(trimmed) !== -1 ||
                             (s.description || '').toLowerCase().indexOf(trimmed) !== -1;
                    })
                    .map(function (s) {
                      var g = matchSkillGroup(s.name, config.groups);
                      return {
                        name: s.name,
                        label: (g.icon || '🏷️') + ' ' + g.name,
                        description: s.description,
                        section: g.name
                      };
                    });
                }

                // Top level: Folders for each group with drilldown
                var groupMap = new Map();
                for (var i = 0; i < config.groups.length; i++) groupMap.set(config.groups[i].id, []);
                groupMap.set(FALLBACK_GROUP.id, []);

                for (var j = 0; j < allSkills.length; j++) {
                  var sk = allSkills[j];
                  var grp = matchSkillGroup(sk.name, config.groups);
                  var l = groupMap.get(grp.id) || groupMap.get(FALLBACK_GROUP.id);
                  l.push(sk);
                }

                var topItems = [];
                var sorted = config.groups.slice().sort(function (a, b) { return b.priority - a.priority; });

                for (var k = 0; k < sorted.length; k++) {
                  var group = sorted[k];
                  var items = groupMap.get(group.id) || [];
                  if (items.length === 0) continue;

                  (function (g, itms) {
                    topItems.push({
                      name: (g.icon || '📁') + ' ' + g.name,
                      label: itms.length + ' 个技能 (Tab 展开)',
                      description: g.description,
                      section: '⚡ 技能分组导航 (Tab 展开)',
                      drill: function () {
                        return itms.map(function (item) {
                          return {
                            name: item.name,
                            label: g.name,
                            description: item.description
                          };
                        });
                      }
                    });
                  })(group, items);
                }

                var fallbackItems = groupMap.get(FALLBACK_GROUP.id) || [];
                if (fallbackItems.length > 0) {
                  topItems.push({
                    name: (FALLBACK_GROUP.icon || '📦') + ' ' + FALLBACK_GROUP.name,
                    label: fallbackItems.length + ' 个技能 (Tab 展开)',
                    description: FALLBACK_GROUP.description,
                    section: '⚡ 技能分组导航 (Tab 展开)',
                    drill: function () {
                      return fallbackItems.map(function (item) {
                        return {
                          name: item.name,
                          label: FALLBACK_GROUP.name,
                          description: item.description
                        };
                      });
                    }
                  });
                }

                return topItems;
              });
            },
            onPick: function (ctx) {
              var cleanName = ctx.candidate.name.replace(/^[^\w-]+/, '').trim();
              return { text: '/' + cleanName + ' ' };
            }
          };

          ctx.effect(function () {
            var unregister = inputTriggers.registerSource(cockpitSource);
            return function () { unregister(); };
          }, 'dsh-cockpit: slash source');
        }

        console.log('[dsh-cockpit] Applied successfully.');
      }
    };
  }
});
