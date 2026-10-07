import { defaultProgress } from './logic'
import type { QuizProgress } from './logic'

export const STORAGE_KEY = 'stiq-quiz-v1'

export function loadProgress(): QuizProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultProgress(), ...JSON.parse(raw) } : defaultProgress()
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: QuizProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // 保存できない環境（プライベートモード等）でも解ける
  }
}
