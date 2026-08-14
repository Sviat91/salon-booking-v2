// Ported verbatim from the real src/lib/markdown-lite.ts — framework-free,
// no changes needed.
export type MdInline = { bold: boolean; text: string }
export type MdNode =
  | { kind: 'h2' | 'h3' | 'p'; content: MdInline[] }
  | { kind: 'ul'; items: MdInline[][] }

function parseInline(text: string): MdInline[] {
  const result: MdInline[] = []
  const boldPattern = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ bold: false, text: text.slice(lastIndex, match.index) })
    }
    result.push({ bold: true, text: match[1] })
    lastIndex = boldPattern.lastIndex
  }
  if (lastIndex < text.length) {
    result.push({ bold: false, text: text.slice(lastIndex) })
  }
  if (result.length === 0) {
    result.push({ bold: false, text: '' })
  }
  return result
}

export function parseMarkdownLite(src: string | null | undefined): MdNode[] {
  if (!src || !src.trim()) return []

  const nodes: MdNode[] = []
  let paragraphLines: string[] = []
  let listItems: MdInline[][] = []

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      nodes.push({ kind: 'p', content: parseInline(paragraphLines.join('\n')) })
      paragraphLines = []
    }
  }
  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push({ kind: 'ul', items: listItems })
      listItems = []
    }
  }

  for (const line of src.split('\n')) {
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }
    if (line.startsWith('## ')) {
      flushParagraph()
      flushList()
      nodes.push({ kind: 'h2', content: parseInline(line.slice(3)) })
      continue
    }
    if (line.startsWith('### ')) {
      flushParagraph()
      flushList()
      nodes.push({ kind: 'h3', content: parseInline(line.slice(4)) })
      continue
    }
    if (line.startsWith('- ')) {
      flushParagraph()
      listItems.push(parseInline(line.slice(2)))
      continue
    }
    flushList()
    paragraphLines.push(line)
  }
  flushParagraph()
  flushList()

  return nodes
}
