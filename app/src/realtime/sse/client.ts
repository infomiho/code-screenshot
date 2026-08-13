import { parseSseStream, type SseEvent } from './protocol'

export type ConsumeSseResponseOptions = {
  signal?: AbortSignal
  onEvent: (event: SseEvent) => void
}

async function* decodeResponseBodyChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const decoder = new TextDecoder()
  while (!signal?.aborted) {
    const { done, value } = await reader.read()
    if (done) break
    yield decoder.decode(value, { stream: true })
  }
  const remainder = decoder.decode()
  if (remainder) yield remainder
}

export const consumeSseResponse = async (
  response: Response,
  { signal, onEvent }: ConsumeSseResponseOptions,
) => {
  if (!response.ok) throw new Error(`SSE request failed with ${response.status}.`)
  if (!response.body) throw new Error('SSE response has no body.')
  if (signal?.aborted) return

  const reader = response.body.getReader()
  const cancel = () => void reader.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    for await (const event of parseSseStream(decodeResponseBodyChunks(reader, signal))) {
      if (signal?.aborted) break
      onEvent(event)
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}
