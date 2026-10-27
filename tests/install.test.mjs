// End-to-end tests for bin/install.mjs.
//
// The installer is the one part of this plugin that rewrites somebody else's
// profile: a wrong patch entry means the bundle silently never loads, and a
// wrong dependency means the next `pnpm install` deletes the plugin. So these
// tests build a throwaway DSH home and run the real script against it --
// nothing is stubbed except the home directory itself.
//
// Run: node --test tests/install.test.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs')
const PKG = 'dsh-skills-cockpit'
const PATCH = `# Your patch layer for this dsh profile
- id: web-startup
  disabled: false
- insert:
    - id: some-other-plugin
      name: "@local/some-other-plugin"
- id: ui-theme
  name: "@deepseek-ai/dsh-client-ui-theme"
`
const homes = []

after(() => {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true })
})

test('a fresh profile gets the plugin, the dependency and the patch entry', () => {
  const home = makeHome({ 'desktop': PATCH })
  const run = install(home, ['--copy'])

  assert.equal(run.status, 0, run.output)
  const plugin = path.join(home, 'plugins', 'dsh-cockpit')
  assert.ok(fs.existsSync(path.join(plugin, 'client.js')), 'client.js copied')
  assert.ok(fs.existsSync(path.join(plugin, 'package.json')), 'manifest copied')
  assert.ok(!fs.existsSync(path.join(plugin, 'tests')), 'dev-only files stay out')

  assert.ok(fs.existsSync(path.join(home, 'profiles', 'desktop', 'node_modules', PKG, 'client.js')), 'resolvable from the profile')
  assert.equal(deps(home).desktop[PKG], 'link:../../plugins/dsh-cockpit')

  const patch = patchText(home, 'desktop')
  assert.match(patch, /- id: dsh-cockpit\n\s+name: "dsh-skills-cockpit"/, 'entry added to an insert block')
  assert.equal((patch.match(/id: dsh-cockpit/g) ?? []).length, 1)
  assert.ok(patch.indexOf('id: dsh-cockpit') < patch.indexOf('- id: ui-theme'), 'stays inside the first insert block')
})

test('running it twice changes nothing the second time', () => {
  const home = makeHome({ 'desktop': PATCH })
  install(home, ['--copy'])
  const first = patchText(home, 'desktop')
  const second = install(home, ['--copy'])

  assert.equal(second.status, 0, second.output)
  assert.equal(patchText(home, 'desktop'), first, 'patch is untouched')
  assert.equal((first.match(/id: dsh-cockpit/g) ?? []).length, 1, 'no duplicate entry')
  assert.match(second.output, /already there|already present/)
})

test('a legacy profile is migrated instead of loaded twice', () => {
  const home = makeHome({
    'desktop': PATCH.replace(
      '- insert:',
      '- insert:\n    # DSH Skill Cockpit\n    - id: dsh-cockpit\n      name: "@local/dsh-cockpit"\n    - id: legacy-other\n      name: "whatever"',
    ),
  })
  writeProfileJson(home, 'desktop', { dependencies: { '@local/dsh-cockpit': 'link:../../plugins/dsh-cockpit' } })

  const run = install(home, ['--copy'])
  assert.equal(run.status, 0, run.output)

  const deps = readProfileJson(home, 'desktop').dependencies
  assert.equal(deps['@local/dsh-cockpit'], undefined, 'old dependency key is gone')
  assert.equal(deps[PKG], 'link:../../plugins/dsh-cockpit')

  const patch = patchText(home, 'desktop')
  assert.match(patch, /name: "dsh-skills-cockpit"/)
  assert.ok(!patch.includes('@local/dsh-cockpit'), 'no stale name left behind')
  assert.ok(patch.includes('id: legacy-other'), 'neighbour entries survive')
})

test('--dry-run reports the plan and touches nothing', () => {
  const home = makeHome({ 'desktop': PATCH })
  const run = install(home, ['--copy', '--dry-run'])

  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /would/)
  assert.ok(!fs.existsSync(path.join(home, 'plugins', 'dsh-cockpit')))
  assert.equal(patchText(home, 'desktop'), PATCH)
  assert.deepEqual(readProfileJson(home, 'desktop').dependencies ?? {}, {})
})

test('--uninstall takes the entry, the dependency and the link back out', () => {
  const home = makeHome({ 'desktop': PATCH })
  install(home, ['--copy'])
  const run = install(home, ['--uninstall'])

  assert.equal(run.status, 0, run.output)
  assert.ok(!patchText(home, 'desktop').includes('dsh-cockpit'), 'patch entry removed')
  assert.equal(readProfileJson(home, 'desktop').dependencies[PKG], undefined)
  assert.ok(!fs.existsSync(path.join(home, 'profiles', 'desktop', 'node_modules', PKG)))
  assert.ok(fs.existsSync(path.join(home, 'plugins', 'dsh-cockpit')), 'the copied plugin is left for the person to delete')
})

test('an unknown profile fails loudly instead of writing somewhere odd', () => {
  const home = makeHome({ 'desktop': PATCH })
  const run = install(home, ['--profile', 'nope'])

  assert.equal(run.status, 1)
  assert.match(run.output, /profile "nope" not found/)
  assert.match(run.output, /desktop/, 'the message names the profiles that do exist')
})

// ---------------------------------------------------------------------------

function makeHome(profiles) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cockpit-home-'))
  homes.push(home)
  for (const [name, patch] of Object.entries(profiles)) {
    const dir = path.join(home, 'profiles', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), patch)
    writeProfileJson(home, name, { name: `dsh-profile-${name}`, dependencies: {} })
  }
  return home
}

function install(home, args) {
  const run = spawnSync(process.execPath, [INSTALLER, '--home', home, '--profile', 'desktop', ...args], { encoding: 'utf8' })
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` }
}

function patchText(home, profile) {
  return fs.readFileSync(path.join(home, 'profiles', profile, 'cordis.patch.yml'), 'utf8')
}

function writeProfileJson(home, profile, value) {
  const file = path.join(home, 'profiles', profile, 'package.json')
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function readProfileJson(home, profile) {
  return JSON.parse(fs.readFileSync(path.join(home, 'profiles', profile, 'package.json'), 'utf8'))
}

function deps(home) {
  return { desktop: readProfileJson(home, 'desktop').dependencies ?? {} }
}
