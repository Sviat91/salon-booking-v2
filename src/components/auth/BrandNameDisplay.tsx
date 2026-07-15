// Confirmed split rule (user-approved): split brandName on whitespace.
// - 2+ words: all words except the last render in the normal/bold style;
//   the LAST word renders in the existing light/thin style (opacity-70 font-light).
// - 1 word: render the whole thing in the normal/bold style, no thin part (nothing to split).
export function BrandNameDisplay({ brandName }: { brandName: string }) {
  const words = brandName.trim().split(/\s+/)
  if (words.length <= 1) {
    return <>{brandName}</>
  }
  const main = words.slice(0, -1).join(' ')
  const last = words[words.length - 1]
  return (
    <>
      {main} <span className="opacity-70 font-light">{last}</span>
    </>
  )
}
