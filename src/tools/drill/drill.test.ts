import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDrillSet, categoryStats, defaultProgress, DRILL_SET_SIZE, recordAnswer, reviewed } from './logic'
import { categories, questions } from './questions'
import { sources } from './sources'

// 問題データの約束（2026-10-02 にルールブックの条文で全面作り直し）
describe('問題データ', () => {
  const sourceIds = new Set(sources.map((s) => s.id))
  const answerOf = (id: string) => {
    const q = questions.find((x) => x.id === id)!
    return q.choices.find((c) => c.id === q.answerId)!.text
  }

  it('100問以上あり、IDと問題文が重複しない', () => {
    expect(questions.length).toBeGreaterThanOrEqual(100)
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(questions.length)
    expect(questions.every((q) => q.reviewStatus === 'reviewed')).toBe(true)
  })

  it('各問は重複のない4択で、正解・出典・根拠の条文・ジャンルがそろっている', () => {
    for (const q of questions) {
      expect(q.choices, q.id).toHaveLength(4)
      expect(new Set(q.choices.map((c) => c.text)).size, q.id).toBe(4)
      expect(q.choices.some((c) => c.id === q.answerId), q.id).toBe(true)
      expect(q.sourceRefs.every((id) => sourceIds.has(id)), q.id).toBe(true)
      expect(q.ruleRef, q.id).toMatch(/競技規則|審判規則|JSTAお知らせ/)
      expect(categories, q.id).toContain(q.category)
      for (const field of ['officialTerm', 'plainExplanation', 'scopeNote', 'lastVerified'] as const) {
        expect(q[field], `${q.id} ${field}`).toBeTruthy()
      }
    }
  })

  it('どのジャンルにも3問以上ある', () => {
    for (const c of categories) expect(questions.filter((q) => q.category === c).length, c).toBeGreaterThanOrEqual(3)
  })

  it('用語の名前を問う問題は、正解が公式用語と一致する', () => {
    for (const q of questions) {
      if (!/何と呼ぶ？|何とコールする？/.test(q.prompt)) continue
      expect(answerOf(q.id).includes(q.officialTerm), q.id).toBe(true)
    }
  })

  it('公式用語に合わせる（アンパイア・正審・ツーバウンズ・チェンジサイズ）', () => {
    // 誤答の選択肢には、まちがえやすい言い方としてあえて入れてよい
    const shown = questions.flatMap((q) => [q.prompt, q.plainExplanation, q.officialTerm, answerOf(q.id)]).join('\n')
    expect(shown).not.toContain('アンパイヤー')
    expect(shown).not.toContain('主審')
    expect(shown).not.toContain('チェンジサイド')
    expect(questions.some((q) => q.officialTerm === 'ツーバウンド')).toBe(false)
    expect(answerOf('fault-03')).toBe('ツーバウンズ')
    expect(answerOf('call-02')).toBe('チェンジサイズ')
  })

  it('ワンモア／ツーモアサービス：ファーストからはツーモア、セカンドからはワンモア（審判規則 コール別表35・36）', () => {
    expect(answerOf('let-06')).toBe('ツーモアサービス')
    expect(answerOf('let-07')).toBe('ワンモアサービス')
  })

  it('ファイナルゲームは7ポイント先取、3対3はスリーオール、6対6でデュース', () => {
    expect(answerOf('score-05')).toBe('7ポイント')
    expect(answerOf('score-07')).toBe('スリーオール')
    expect(answerOf('score-06')).toBe('デュースになる')
  })

  it('ヒートルールは暑さ指数31以上が正解で、旧基準の気温35℃は誤答として残す', () => {
    const q = questions.find((x) => x.id === 'heat-01')!
    expect(answerOf('heat-01')).toContain('31')
    expect(q.choices.some((c) => c.text.includes('気温35℃'))).toBe(true)
  })
})

describe('出題', () => {
  // 決まった乱数で結果を固定する
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

  it('10問セットはジャンルが偏らない', () => {
    const { set } = buildDrillSet(defaultProgress(), '', seeded(7))
    expect(set).toHaveLength(DRILL_SET_SIZE)
    const perCategory = new Map<string, number>()
    for (const q of set) perCategory.set(q.category, (perCategory.get(q.category) ?? 0) + 1)
    expect(Math.max(...perCategory.values())).toBeLessThanOrEqual(2)
  })

  it('ひと回りするまで、同じ問題を出さない', () => {
    let progress = defaultProgress()
    const seen = new Set<string>()
    const total = reviewed().length
    const random = seeded(3)
    while (seen.size < total) {
      const built = buildDrillSet(progress, '', random)
      progress = built.progress
      for (const q of built.set) {
        expect(seen.has(q.id), q.id).toBe(false)
        seen.add(q.id)
        progress = recordAnswer(progress, q, q.answerId)
      }
    }
    // 全問出し終えたら、また最初から出題できる
    expect(buildDrillSet(progress, '', random).set).toHaveLength(DRILL_SET_SIZE)
  })

  it('ジャンル指定ではそのジャンルだけを出す', () => {
    const { set } = buildDrillSet(defaultProgress(), 'ヒートルール', seeded(1))
    const total = questions.filter((q) => q.category === 'ヒートルール').length
    expect(set).toHaveLength(Math.min(total, DRILL_SET_SIZE))
    expect(set.every((q) => q.category === 'ヒートルール')).toBe(true)
  })
})

describe('記録', () => {
  const q = questions[0]
  const wrong = q.choices.find((c) => c.id !== q.answerId)!.id

  it('まちがえた問題は振り返りに入り、正解すると外れる', () => {
    let p = recordAnswer(defaultProgress(), q, wrong)
    expect(p.reviewQueue).toEqual([q.id])
    expect(p.streak).toBe(0)
    p = recordAnswer(p, q, q.answerId)
    expect(p.reviewQueue).toEqual([])
    expect(p.totalAnswered).toBe(2)
    expect(p.totalCorrect).toBe(1)
  })

  it('連続正解と最高記録', () => {
    let p = defaultProgress()
    for (const x of questions.slice(0, 3)) p = recordAnswer(p, x, x.answerId)
    p = recordAnswer(p, q, wrong)
    expect(p.streak).toBe(0)
    expect(p.bestStreak).toBe(3)
  })

  it('ジャンル別は「一度でも正解した問題」の割合', () => {
    const p = recordAnswer(defaultProgress(), q, q.answerId)
    const stat = categoryStats(p).find((s) => s.category === q.category)!
    expect(stat.correct).toBe(1)
  })
})

// 旧アプリで決めた画面の約束（硬式テニスの表現・出典ランク・試験という言葉を出さない）
describe('画面の文言', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|css|html)$/.test(name)) files.push(p)
    }
  }
  walk(join(__dirname, '..', '..'))
  files.push(join(__dirname, '..', '..', '..', 'index.html'))
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')

  it('硬式テニスボールの表現を使わない', () => {
    expect(text).not.toContain('🎾')
    expect(text).not.toMatch(/tennis-ball|hard tennis|硬式テニスボール|フェルト/)
  })
  it('出典ランクや「試験・模擬」を画面に出さない', () => {
    expect(text).not.toMatch(/出典ランク|試験|模擬/)
  })
})
