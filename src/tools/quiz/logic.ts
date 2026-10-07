// 局面クイズ：今日の1問の決め方と記録の計算
// 問題は動画の台本から書き出したもの（st-studio の `npm run export-quiz`）。動画を公開済みの問題だけが入っている。
import data from './questions.json'

export type Point = [number, number]

export interface QuizPlayer {
  id: string
  team: 'blue' | 'red'
  role: string
  pos: Point
  you?: boolean
}

export interface QuizEvent {
  /** shot＝ショット、move＝移動、guide＝基準の線、ghost＝打点などの目安、arrow＝補足の矢印 */
  k: 'shot' | 'move' | 'guide' | 'ghost' | 'arrow'
  who?: string
  by?: string
  fromWho?: string
  from?: Point
  to?: Point
  at?: Point
  c?: string
  t0?: number
  label?: string
}

export interface QuizQuestion {
  id: string
  no: number
  category: string
  level: string
  question: string
  premise: [string, string][]
  players: QuizPlayer[]
  setup: { ball: string; ev: QuizEvent[] }
  options: { main: string; sub?: string }[]
  correct: number
  answer: { start: Record<string, Point>; ev: QuizEvent[]; steps: string[] }
  others: [string, string][]
  rules: [string, string][]
  explain?: string
  publishDate?: string
  remakeOf?: string
}

export const questions = (data as unknown as { questions: QuizQuestion[] }).questions

export const LETTERS = ['A', 'B', 'C']

/** 端末の日付（日本なら日本時間）で 'YYYY-MM-DD' */
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' を通し日数に（タイムゾーンに左右されない） */
export function dayNumber(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** 今日の1問：日付だけで決まるので、同じ日はだれが開いても同じ問題になる */
export function todaysQuestion(list: QuizQuestion[], key: string): QuizQuestion | undefined {
  if (!list.length) return undefined
  const n = list.length
  return list[((dayNumber(key) % n) + n) % n]
}

export interface QuizAnswer {
  id: string
  choice: number
  correct: boolean
}

export interface QuizProgress {
  /** 今日の1問の答え（日付ごと） */
  days: Record<string, QuizAnswer>
  /** 問題ごとの最新の答え（今日の1問・過去の問題の両方） */
  solved: Record<string, { correct: boolean; at: string }>
}

export const defaultProgress = (): QuizProgress => ({ days: {}, solved: {} })

export function recordAnswer(p: QuizProgress, q: QuizQuestion, choice: number, today: string, isDaily: boolean): QuizProgress {
  const correct = choice === q.correct
  return {
    days: isDaily && !p.days[today] ? { ...p.days, [today]: { id: q.id, choice, correct } } : p.days,
    solved: { ...p.solved, [q.id]: { correct, at: today } },
  }
}

/** 連続日数：今日（まだなら昨日）からさかのぼって、今日の1問を解いた日が続いている数 */
export function currentStreak(p: QuizProgress, today: string) {
  const solvedDays = new Set(Object.keys(p.days).map(dayNumber))
  let day = dayNumber(today)
  if (!solvedDays.has(day)) day -= 1
  let n = 0
  while (solvedDays.has(day)) {
    n += 1
    day -= 1
  }
  return n
}

export function bestStreak(p: QuizProgress) {
  const days = Object.keys(p.days).map(dayNumber).sort((a, b) => a - b)
  let best = 0
  let run = 0
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

export function categories(list: QuizQuestion[]) {
  return [...new Set(list.map((q) => q.category))]
}
