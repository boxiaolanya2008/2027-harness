export interface DiffRow {
  kind: 'context' | 'addition' | 'deletion'
  text: string
  beforeLine?: number
  afterLine?: number
}

export interface DiffStats {
  additions: number
  deletions: number
}

function lines(value: string | null | undefined): string[] {
  if (value == null || value === '') return []
  return value.replace(/\r\n?/g, '\n').split('\n')
}

export function makeDiffRows(beforeValue: string | null | undefined, afterValue: string | null | undefined): DiffRow[] {
  const before = lines(beforeValue)
  const after = lines(afterValue)

  // Keep the positional fallback for large files so rendering never allocates a huge LCS table.
  const maxCells = 1_200_000
  if (before.length * after.length > maxCells) {
    const rows: DiffRow[] = []
    const length = Math.max(before.length, after.length)
    for (let i = 0; i < length; i += 1) {
      if (i < before.length && i < after.length && before[i] === after[i]) {
        rows.push({ kind: 'context', text: before[i], beforeLine: i + 1, afterLine: i + 1 })
      } else {
        if (i < before.length) rows.push({ kind: 'deletion', text: before[i], beforeLine: i + 1 })
        if (i < after.length) rows.push({ kind: 'addition', text: after[i], afterLine: i + 1 })
      }
    }
    return rows
  }

  const width = after.length + 1
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(width))
  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] = before[beforeIndex] === after[afterIndex]
        ? table[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1])
    }
  }

  const rows: DiffRow[] = []
  let beforeIndex = 0
  let afterIndex = 0
  let beforeLine = 1
  let afterLine = 1
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (beforeIndex < before.length && afterIndex < after.length && before[beforeIndex] === after[afterIndex]) {
      rows.push({ kind: 'context', text: before[beforeIndex], beforeLine, afterLine })
      beforeIndex += 1
      afterIndex += 1
      beforeLine += 1
      afterLine += 1
    } else if (afterIndex < after.length && (beforeIndex >= before.length || table[beforeIndex][afterIndex + 1] >= table[beforeIndex + 1][afterIndex])) {
      rows.push({ kind: 'addition', text: after[afterIndex], afterLine })
      afterIndex += 1
      afterLine += 1
    } else if (beforeIndex < before.length) {
      rows.push({ kind: 'deletion', text: before[beforeIndex], beforeLine })
      beforeIndex += 1
      beforeLine += 1
    }
  }
  return rows
}

export function getDiffStats(before: string | null | undefined, after: string | null | undefined): DiffStats {
  return makeDiffRows(before, after).reduce((stats, row) => {
    if (row.kind === 'addition') stats.additions += 1
    if (row.kind === 'deletion') stats.deletions += 1
    return stats
  }, { additions: 0, deletions: 0 })
}
