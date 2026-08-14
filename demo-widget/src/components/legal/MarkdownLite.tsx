import { Fragment } from 'react'
import { parseMarkdownLite, type MdInline } from '../../lib/markdown-lite'

function InlineRun({ content }: { content: MdInline[] }) {
  return (
    <>
      {content.map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : <Fragment key={i}>{part.text}</Fragment>))}
    </>
  )
}

export default function MarkdownLite({ source }: { source: string }) {
  const nodes = parseMarkdownLite(source)

  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === 'h2') {
          return (
            <h2 key={i} className="text-xl font-semibold text-foreground mt-8 mb-4">
              <InlineRun content={node.content} />
            </h2>
          )
        }
        if (node.kind === 'h3') {
          return (
            <h3 key={i} className="text-lg font-medium text-foreground mt-6 mb-3">
              <InlineRun content={node.content} />
            </h3>
          )
        }
        if (node.kind === 'ul') {
          return (
            <ul key={i} className="list-disc pl-6 mb-4 text-foreground space-y-1">
              {node.items.map((item, j) => (
                <li key={j}>
                  <InlineRun content={item} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-foreground mb-4 whitespace-pre-line">
            <InlineRun content={node.content} />
          </p>
        )
      })}
    </>
  )
}
