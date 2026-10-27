import io, sys

path = r'G:\AI\Claude-Workspace\Projects\dsh-cockpit\client.js'
tmp = r'G:\AI\Claude-Workspace\Projects\dsh-cockpit\.tmp-panel.js'

with io.open(path, 'r', encoding='utf-8', newline='') as handle:
    text = handle.read()

start = text.index('    // --- 4. Right-sidebar cockpit panel ---')
end = text.index('    // --- 3. Plugin body ---')

with io.open(tmp, 'r', encoding='utf-8', newline='') as handle:
    block = handle.read()

text = text[:start] + block + text[end:]

old_apply = """        var skillsRemote = ctx.remote && ctx.remote.skills
        var sessions = ctx.sessions
        var config = loadCockpitConfig()
        ZH = mergeZh(SKILL_ZH, readZhOverrides())
        SKILLS_REMOTE = skillsRemote
        SESSIONS = sessions

        // The panel is independent of the slash menu: register it first, so a
        // build without the input-trigger package still gets the sidebar.
        installPanelStyles()
        registerPanel(ctx, config.groups)
"""

new_apply = """        var skillsRemote = ctx.remote && ctx.remote.skills
        var sessions = ctx.sessions
        var config = loadCockpitConfig()
        ZH = mergeZh(SKILL_ZH, readZhOverrides())
        SESSIONS = sessions
        ROOT_CTX = ctx

        // The panel is independent of the slash menu: register it first, so a
        // build without the input-trigger package still gets the sidebar.
        installPanelStyles()
        registerPanel(ctx)
"""

assert old_apply in text, 'apply head not found'
text = text.replace(old_apply, new_apply, 1)

with io.open(path, 'w', encoding='utf-8', newline='') as handle:
    handle.write(text)

print('ok', len(text))
