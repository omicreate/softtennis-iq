import { describe, expect, it } from 'vitest'
import data from './questions.json'
import {
  bestStreak,
  currentStreak,
  dayNumber,
  defaultProgress,
  questions,
  recordAnswer,
  todaysQuestion,
} from './logic'

describe('局面クイズの問題データ', () => {
  it('1問以上あり、3択と正解がそろっている', () => {
    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) {
      expect(q.options).toHaveLength(3)
      expect(q.correct).toBeGreaterThanOrEqual(0)
      expect(q.correct).toBeLessThan(3)
      expect(q.players.some((p) => p.you)).toBe(true)
    }
  })

  it('動画をまだ公開していない問題が入っていない（書き出した日より前か、旧動画の作り直しだけ）', () => {
    const exportedFor = (data as { exportedFor: string }).exportedFor
    for (const q of questions) {
      if (q.remakeOf) continue
      expect(q.publishDate, `No.${q.no}`).toBeDefined()
      expect(q.publishDate! < exportedFor, `No.${q.no}`).toBe(true)
    }
  })

  it('ナレーション・根拠・内部の制作情報は入っていない', () => {
    const text = JSON.stringify(data)
    for (const key of ['narration', 'evidence', 'status', 'hook', 'pinned_comment']) {
      expect(text.includes(`"${key}"`), key).toBe(false)
    }
  })
})

describe('今日の1問', () => {
  it('同じ日はだれが開いても同じ問題、日が変わると次の問題', () => {
    const a = todaysQuestion(questions, '2026-10-09')
    expect(todaysQuestion(questions, '2026-10-09')).toBe(a)
    if (questions.length > 1) expect(todaysQuestion(questions, '2026-10-10')).not.toBe(a)
  })

  it('通し日数はタイムゾーンに左右されない', () => {
    expect(dayNumber('2026-10-10') - dayNumber('2026-10-09')).toBe(1)
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1)
  })
})

describe('記録', () => {
  const q = questions[0]

  it('今日の1問は1日1回だけ記録し、過去の問題では日付の記録を増やさない', () => {
    let p = recordAnswer(defaultProgress(), q, q.correct, '2026-10-09', true)
    p = recordAnswer(p, q, (q.correct + 1) % 3, '2026-10-09', true)
    expect(p.days['2026-10-09'].correct).toBe(true)
    p = recordAnswer(p, q, q.correct, '2026-10-10', false)
    expect(Object.keys(p.days)).toEqual(['2026-10-09'])
    expect(p.solved[q.id].at).toBe('2026-10-10')
  })

  it('連続日数：1日空くと途切れる。今日まだ解いていなければ昨日までで数える', () => {
    let p = defaultProgress()
    for (const d of ['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09']) p = recordAnswer(p, q, 0, d, true)
    expect(currentStreak(p, '2026-10-09')).toBe(3)
    expect(currentStreak(p, '2026-10-10')).toBe(3)
    expect(currentStreak(p, '2026-10-11')).toBe(0)
    expect(bestStreak(p)).toBe(3)
  })
})
