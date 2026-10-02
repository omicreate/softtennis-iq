// 最後に見ていた配置を、この端末にだけ自動で残す（ホームや他の道具へ移っても消えないように）
import { normalizeActiveIds, normalizePlayers, sanitizePremise } from './playerState'
import type { MatchMode, Player } from './types'

export const LAST_LAYOUT_KEY = 'sti-court-last-v1'

export type LastLayout = {
  mode: MatchMode
  players: Record<MatchMode, Player[]>
  activeIds: Record<MatchMode, string[]>
  premise: string
}

export function parseLastLayout(raw: string | null): LastLayout | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    const players = (v.players ?? {}) as Record<string, unknown>
    const active = (v.activeIds ?? {}) as Record<string, unknown>
    const doubles = normalizePlayers(players.doubles, 'doubles')
    const singles = normalizePlayers(players.singles, 'singles')
    if (!doubles || !singles) return null
    return {
      mode: v.mode === 'singles' ? 'singles' : 'doubles',
      players: { doubles, singles },
      activeIds: { doubles: normalizeActiveIds(active.doubles, doubles), singles: normalizeActiveIds(active.singles, singles) },
      premise: sanitizePremise(v.premise),
    }
  } catch {
    return null
  }
}

export function loadLastLayout(): LastLayout | null {
  try {
    return parseLastLayout(localStorage.getItem(LAST_LAYOUT_KEY))
  } catch {
    return null
  }
}

export function saveLastLayout(layout: LastLayout) {
  try {
    localStorage.setItem(LAST_LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // 保存できない環境でも画面上の配置はそのまま使える
  }
}
