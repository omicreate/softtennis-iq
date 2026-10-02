// ドリルの出題・採点ロジック（画面から切り離した純粋関数。旧 app.js の挙動を引き継ぐ）
import { categories, questions } from './questions'
import type { Progress, Question } from './types'

export const DRILL_SET_SIZE = 10

export const reviewed = (): Question[] => questions.filter((q) => q.reviewStatus === 'reviewed')
const byId = new Map(questions.map((q) => [q.id, q]))
export const findQuestion = (id: string) => byId.get(id)

export function defaultProgress(): Progress {
  return {
    answers: {},
    streak: 0,
    bestStreak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    lastStudyAt: '',
    reviewQueue: [],
    drillSeenIds: [],
    drillSeenKeys: [],
  }
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const cloned = [...items]
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[cloned[i], cloned[j]] = [cloned[j], cloned[i]]
  }
  return cloned
}

/** 選択肢の並びだけをシャッフルした出題用のコピー */
export const withShuffledChoices = (q: Question, random = Math.random): Question => ({
  ...q,
  choices: shuffle(q.choices, random),
})

const displayKey = (q: Question) => `${q.officialTerm}::${q.prompt}`.replace(/\s+/g, ' ').trim()

/**
 * 10問セットを作る。ひと回りするまでは出題済みを避け、ジャンルが偏らないよう順番に1問ずつ取る。
 * 出題済みの記録を巻き戻したときは、更新後の progress も返す。
 */
export function buildDrillSet(
  progress: Progress,
  category = '',
  random = Math.random,
): { set: Question[]; progress: Progress } {
  const all = reviewed().filter((q) => !category || q.category === category)
  const seenIds = new Set(progress.drillSeenIds)
  const seenKeys = new Set(progress.drillSeenKeys)
  let pool = all.filter((q) => !seenIds.has(q.id) && !seenKeys.has(displayKey(q)))
  let next = progress
  if (pool.length === 0) {
    const inScope = (q?: Question) => !category || q?.category === category
    const keyOwner = new Map(reviewed().map((q) => [displayKey(q), q]))
    next = {
      ...progress,
      drillSeenIds: progress.drillSeenIds.filter((id) => !inScope(byId.get(id))),
      drillSeenKeys: progress.drillSeenKeys.filter((key) => !inScope(keyOwner.get(key))),
    }
    pool = all
  }
  return { set: selectBalanced(pool, Math.min(DRILL_SET_SIZE, pool.length), random), progress: next }
}

function selectBalanced(pool: Question[], size: number, random: () => number): Question[] {
  const buckets = new Map<string, Question[]>()
  for (const q of shuffle(pool, random)) {
    const bucket = buckets.get(q.category) ?? []
    bucket.push(q)
    buckets.set(q.category, bucket)
  }
  let order = shuffle(
    categories.filter((c) => buckets.has(c)),
    random,
  )
  const selected: Question[] = []
  const keys = new Set<string>()
  let cursor = 0
  while (selected.length < size && order.length > 0) {
    const category = order[cursor % order.length]
    const bucket = buckets.get(category) ?? []
    const q = bucket.shift()
    if (q && !keys.has(displayKey(q))) {
      selected.push(q)
      keys.add(displayKey(q))
    }
    if (bucket.length === 0) {
      order = order.filter((c) => c !== category)
      cursor = 0
    } else {
      cursor += 1
    }
  }
  return selected
}

/** 1問答えたあとの学習記録 */
export function recordAnswer(progress: Progress, q: Question, answerId: string, now = new Date()): Progress {
  const correct = answerId === q.answerId
  const prev = progress.answers[q.id] ?? { attempts: 0, correct: 0, wrongCount: 0, lastAnsweredAt: '', mastered: false }
  const attempts = prev.attempts + 1
  const correctCount = prev.correct + (correct ? 1 : 0)
  const total = reviewed().length
  const streak = correct ? progress.streak + 1 : 0
  return {
    ...progress,
    totalAnswered: progress.totalAnswered + 1,
    totalCorrect: progress.totalCorrect + (correct ? 1 : 0),
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    lastStudyAt: now.toISOString(),
    answers: {
      ...progress.answers,
      [q.id]: {
        attempts,
        correct: correctCount,
        wrongCount: prev.wrongCount + (correct ? 0 : 1),
        lastAnsweredAt: now.toISOString(),
        mastered: attempts >= 2 && correctCount / attempts >= 0.8,
      },
    },
    reviewQueue: correct
      ? progress.reviewQueue.filter((id) => id !== q.id)
      : [q.id, ...progress.reviewQueue.filter((id) => id !== q.id)].slice(0, 60),
    drillSeenIds: [q.id, ...progress.drillSeenIds.filter((id) => id !== q.id)].filter((id) => byId.has(id)).slice(0, total),
    drillSeenKeys: [displayKey(q), ...progress.drillSeenKeys.filter((k) => k !== displayKey(q))].slice(0, total),
  }
}

export interface CategoryStat {
  category: string
  total: number
  correct: number
  rate: number
}

/** ジャンルごとの「一度でも正解した問題」の割合 */
export function categoryStats(progress: Progress): CategoryStat[] {
  return categories.map((category) => {
    const items = reviewed().filter((q) => q.category === category)
    const correct = items.filter((q) => (progress.answers[q.id]?.correct ?? 0) > 0).length
    return { category, total: items.length, correct, rate: items.length ? Math.round((correct / items.length) * 100) : 0 }
  })
}

export function masteryRate(progress: Progress): number {
  const total = reviewed().length || 1
  return Math.round((Object.values(progress.answers).filter((a) => a.mastered).length / total) * 100)
}

/** 画面に出すジャンル名。分類名なので子ども向けの呼び方にする（問題文・用語は公式用語のまま） */
const categoryLabel: Record<string, string> = {
  'スコア': '点数',
  'サービス/レシーブ': 'サービスとレシーブ',
  'レット/ノーカウント': 'やり直し',
  '失ポイント': '相手の点になるとき',
  'コール': '審判のコール',
  '試合進行': '試合の進め方',
  '禁止事項/マナー': 'やってはいけないこと',
  'スコアシート・審判動作': 'スコアシートとサイン',
  '2026年コイントス運用': 'コイントス',
  'ヒートルール': 'ヒートルール',
}
export const labelOf = (category: string) => categoryLabel[category] ?? category
