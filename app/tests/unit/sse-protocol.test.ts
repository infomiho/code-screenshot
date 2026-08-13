import { describe, expect, it } from 'vitest'
import { encodeSseEvent, parseSseStream } from '../../src/realtime/sse/protocol'

async function* chunks(values: string[]) {
  for (const value of values) yield value
}

const collect = async (values: string[]) => {
  const events = []
  for await (const event of parseSseStream(chunks(values))) events.push(event)
  return events
}

describe('SSE protocol', () => {
  it('encodes event fields and multiline data', () => {
    expect(encodeSseEvent({
      event: 'ambient.changed',
      id: '42',
      retry: 1_000,
      data: 'first\nsecond',
    })).toBe([
      'event: ambient.changed',
      'id: 42',
      'retry: 1000',
      'data: first',
      'data: second',
      '',
      '',
    ].join('\n'))
  })

  it('parses events independently of chunk and line boundaries', async () => {
    const events = await collect([
      ': ignored\r',
      '\nevent: ambient.',
      'changed\r\ndata: first\r\ndata: second\r',
      '\n\r\nevent: ready\ndata: {}\n\n',
    ])

    expect(events).toEqual([
      { event: 'ambient.changed', data: 'first\nsecond', id: undefined, retry: undefined },
      { event: 'ready', data: '{}', id: undefined, retry: undefined },
    ])
  })

  it('accepts mixed line endings and a boundary split after carriage return', async () => {
    expect(await collect([
      'event: first\r\ndata: one\r\n\r',
      '\nevent: second\ndata: two\r',
      '\r',
    ])).toEqual([
      { event: 'first', data: 'one', id: undefined, retry: undefined },
      { event: 'second', data: 'two', id: undefined, retry: undefined },
    ])
  })

  it('ignores comments, unknown fields, and incomplete final frames', async () => {
    expect(await collect([': heartbeat\n\nunknown: value\n\nevent: unfinished'])).toEqual([])
  })

  it('rejects fields that could inject another frame', () => {
    expect(() => encodeSseEvent({ event: 'safe\nevent: unsafe' })).toThrow('must not contain a newline')
  })
})
