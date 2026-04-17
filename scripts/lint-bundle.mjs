#!/usr/bin/env node
/**
 * Post-build bundle and asset budget guard. Runs against the real `dist/`
 * directory — not a dev-server heuristic, not a unit-test approximation —
 * and exits non-zero on any budget overage. Wired as a `postbuild` hook in
 * package.json so `npm run build` fails loudly if any of the ceilings are
 * exceeded.
 *
 * Budgets (enforced):
 *  - ≤ 150 KB gzipped sum across every `dist/assets/*.js` file (criterion 2).
 *  - Exactly one JS entry chunk under `dist/assets/` (criterion 1).
 *  - ≤ 100 KB gzipped for `src/data/chunks.json` (its inlined equivalent in
 *    the JS bundle; criterion 3).
 *  - ≤ 40 KB combined gzipped for the two woff2 files (criterion 4).
 *  - ≤ 100 KB on-disk for `src/theme/leader.svg` (criterion 5).
 *  - No `manifest.webmanifest`, no service worker, no external CDN URLs in
 *    the built output (criterion 6 / 16).
 *
 * Zero dependencies — pure Node built-ins. Ships under `scripts/` so the
 * test pipeline stays byte-identical and the verification surface is
 * discoverable without reading package.json.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import process from 'node:process'

const REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const DIST = resolve(REPO_ROOT, 'dist')
const DIST_ASSETS = resolve(DIST, 'assets')
const CHUNKS_JSON = resolve(REPO_ROOT, 'src/data/chunks.json')
const FONT_700 = resolve(REPO_ROOT, 'src/theme/fonts/PlayfairDisplay-700.woff2')
const FONT_900 = resolve(REPO_ROOT, 'src/theme/fonts/PlayfairDisplay-900.woff2')
const LEADER_SVG = resolve(REPO_ROOT, 'src/theme/leader.svg')

const KB = 1024
const JS_BUDGET = 150 * KB
const CHUNKS_BUDGET = 100 * KB
const FONTS_BUDGET = 40 * KB
const SVG_BUDGET = 100 * KB

const FORBIDDEN_URL_PATTERNS = [
  /https?:\/\/cdn\./i,
  /https?:\/\/[^\s"']*googleapis\.com/i,
  /https?:\/\/[^\s"']*\.google\.com/i,
  /https?:\/\/[^\s"']*fonts\.google/i,
  /https?:\/\/[^\s"']*gstatic\.com/i,
  /https?:\/\/[^\s"']*unpkg\.com/i,
  /https?:\/\/[^\s"']*jsdelivr\.net/i,
]

const FORBIDDEN_FILE_PATTERNS = [/manifest\.webmanifest$/, /service-?worker/i, /\bsw\.js$/]

const failures = []
const results = []

function fail(msg) {
  failures.push(msg)
}

function report(msg) {
  results.push(msg)
}

function ensureDirExists() {
  try {
    statSync(DIST)
  } catch {
    fail(`dist/ not found at ${DIST} — run \`npm run build\` first.`)
    return false
  }
  return true
}

function listAssetFiles() {
  try {
    return readdirSync(DIST_ASSETS).map((name) => ({
      name,
      path: resolve(DIST_ASSETS, name),
    }))
  } catch {
    fail(`dist/assets/ not found — expected Vite output.`)
    return []
  }
}

function checkSingleJsEntry(assets) {
  const jsFiles = assets.filter((f) => /\.js$/i.test(f.name))
  if (jsFiles.length === 0) {
    fail('No JS files found under dist/assets/ — Vite produced no entry chunk.')
    return []
  }
  if (jsFiles.length > 1) {
    fail(
      `Expected exactly one JS entry chunk under dist/assets/; found ${jsFiles.length}: ${jsFiles
        .map((f) => f.name)
        .join(', ')}.`,
    )
  }
  report(`JS entry chunks: ${jsFiles.length} (${jsFiles.map((f) => f.name).join(', ')})`)
  return jsFiles
}

function checkJsBudget(jsFiles) {
  let totalGzipped = 0
  for (const f of jsFiles) {
    const gz = gzipSync(readFileSync(f.path), { level: 9 }).byteLength
    totalGzipped += gz
    report(
      `  ${f.name}: ${statSync(f.path).size.toLocaleString()} B raw / ${gz.toLocaleString()} B gzipped`,
    )
  }
  report(
    `JS total gzipped: ${totalGzipped.toLocaleString()} B (budget ${JS_BUDGET.toLocaleString()} B)`,
  )
  if (totalGzipped > JS_BUDGET) {
    fail(
      `JS gzipped total ${totalGzipped} B exceeds ${JS_BUDGET} B budget (criterion 2).`,
    )
  }
}

function checkChunksBudget() {
  try {
    const raw = readFileSync(CHUNKS_JSON)
    const gz = gzipSync(raw, { level: 9 }).byteLength
    report(
      `chunks.json gzipped: ${gz.toLocaleString()} B (budget ${CHUNKS_BUDGET.toLocaleString()} B)`,
    )
    if (gz > CHUNKS_BUDGET) {
      fail(`chunks.json gzipped size ${gz} B exceeds ${CHUNKS_BUDGET} B budget (criterion 3).`)
    }
  } catch (err) {
    fail(`Could not read ${CHUNKS_JSON}: ${String(err)}`)
  }
}

function checkFontBudget() {
  try {
    const buf700 = readFileSync(FONT_700)
    const buf900 = readFileSync(FONT_900)
    const combined = Buffer.concat([buf700, buf900])
    const gz = gzipSync(combined, { level: 9 }).byteLength
    report(
      `Fonts combined gzipped: ${gz.toLocaleString()} B (budget ${FONTS_BUDGET.toLocaleString()} B)`,
    )
    if (gz > FONTS_BUDGET) {
      fail(`Combined woff2 gzipped size ${gz} B exceeds ${FONTS_BUDGET} B budget (criterion 4).`)
    }
  } catch (err) {
    fail(`Could not read woff2 files: ${String(err)}`)
  }
}

function checkLeaderSvg() {
  try {
    const size = statSync(LEADER_SVG).size
    report(`leader.svg on disk: ${size.toLocaleString()} B (budget ${SVG_BUDGET.toLocaleString()} B)`)
    if (size > SVG_BUDGET) {
      fail(`leader.svg on-disk size ${size} B exceeds ${SVG_BUDGET} B budget (criterion 5).`)
    }
  } catch (err) {
    fail(`Could not stat ${LEADER_SVG}: ${String(err)}`)
  }
}

function checkNoForbiddenFiles(assets) {
  const distEntries = readdirSync(DIST)
  const forbidden = []
  for (const name of distEntries) {
    if (FORBIDDEN_FILE_PATTERNS.some((p) => p.test(name))) forbidden.push(name)
  }
  for (const f of assets) {
    if (FORBIDDEN_FILE_PATTERNS.some((p) => p.test(f.name))) forbidden.push(`assets/${f.name}`)
  }
  if (forbidden.length > 0) {
    fail(
      `Built output contains prohibited PWA/service-worker/manifest files: ${forbidden.join(', ')} (criterion 6).`,
    )
  } else {
    report('No manifest.webmanifest, service worker, or sw.js present in dist/.')
  }
}

function checkNoExternalCdn(assets) {
  const htmlPath = resolve(DIST, 'index.html')
  const filesToScan = [htmlPath]
  for (const f of assets) {
    if (/\.(js|css|html|svg)$/i.test(f.name)) filesToScan.push(f.path)
  }
  const hits = []
  for (const p of filesToScan) {
    let content
    try {
      content = readFileSync(p, 'utf8')
    } catch {
      continue
    }
    for (const pattern of FORBIDDEN_URL_PATTERNS) {
      const match = content.match(pattern)
      if (match !== null) hits.push(`${p.replace(REPO_ROOT + '/', '')}: ${match[0]}`)
    }
  }
  if (hits.length > 0) {
    fail(`Built output references external CDN URLs (criterion 6/16):\n  ${hits.join('\n  ')}`)
  } else {
    report(`Scanned ${filesToScan.length} built files — zero external CDN references.`)
  }
}

function main() {
  if (!ensureDirExists()) {
    console.error('lint:bundle — setup failed')
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  const assets = listAssetFiles()
  const jsFiles = checkSingleJsEntry(assets)
  checkJsBudget(jsFiles)
  checkChunksBudget()
  checkFontBudget()
  checkLeaderSvg()
  checkNoForbiddenFiles(assets)
  checkNoExternalCdn(assets)

  console.log('lint:bundle — budget audit')
  for (const line of results) console.log(`  ${line}`)
  if (failures.length > 0) {
    console.error('')
    console.error('lint:bundle — FAILED')
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log('lint:bundle — OK (all budgets satisfied)')
}

main()
