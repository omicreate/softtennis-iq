import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackSourceOnce } from './track'

function setup(search: string, privacy: { doNotTrack?: string; globalPrivacyControl?: boolean } = {}, local: Record<string, string> = {}) {
  const sent: string[] = []
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => local[k] ?? null })
  vi.stubGlobal('location', { search, hash: '#/drill' })
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
  vi.stubGlobal('navigator', { sendBeacon: (u: string) => (sent.push(u), true), ...privacy })
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

  it('DNT・GPC がオンなら送らない', () => {
    for (const privacy of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
      const sent = setup('?src=ig_No59-cover', privacy)
      trackSourceOnce()
      expect(sent, JSON.stringify(privacy)).toHaveLength(0)
    }
  })

  it('「送らない」を選んだ端末からは送らない', () => {
    const sent = setup('?src=ig_No59-cover', {}, { 'stiq-track-off': '1' })
    trackSourceOnce()
    expect(sent).toHaveLength(0)
  })
})

describe('機能の回数', () => {
  // 開発中は送らないので、テストでは公開版と同じ扱いにする
  beforeEach(() => vi.stubEnv('DEV', false))
  afterEach(() => (vi.unstubAllGlobals(), vi.unstubAllEnvs()))

  it('タイプ診断の回数は名前とできごとと版だけを送り、開いたは1回だけ', async () => {
    const { countEvent } = await import('./track')
    const sent = setup('?src=ig_bio')
    countEvent('softtennis-type', 'open')
    countEvent('softtennis-type', 'open')
    countEvent('softtennis-type', 'finish')
    countEvent('softtennis-type', 'share')
    expect(sent).toHaveLength(3)
    expect(sent[0]).toMatch(/\?app=softtennis-type&ev=open&v=[0-9.]+$/)
    expect(sent[1]).toContain('ev=finish')
    expect(sent[2]).toContain('ev=share')
    for (const u of sent) expect(u).not.toContain('src=')
  })

  it('「送らない」・DNT のときは送らない', async () => {
    const { countEvent } = await import('./track')
    for (const [privacy, local] of [[{ doNotTrack: '1' }, {}], [{}, { 'stiq-track-off': '1' }]] as const) {
      const sent = setup('', privacy, local)
      countEvent('softtennis-type', 'finish')
      expect(sent).toHaveLength(0)
    }
  })
})
