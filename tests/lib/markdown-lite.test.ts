import { describe, it, expect } from 'vitest'
import { parseMarkdownLite } from '@/lib/markdown-lite'

describe('parseMarkdownLite', () => {
  it('returns [] for null/undefined/empty/whitespace-only input', () => {
    expect(parseMarkdownLite(null)).toEqual([])
    expect(parseMarkdownLite(undefined)).toEqual([])
    expect(parseMarkdownLite('')).toEqual([])
    expect(parseMarkdownLite('   \n  \n\t')).toEqual([])
  })

  it('parses "## " into an h2 node', () => {
    const nodes = parseMarkdownLite('## Heading')
    expect(nodes).toEqual([{ kind: 'h2', content: [{ bold: false, text: 'Heading' }] }])
  })

  it('parses "### " into an h3 node', () => {
    const nodes = parseMarkdownLite('### Subheading')
    expect(nodes).toEqual([{ kind: 'h3', content: [{ bold: false, text: 'Subheading' }] }])
  })

  it('groups consecutive "- " lines into one ul, ending the group on a non-list line', () => {
    const nodes = parseMarkdownLite('- one\n- two\n- three\nNot a list item')
    expect(nodes).toEqual([
      {
        kind: 'ul',
        items: [
          [{ bold: false, text: 'one' }],
          [{ bold: false, text: 'two' }],
          [{ bold: false, text: 'three' }],
        ],
      },
      { kind: 'p', content: [{ bold: false, text: 'Not a list item' }] },
    ])
  })

  it('separates paragraphs on blank lines', () => {
    const nodes = parseMarkdownLite('First paragraph.\n\nSecond paragraph.')
    expect(nodes).toEqual([
      { kind: 'p', content: [{ bold: false, text: 'First paragraph.' }] },
      { kind: 'p', content: [{ bold: false, text: 'Second paragraph.' }] },
    ])
  })

  it('joins consecutive non-blank plain lines into one paragraph, newline-separated', () => {
    const nodes = parseMarkdownLite('Line one\nLine two')
    expect(nodes).toEqual([{ kind: 'p', content: [{ bold: false, text: 'Line one\nLine two' }] }])
  })

  it('parses "**bold**" into a bold MdInline segment', () => {
    const nodes = parseMarkdownLite('Hello **world** today')
    expect(nodes).toEqual([
      {
        kind: 'p',
        content: [
          { bold: false, text: 'Hello ' },
          { bold: true, text: 'world' },
          { bold: false, text: ' today' },
        ],
      },
    ])
  })

  it('keeps an unmatched "**" literal', () => {
    const nodes = parseMarkdownLite('Hello **world')
    expect(nodes).toEqual([{ kind: 'p', content: [{ bold: false, text: 'Hello **world' }] }])
  })

  it('keeps raw HTML as literal text, never as a node kind or markup', () => {
    const nodes = parseMarkdownLite('<script>alert(1)</script>')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].kind).toBe('p')
    expect(nodes[0]).toEqual({
      kind: 'p',
      content: [{ bold: false, text: '<script>alert(1)</script>' }],
    })
  })
})
