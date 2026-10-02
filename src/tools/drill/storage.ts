import { defaultProgress } from './logic'
import type { Progress } from './types'

// 旧ルールドリル（omicreate.github.io/soft-tennis-rule-drill/）と同じキー。同じオリジンなので記録がそのまま使える
export const STORAGE_KEY = 'soft-tennis-rule-drill-progress-v1'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultProgress(), ...JSON.parse(raw) } : defaultProgress()
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // 保存できない環境（プライベートモード等）でもドリルは続けられる
  }
}
