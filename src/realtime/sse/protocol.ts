export type SseEvent = {
  event?: string
  data?: string
  id?: string
  retry?: number
}

const assertSingleLine = (field: string, value: string) => {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error(`SSE ${field} must not contain a newline.`)
  }
}

export const encodeSseEvent = ({ event, data = '', id, retry }: SseEvent) => {
  const encodedLines: string[] = []
  if (event !== undefined) {
    assertSingleLine('event', event)
    encodedLines.push(`event: ${event}`)
  }
  if (id !== undefined) {
    assertSingleLine('id', id)
    encodedLines.push(`id: ${id}`)
  }
  if (retry !== undefined) {
    if (!Number.isInteger(retry) || retry < 0) throw new Error('SSE retry must be a non-negative integer.')
    encodedLines.push(`retry: ${retry}`)
  }
  data.split(/\r\n|\r|\n/).forEach((line) => encodedLines.push(`data: ${line}`))
  return `${encodedLines.join('\n')}\n\n`
}

const parseEventBlock = (block: string): SseEvent | null => {
  let event: string | undefined
  let id: string | undefined
  let retry: number | undefined
  const dataLines: string[] = []
  let hasRecognizedField = false

  block.split(/\r\n|\r|\n/).forEach((line) => {
    if (line === '' || line.startsWith(':')) return
    const colonIndex = line.indexOf(':')
    const field = colonIndex < 0 ? line : line.slice(0, colonIndex)
    const rawValue = colonIndex < 0 ? '' : line.slice(colonIndex + 1)
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') {
      event = value
      hasRecognizedField = true
    } else if (field === 'data') {
      dataLines.push(value)
      hasRecognizedField = true
    } else if (field === 'id' && !value.includes('\0')) {
      id = value
      hasRecognizedField = true
    } else if (field === 'retry' && /^\d+$/.test(value)) {
      retry = Number(value)
      hasRecognizedField = true
    }
  })

  return hasRecognizedField ? { event, data: dataLines.join('\n'), id, retry } : null
}

export async function* parseSseStream(chunks: AsyncIterable<string>): AsyncIterable<SseEvent> {
  let buffer = ''
  let trailingCarriageReturn = false

  function* drainEvents() {
    let eventBoundaryIndex = buffer.indexOf('\n\n')
    while (eventBoundaryIndex >= 0) {
      const event = parseEventBlock(buffer.slice(0, eventBoundaryIndex))
      buffer = buffer.slice(eventBoundaryIndex + 2)
      if (event) yield event
      eventBoundaryIndex = buffer.indexOf('\n\n')
    }
  }

  for await (const chunk of chunks) {
    let text: string = `${trailingCarriageReturn ? '\r' : ''}${chunk}`
    trailingCarriageReturn = text.endsWith('\r')
    if (trailingCarriageReturn) text = text.slice(0, -1)
    buffer += text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    yield* drainEvents()
  }

  if (trailingCarriageReturn) {
    buffer += '\n'
    yield* drainEvents()
  }
}
