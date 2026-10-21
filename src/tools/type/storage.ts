import { isTypeKey } from './logic'

export const STORAGE_KEY = 'stiq-type-v1'

/** 前回のタイプ（この端末のブラウザにだけ保存する） */
export function loadLast(): string | null {
  try {
    const k = localStorage.getItem(STORAGE_KEY)
    return isTypeKey(k) ? k : null
  } catch {
    return null
  }
}

export function saveLast(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // 保存できない環境（プライベートモード等）でも診断はできる
  }
}
