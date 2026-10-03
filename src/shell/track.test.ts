import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackSourceOnce } from './track'

function setup(search: string) {
  const sent: string[] = []
  const store = new Map<string, string>()
  vi.stubGlobal('location', { search, hash: '#/drill' })
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
  vi.stubGlobal('navigator', { sendBeacon: (u: string) => (sent.push(u), true) })
  return sent
}

describe('流入計測', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('英数字の印だけを1回送る', () => {
    const sent = setup('?src=ig_No59-cover')
    trackSourceOnce()
    trackSourceOnce()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('src=ig_No59-cover')
    expect(sent[0]).toContain('app=soft-tennis-rule-drill')
  })

  it('数式や長すぎる値は送らない', () => {
    for (const bad of ['=IMPORTXML("x")', '+1', 'a'.repeat(41), '<script>', '']) {
      const sent = setup(`?src=${encodeURIComponent(bad)}`)
      trackSourceOnce()
      expect(sent, bad).toHaveLength(0)
    }
  })
})
