#!/usr/bin/env node
/**
 * i18n-check
 *
 * 1. Flattens src/locales/{pl,en,uk}.json and asserts identical key sets across all 3.
 * 2. Scans src/** for `t('key')` / `t('key', 'fallback')` / `i18n.t('key')` string-literal
 *    calls and reports any referenced key that is missing from all 3 locale files
 *    (a missing key silently renders react-i18next's inline fallback in every language).
 *
 * Usage: node scripts/i18n-check.mjs
 * Exit code 0 = pass, 1 = fail (prints a report either way).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales')
const SRC_DIR = path.join(ROOT, 'src')
const LANGS = ['pl', 'en', 'uk']

/** Flattens a nested object into a Set of dot-separated leaf key paths. */
function flatten(obj, prefix = '') {
  const keys = new Set()
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flatten(value, fullKey)) keys.add(nested)
    } else {
      keys.add(fullKey)
    }
  }
  return keys
}

function loadLocaleKeys(lang) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`)
  const raw = fs.readFileSync(filePath, 'utf8')
  return flatten(JSON.parse(raw))
}

function walkSourceFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

// Matches `i18n.t('key', ...)` and bare `t('key', ...)` string-literal calls.
// The negative lookbehind on the bare-`t(` alternative prevents false positives
// like `format(`, `sort(`, or the `t(` inside an already-matched `i18n.t(`.
const CALL_REGEX = /\bi18n\.t\(\s*['"]([^'"]+)['"]|(?<![\w.])t\(\s*['"]([^'"]+)['"]/g

function extractReferencedKeys(files) {
  const keys = new Set()
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    CALL_REGEX.lastIndex = 0
    let match
    while ((match = CALL_REGEX.exec(content)) !== null) {
      const key = match[1] || match[2]
      if (key) keys.add(key)
    }
  }
  return keys
}

function main() {
  let ok = true

  const localeKeys = {}
  for (const lang of LANGS) {
    localeKeys[lang] = loadLocaleKeys(lang)
  }

  const allKeys = new Set()
  for (const lang of LANGS) {
    for (const key of localeKeys[lang]) allKeys.add(key)
  }

  console.log('=== i18n-check: locale key parity (pl/en/uk) ===')
  for (const lang of LANGS) {
    const missing = [...allKeys].filter((key) => !localeKeys[lang].has(key)).sort()
    if (missing.length > 0) {
      ok = false
      console.log(`\n[FAIL] ${lang}.json is missing ${missing.length} key(s):`)
      for (const key of missing) console.log(`  - ${key}`)
    } else {
      console.log(`[PASS] ${lang}.json has all ${localeKeys[lang].size} keys`)
    }
  }

  console.log('\n=== i18n-check: t()/i18n.t() referenced-key coverage ===')
  const referenced = extractReferencedKeys(walkSourceFiles(SRC_DIR))
  const missingFromAll = [...referenced]
    .filter((key) => !LANGS.every((lang) => localeKeys[lang].has(key)))
    .sort()

  if (missingFromAll.length > 0) {
    ok = false
    console.log(`\n[FAIL] ${missingFromAll.length} referenced key(s) missing from all 3 locale files:`)
    for (const key of missingFromAll) console.log(`  - ${key}`)
  } else {
    console.log(`[PASS] All ${referenced.size} referenced t()/i18n.t() keys resolve in all 3 locale files`)
  }

  console.log('\n=== Result ===')
  if (ok) {
    console.log('PASS: locale files are in sync and all referenced keys resolve.')
    process.exit(0)
  } else {
    console.log('FAIL: see issues above.')
    process.exit(1)
  }
}

main()
