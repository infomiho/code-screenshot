type SkeletonLine = { indent: number; width: number }

const skeletonLines: readonly SkeletonLine[] = [
  { indent: 0, width: 44 },
  { indent: 0, width: 0 },
  { indent: 0, width: 58 },
  { indent: 4, width: 22 },
  { indent: 8, width: 30 },
  { indent: 4, width: 6 },
  { indent: 0, width: 0 },
  { indent: 4, width: 46 },
  { indent: 8, width: 14 },
  { indent: 12, width: 26 },
  { indent: 12, width: 24 },
  { indent: 12, width: 40 },
  { indent: 8, width: 8 },
  { indent: 4, width: 6 },
  { indent: 0, width: 4 },
]

export function EditorSkeleton() {
  return (
    <div className="editor-skeleton" aria-hidden="true">
      {skeletonLines.map((line, index) => (
        <span
          key={index}
          style={{ marginInlineStart: `${line.indent}%`, width: `${line.width}%` }}
        />
      ))}
    </div>
  )
}
