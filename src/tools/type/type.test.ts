import { describe, expect, it } from 'vitest'
import { AXES, QUESTIONS, TYPES } from './data'
import { isTypeKey, matchOf, scoreOf } from './logic'

describe('タイプ診断', () => {
  it('30タイプがそろい、キーは「違う2つの項目」の組', () => {
    const keys = Object.keys(TYPES)
    expect(keys).toHaveLength(30)
    for (const a of AXES) for (const b of AXES) if (a !== b) expect(keys).toContain(`${a}-${b}`)
  })

  it('12問・どれも4択で、項目は2つとも違う', () => {
    expect(QUESTIONS).toHaveLength(12)
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4)
      for (const op of q.options) expect(op.axes[0]).not.toBe(op.axes[1])
    }
  })

  it('どの項目も、1位で選べる選択肢が6つ以上ある（出やすさの偏りを抑える）', () => {
    for (const a of AXES) {
      const n = QUESTIONS.flatMap((q) => q.options).filter((op) => op.axes[0] === a).length
      expect(n, a).toBeGreaterThanOrEqual(6)
    }
  })

  it('同じ答えなら、いつも同じタイプになる', () => {
    const picks = QUESTIONS.map((_, i) => i % 4)
    expect(scoreOf(picks).key).toBe(scoreOf(picks).key)
  })

  it('全部の選択肢で「攻め」を選び続けると、攻めが1位になる', () => {
    const picks = QUESTIONS.map((q) => Math.max(0, q.options.findIndex((op) => op.axes[0] === 'kou')))
    expect(scoreOf(picks).main).toBe('kou')
  })

  it('ばらばらに答えると、30タイプすべてが出る（どのタイプにもたどり着ける）', () => {
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const seen = new Map<string, number>()
    const N = 60000
    for (let i = 0; i < N; i++) {
      const r = scoreOf(QUESTIONS.map(() => Math.floor(rand() * 4)))
      seen.set(r.key, (seen.get(r.key) ?? 0) + 1)
    }
    expect(seen.size).toBe(30)
    // どのタイプも、出る割合が 1% 以上（平均は約3.3%）
    for (const [k, n] of seen) expect(n / N, k).toBeGreaterThan(0.01)
  })

  it('相性のいいペアは、いつも実在するタイプで、自分とは違う', () => {
    for (const k of Object.keys(TYPES)) {
      expect(isTypeKey(matchOf(k))).toBe(true)
      expect(matchOf(k)).not.toBe(k)
    }
  })

  it('知らないキーはタイプとして扱わない', () => {
    expect(isTypeKey('kou-kou')).toBe(false)
    expect(isTypeKey('<script>')).toBe(false)
    expect(isTypeKey(null)).toBe(false)
  })
})
