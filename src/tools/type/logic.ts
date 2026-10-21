import { AXES, COMP, QUESTIONS, TYPES } from './data'
import type { Axis, Question } from './data'

export interface TypeResult {
  key: string
  main: Axis
  sub: Axis
  /** 項目ごとの点（3〜99。50がふつう） */
  pct: Record<Axis, number>
}

const pointOf = (axes: [Axis, Axis], a: Axis): number => (axes[0] === a ? 2 : axes[1] === a ? 1 : 0)

/** 項目ごとの出やすさの差をならすため、平均とばらつきを先に出しておく */
export function axisStats(questions: Question[]) {
  const mean = {} as Record<Axis, number>
  const sd = {} as Record<Axis, number>
  for (const a of AXES) {
    let m = 0
    let v = 0
    for (const q of questions) {
      const xs = q.options.map((op) => pointOf(op.axes, a))
      const mu = xs.reduce((x, y) => x + y, 0) / xs.length
      m += mu
      v += xs.reduce((x, y) => x + (y - mu) ** 2, 0) / xs.length
    }
    mean[a] = m
    sd[a] = Math.sqrt(v) || 1
  }
  return { mean, sd }
}

const STATS = axisStats(QUESTIONS)

/** picks[i] は i 問目で選んだ選択肢の番号 */
export function scoreOf(picks: number[], questions: Question[] = QUESTIONS, stats = STATS): TypeResult {
  const s = {} as Record<Axis, number>
  const last = {} as Record<Axis, number>
  for (const a of AXES) {
    s[a] = 0
    last[a] = -1
  }
  picks.forEach((choice, qi) => {
    const [p, q] = questions[qi].options[choice].axes
    s[p] += 2
    s[q] += 1
    last[p] = qi
  })
  const pct = {} as Record<Axis, number>
  const z = {} as Record<Axis, number>
  for (const a of AXES) {
    z[a] = (s[a] - stats.mean[a]) / stats.sd[a]
    pct[a] = Math.max(3, Math.min(99, Math.round(50 + z[a] * 18)))
  }
  // 同点なら：ならした点 → 最後に1位で選んだ問題が後ろのほう → 項目の並び順
  const order = [...AXES].sort((a, b) => pct[b] - pct[a] || z[b] - z[a] || last[b] - last[a] || AXES.indexOf(a) - AXES.indexOf(b))
  return { key: `${order[0]}-${order[1]}`, main: order[0], sub: order[1], pct }
}

/** 相性のいいペアのタイプ */
export function matchOf(key: string): string {
  const [a, b] = key.split('-') as [Axis, Axis]
  return `${COMP[a]}-${COMP[b]}`
}

export const isTypeKey = (key: string | null | undefined): key is string => !!key && key in TYPES

/** 名前の「|」を外した表示用 */
export const plainName = (key: string) => TYPES[key].name.replace(/\|/g, '')
