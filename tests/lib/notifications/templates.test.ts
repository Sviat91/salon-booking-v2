/// <reference types='vitest' />

import { describe, expect, it } from 'vitest'
import {
  renderTemplate,
  validateTemplateBody,
  estimateSmsSegments,
  escapeHtml,
  DEFAULT_REMINDER_BODIES,
  TEMPLATE_PLACEHOLDERS,
  REMINDER_TEMPLATE_TYPES,
  REMINDER_CHANNELS,
  MAX_BODY_LENGTH,
  type TemplateVars,
} from '../../../src/lib/notifications/templates'
import { SUPPORTED_LANGUAGES } from '../../../src/lib/i18n-shared'

const vars: TemplateVars = {
  clientName: 'Jan',
  date: '10.04.2026',
  time: '10:00',
  service: 'Manicure',
  master: 'Anna',
  brandName: 'Somique',
}

describe('renderTemplate', () => {
  it('substitutes every known placeholder', () => {
    const body = '{{brandName}}: {{clientName}}, {{service}} with {{master}} on {{date}} at {{time}}'
    expect(renderTemplate(body, vars)).toBe(
      'Somique: Jan, Manicure with Anna on 10.04.2026 at 10:00'
    )
  })

  it('handles spaced tokens', () => {
    expect(renderTemplate('{{ clientName }}', vars)).toBe('Jan')
  })

  it('leaves an unknown placeholder literal', () => {
    expect(renderTemplate('{{nope}}', vars)).toBe('{{nope}}')
  })

  it('handles repeated tokens', () => {
    expect(renderTemplate('{{time}} - {{time}}', vars)).toBe('10:00 - 10:00')
  })
})

describe('validateTemplateBody', () => {
  it('accepts a clean body', () => {
    expect(validateTemplateBody('{{brandName}}: {{time}}')).toEqual({ ok: true })
  })

  it('reports unknown tokens', () => {
    const result = validateTemplateBody('{{brandName}} {{nope}} {{alsoNope}}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.unknown).toEqual(['nope', 'alsoNope'])
    }
  })
})

describe('estimateSmsSegments', () => {
  it('detects GSM-7 boundary: 160 chars = 1 segment', () => {
    const text = 'a'.repeat(160)
    const result = estimateSmsSegments(text)
    expect(result.encoding).toBe('gsm7')
    expect(result.segments).toBe(1)
  })

  it('detects GSM-7 boundary: 161 chars = 2 segments', () => {
    const text = 'a'.repeat(161)
    const result = estimateSmsSegments(text)
    expect(result.encoding).toBe('gsm7')
    expect(result.segments).toBe(2)
  })

  it('switches to UCS-2 for Polish diacritics', () => {
    const result = estimateSmsSegments('zażółć gęślą jaźń ą ę')
    expect(result.encoding).toBe('ucs2')
  })

  it('detects UCS-2 boundary: 70 chars = 1 segment', () => {
    const text = 'ą'.repeat(70)
    const result = estimateSmsSegments(text)
    expect(result.encoding).toBe('ucs2')
    expect(result.segments).toBe(1)
  })

  it('detects UCS-2 boundary: 71 chars = 2 segments', () => {
    const text = 'ą'.repeat(71)
    const result = estimateSmsSegments(text)
    expect(result.encoding).toBe('ucs2')
    expect(result.segments).toBe(2)
  })
})

describe('DEFAULT_REMINDER_BODIES', () => {
  it('has a non-empty entry for every channel × type × language', () => {
    for (const channel of REMINDER_CHANNELS) {
      for (const type of REMINDER_TEMPLATE_TYPES) {
        for (const lang of SUPPORTED_LANGUAGES) {
          expect(DEFAULT_REMINDER_BODIES[channel][type][lang]).toBeTruthy()
        }
      }
    }
  })

  it('every token used is in TEMPLATE_PLACEHOLDERS', () => {
    const tokenRe = /\{\{\s*(\w+)\s*\}\}/g
    for (const channel of REMINDER_CHANNELS) {
      for (const type of REMINDER_TEMPLATE_TYPES) {
        for (const lang of SUPPORTED_LANGUAGES) {
          const body = DEFAULT_REMINDER_BODIES[channel][type][lang]
          for (const match of body.matchAll(tokenRe)) {
            expect(TEMPLATE_PLACEHOLDERS).toContain(match[1])
          }
        }
      }
    }
  })

  it('every default body fits its channel MAX_BODY_LENGTH', () => {
    for (const channel of REMINDER_CHANNELS) {
      for (const type of REMINDER_TEMPLATE_TYPES) {
        for (const lang of SUPPORTED_LANGUAGES) {
          const body = DEFAULT_REMINDER_BODIES[channel][type][lang]
          expect(body.length).toBeLessThanOrEqual(MAX_BODY_LENGTH[channel])
        }
      }
    }
  })

  it('the six sms defaults fit in 1 or 2 SMS segments', () => {
    for (const type of REMINDER_TEMPLATE_TYPES) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const body = DEFAULT_REMINDER_BODIES.sms[type][lang]
        const rendered = renderTemplate(body, vars)
        const estimate = estimateSmsSegments(rendered)
        expect(estimate.segments).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('escapeHtml', () => {
  it('escapes &, <, >, ", \' — & first so < does not become &amp;lt;', () => {
    expect(escapeHtml('a & b <c>')).toBe('a &amp; b &lt;c&gt;')
  })

  it('escapes double and single quotes', () => {
    expect(escapeHtml(`"quoted" and 'single'`)).toBe('&quot;quoted&quot; and &#39;single&#39;')
  })

  it('leaves a body with no special characters unchanged', () => {
    expect(escapeHtml('Plain text, no markup here.')).toBe('Plain text, no markup here.')
  })

  it('composed with renderTemplate over an email default with a & in the service name produces &amp; exactly once', () => {
    const body = DEFAULT_REMINDER_BODIES.email.BOOKING_REMINDER_24H.en
    const rendered = renderTemplate(body, { ...vars, service: 'Hair & Nails' })
    const escaped = escapeHtml(rendered)
    const matches = escaped.match(/&amp;/g) ?? []
    expect(matches).toHaveLength(1)
  })
})
