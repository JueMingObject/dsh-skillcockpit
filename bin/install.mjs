#!/usr/bin/env node
// One-step installer for DSH Skill Cockpit.
//
// A DSH client plugin needs three things to come alive:
//   1. the package present under a profile's node_modules;
//   2. the profile package.json depending on it, so a later `pnpm install`
//      does not drop it;
//   3. an `insert:` entry in the profile's cordis.patch.yml, naming the id the
//      bundle mounts as.
//
// Doing that by hand is four steps and two of them are easy to get wrong, so
// this script does all three and then tells you to restart DSH.
//
// Usage:
//   npx -y github:JueMingObject/dsh-skillcockpit          install into desktop
//   npx -y github:JueMingObject/dsh-skillcockpit --dev D:\src\dsh-cockpit
//   node bin/install.mjs --profile web --dry-run
//   node bin/install.mjs --uninstall
//
// Flags:
//   --home <dir>      DSH home (default: $DSH_HOME, else ~/.dsh)
//   --profile <name>  profile to install into (default: desktop)
//   --dev <dir>       link a working checkout instead of copying this package
//   --copy            copy this package even when it runs from a checkout
//   --uninstall       remove the profile patch entry, the dependency, the link
//   --dry-run         print what would change, touch nothing
//   --force           overwrite an existing plugin directory / link
//
// Exit codes: 0 on success, 1 on a refused or failed step.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_NAME = 'dsh-skills-cockpit'
const PLUGIN_ID = 'dsh-cockpit'
const PLUGIN_DIR = 'dsh-cockpit'
/** Names this plugin shipped under before it was published; migrated on install. */
const LEGACY_NAMES = ['@local/dsh-cockpit', '@local/dsh-skill-cockpit']
/** Copied into $DSH_HOME/plugins; everything else in the repo is dev-only. */
const SKIP = new Set(['node_modules', '.git', 'tests', 'src', 'bin', 'scripts', '.github', '.gitignore'])

const argv = process.argv.slice(2)
const flags = parseArgs(argv)
if (flags.help) {
  printHelp()
  process.exit(0)
}

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOME = path.resolve(flags.home ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'))
const PROFILE_DIR = path.join(HOME, 'profiles', flags.profile)
const PLUGIN_DIR_PATH = path.join(HOME, 'plugins', PLUGIN_DIR)
/** A checkout (dev) drops the copying step; an npx cache does not. */
const DEV_SOURCE = flags.dev
  ? path.resolve(flags.dev)
  : flags.copy ? undefined
    : /[\\/]node_modules[\\/]|_npx/.test(SRC_ROOT) ? undefined : SRC_ROOT

const steps = []
let failed = false

main()

// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(HOME)) fail(`DSH home not found: ${HOME}`)
  if (!fs.existsSync(PROFILE_DIR)) {
    const known = safeList(path.join(HOME, 'profiles')).join(', ') || 'none'
    fail(`profile "${flags.profile}" not found under ${path.join(HOME, 'profiles')} (have: ${known})`)
  }

  if (flags.uninstall) uninstall()
  else install()

  report()
  process.exit(failed ? 1 : 0)
}

function install() {
  materialisePlugin()
  const dep = `link:${posix(path.relative(PROFILE_DIR, PLUGIN_DIR_PATH))}`
  writeProfileDependency(dep)
  linkIntoNodeModules()
  ensurePatchEntry()
  steps.push('')
  steps.push(`Next: quit DSH completely and start it again (the client bundle list is`)
  steps.push(`built once at launch). The slash menu and the cockpit tab appear after that.`)
}

function uninstall() {
  removePatchEntry()
  removeProfileDependency()
  removeNodeModulesEntry()
  steps.push('')
  steps.push(`The copied plugin stays at ${PLUGIN_DIR_PATH}; delete it if you want it gone.`)
  steps.push('Restart DSH for the menu and the tab to disappear.')
}

/** Put the plugin under $DSH_HOME/plugins, copying it or linking a checkout. */
function materialisePlugin() {
  fs.mkdirSync(path.dirname(PLUGIN_DIR_PATH), { recursive: true })
  const existing = linkTargetOf(PLUGIN_DIR_PATH)

  if (DEV_SOURCE) {
    if (existing === path.resolve(DEV_SOURCE)) {
      steps.push(`link: ${PLUGIN_DIR_PATH} -> ${DEV_SOURCE} (already there)`)
      return
    }
    if (fs.existsSync(PLUGIN_DIR_PATH)) {
      if (!flags.force) fail(`${PLUGIN_DIR_PATH} exists; pass --force to replace it with a link`)
      removePath(PLUGIN_DIR_PATH)
    }
    act(`link ${PLUGIN_DIR_PATH} -> ${DEV_SOURCE}`, () => fs.symlinkSync(path.resolve(DEV_SOURCE), PLUGIN_DIR_PATH, 'junction'))
    return
  }

  if (existing !== undefined && !flags.force) {
    // An existing symlink is a dev link; leave it unless the person says otherwise.
    steps.push(`keep: ${PLUGIN_DIR_PATH} (symlink, not overwriting without --force)`)
    return
  }
  if (fs.existsSync(PLUGIN_DIR_PATH) && !linkTargetOf(PLUGIN_DIR_PATH)) {
    const version = readJson(path.join(PLUGIN_DIR_PATH, 'package.json'))?.version
    const mine = readJson(path.join(SRC_ROOT, 'package.json'))?.version
    if (version === mine) {
      steps.push(`keep: ${PLUGIN_DIR_PATH} (version ${version} already installed)`)
      return
    }
  }
  act(`copy ${SRC_ROOT} -> ${PLUGIN_DIR_PATH}`, () => {
    removePath(PLUGIN_DIR_PATH)
    fs.mkdirSync(PLUGIN_DIR_PATH, { recursive: true })
    for (const entry of fs.readdirSync(SRC_ROOT)) {
      if (SKIP.has(entry)) continue
      fs.cpSync(path.join(SRC_ROOT, entry), path.join(PLUGIN_DIR_PATH, entry), { recursive: true })
    }
  })
}

/** Declare the dependency so a later profile `pnpm install` keeps it. */
function writeProfileDependency(spec) {
  const file = path.join(PROFILE_DIR, 'package.json')
  const pkg = readJson(file)
  if (!pkg) return fail(`cannot read ${file}`)
  const deps = pkg.dependencies ?? {}
  const changed = []

  for (const legacy of LEGACY_NAMES) {
    if (legacy in deps && pointsAtSamePlace(deps[legacy], spec)) {
      delete deps[legacy]
      changed.push(`- ${legacy}`)
    }
  }
  if (deps[PKG_NAME] !== spec) {
    deps[PKG_NAME] = spec
    changed.push(`+ ${PKG_NAME} ${spec}`)
  } else {
    steps.push(`dep: ${PKG_NAME} ${spec} (already there)`)
    return
  }
  pkg.dependencies = deps
  act(`update ${file}: ${changed.join(' ')}`, () => fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`))
}

/** Make the package resolvable from the profile, with pnpm when it is around. */
function linkIntoNodeModules() {
  const target = path.join(PROFILE_DIR, 'node_modules', PKG_NAME)
  if (linkTargetOf(target) === path.resolve(PLUGIN_DIR_PATH) && fs.existsSync(target)) {
    steps.push(`resolve: node_modules/${PKG_NAME} (already linked)`)
    return
  }

  const pnpm = findPnpm()
  if (pnpm) {
    const args = [...pnpm.args, 'install', '--reporter=append-only']
    if (flags.dryRun) {
      steps.push(`would run: ${pnpm.label} ${args.join(' ')} (cwd ${PROFILE_DIR})`)
      return
    }
    const pretty = `${pnpm.label} ${args.join(' ')}`
    process.stdout.write(`> ${pretty}\n`)
    const result = spawnSync(pnpm.command, args, { cwd: PROFILE_DIR, stdio: 'inherit' })
    if (result.status === 0 && fs.existsSync(target)) {
      steps.push(`resolve: ${PKG_NAME} via pnpm`)
      return
    }
    steps.push(`warn: ${pretty} did not produce node_modules/${PKG_NAME}; falling back to a link`)
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target) || linkTargetOf(target)) removePath(target)
  act(`link node_modules/${PKG_NAME} -> ${PLUGIN_DIR_PATH}`, () => {
    try {
      fs.symlinkSync(path.resolve(PLUGIN_DIR_PATH), target, 'junction')
    } catch {
      fs.cpSync(PLUGIN_DIR_PATH, target, { recursive: true })
    }
  })
}

/** Add (or refresh) the `insert:` entry that mounts the bundle. */
function ensurePatchEntry() {
  const file = path.join(PROFILE_DIR, 'cordis.patch.yml')
  if (!fs.existsSync(file)) return fail(`cannot find ${file}`)
  const text = fs.readFileSync(file, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  const entry = findEntry(lines, PLUGIN_ID)
  if (entry) {
    const patched = lines.slice()
    let touched = false
    for (let i = entry.start; i <= entry.end; i += 1) {
      if (/^\s*name:\s*/.test(patched[i]) && !new RegExp(`name:\\s*["']?${escapeRe(PKG_NAME)}["']?\\s*$`).test(patched[i])) {
        patched[i] = patched[i].replace(/name:\s*.*$/, `name: "${PKG_NAME}"`)
        touched = true
      }
      if (/^\s*disabled:\s*true\s*$/.test(patched[i])) {
        patched[i] = patched[i].replace(/disabled:\s*true/, 'disabled: false')
        touched = true
      }
    }
    if (!touched) {
      steps.push(`patch: entry ${PLUGIN_ID} already present`)
      return
    }
    act(`patch ${file}: refresh entry ${PLUGIN_ID} to ${PKG_NAME}`, () => fs.writeFileSync(file, patched.join(eol)))
    return
  }

  const block = [`    - id: ${PLUGIN_ID}`, `      name: "${PKG_NAME}"`]
  const insertAt = lines.findIndex(line => /^-\s*insert:\s*$/.test(line))
  if (insertAt === -1) {
    act(`patch ${file}: append an insert block for ${PLUGIN_ID}`, () =>
      fs.writeFileSync(file, `${text.replace(/\s*$/, '')}${eol}- insert:${eol}${block.join(eol)}${eol}`))
    return
  }
  act(`patch ${file}: insert ${PLUGIN_ID} into the first insert block`, () => {
    const out = lines.slice()
    out.splice(insertAt + 1, 0, ...block)
    fs.writeFileSync(file, out.join(eol))
  })
}

function removePatchEntry() {
  const file = path.join(PROFILE_DIR, 'cordis.patch.yml')
  if (!fs.existsSync(file)) return steps.push(`patch: ${file} does not exist`)
  const text = fs.readFileSync(file, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const entry = findEntry(lines, PLUGIN_ID)
  if (!entry) return steps.push(`patch: no ${PLUGIN_ID} entry to remove`)
  let start = entry.start
  // Take the comment line that introduces the entry with it.
  if (/^\s*#/.test(lines[start - 1] ?? '') && /cockpit|skill/i.test(lines[start - 1])) start -= 1
  act(`patch ${file}: remove entry ${PLUGIN_ID}`, () => {
    const out = lines.slice()
    out.splice(start, entry.end - start + 1)
    fs.writeFileSync(file, out.join(eol))
  })
}

function removeProfileDependency() {
  const file = path.join(PROFILE_DIR, 'package.json')
  const pkg = readJson(file)
  if (!pkg) return
  const deps = pkg.dependencies ?? {}
  const removed = [PKG_NAME, ...LEGACY_NAMES].filter(name => name in deps)
  if (removed.length === 0) return steps.push(`dep: nothing to remove`)
  for (const name of removed) delete deps[name]
  pkg.dependencies = deps
  act(`update ${file}: - ${removed.join(', ')}`, () => fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`))
}

function removeNodeModulesEntry() {
  for (const name of [PKG_NAME, ...LEGACY_NAMES]) {
    const target = path.join(PROFILE_DIR, 'node_modules', name)
    if (fs.existsSync(target) || linkTargetOf(target)) act(`remove node_modules/${name}`, () => removePath(target))
  }
}

// ---------------------------------------------------------------------------

/**
 * Find the sequence item for one id inside a patch list.
 * @param {string[]} lines
 * @param {string} id
 * @returns {{ start: number, end: number } | undefined} first and last line of the item
 */
function findEntry(lines, id) {
  const head = new RegExp(`^(\\s*)- id:\\s*["']?${escapeRe(id)}["']?\\s*$`)
  for (let i = 0; i < lines.length; i += 1) {
    const match = head.exec(lines[i])
    if (!match) continue
    const indent = match[1].length
    let end = i
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j]
      if (line.trim() === '') continue
      const lineIndent = line.length - line.trimStart().length
      if (/^\s*- /.test(line) && lineIndent <= indent) break
      end = j
    }
    return { start: i, end }
  }
  return undefined
}

/** Distance of one node_modules entry from the profile's plugin link, by resolved target. */
function pointsAtSamePlace(manifestSpec, wanted) {
  const left = String(manifestSpec).replace(/^(?:link|file):/, '')
  const right = String(wanted).replace(/^(?:link|file):/, '')
  return posix(path.normalize(left)) === posix(path.normalize(right))
}

/** pnpm bundled with DSH, or a global one, as a ready-to-spawn command. */
function findPnpm() {
  const probes = []
  if (process.env.DSH_PNPM) probes.push({ command: process.execPath, args: [process.env.DSH_PNPM], label: 'pnpm' })

  const where = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pnpm'], { encoding: 'utf8' })
  const onPath = (where.status === 0 ? where.stdout : '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0]
  if (onPath) probes.push({ command: onPath, args: [], label: 'pnpm' })

  const appDirs = [
    process.env.DSH_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'DeepSeek Harness'),
  ].filter(Boolean)
  for (const dir of appDirs) {
    const mjs = path.join(dir, 'resources', 'runtime', 'pnpm', 'bin', 'pnpm.mjs')
    if (fs.existsSync(mjs)) probes.push({ command: process.execPath, args: [mjs], label: 'pnpm (bundled)' })
  }

  for (const probe of probes) {
    const check = spawnSync(probe.command, [...probe.args, '--version'], { encoding: 'utf8' })
    if (check.status === 0) return probe
  }
  return undefined
}

function act(label, run) {
  if (flags.dryRun) {
    steps.push(`would ${label}`)
    return
  }
  try {
    run()
    steps.push(label)
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function report() {
  const prefix = flags.dryRun ? 'dry run · ' : ''
  process.stdout.write(`\n${prefix}DSH Skill Cockpit -> profile "${flags.profile}"\n`)
  for (const line of steps) process.stdout.write(`  ${line}\n`)
  if (failed) process.stdout.write('\nOne step failed; fix it and run the command again.\n')
  process.stdout.write('')
}

function fail(message) {
  failed = true
  process.stdout.write(`error: ${message}\n`)
  process.exit(1)
}

function parseArgs(args) {
  const out = { profile: 'desktop', uninstall: false, dryRun: false, force: false, copy: false, help: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--uninstall' || arg === 'remove') out.uninstall = true
    else if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--force') out.force = true
    else if (arg === '--copy') out.copy = true
    else if (arg === '--home') out.home = args[++i]
    else if (arg === '--profile') out.profile = args[++i] ?? out.profile
    else if (arg === '--dev') out.dev = args[++i]
    else if (arg === 'install') continue
    else fail(`unknown argument: ${arg} (try --help)`)
  }
  if (out.profile === undefined || out.profile === '') fail('--profile needs a name')
  return out
}

function printHelp() {
  process.stdout.write(`
dsh-skills-cockpit — grouped, drillable skill menu for DeepSeek Harness

  npx -y github:JueMingObject/dsh-skillcockpit [--profile desktop]
  node bin/install.mjs --dev <checkout>      link your working copy
  node bin/install.mjs --uninstall           take it back out
  node bin/install.mjs --dry-run             print the plan, change nothing

Flags: --home <dir>  --profile <name>  --dev <dir>  --copy  --uninstall  --dry-run  --force
`)
}

function linkTargetOf(target) {
  try {
    return fs.realpathSync(target)
  } catch {
    return undefined
  }
}

function removePath(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return undefined
  }
}

function safeList(dir) {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

function posix(value) {
  return value.split(path.sep).join('/')
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
