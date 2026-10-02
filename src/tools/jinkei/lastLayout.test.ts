import { describe, expect, it } from 'vitest'
import { parseLastLayout } from './lastLayout'
import { applyTenkai } from './presets'

describe('前回の配置（自動保存）', () => {
  const doubles = applyTenkai(
    [
      { id: 'a1', team: 'A', label: 'A後衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'back' },
      { id: 'a2', team: 'A', label: 'A前衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'front' },
      { id: 'b1', team: 'B', label: 'B後衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'back' },
      { id: 'b2', team: 'B', label: 'B前衛', x: 0, y: 0, hand: 'left', stroke: 'back', role: 'front' },
    ],
    'reverseCross',
  )
  const singles = [
    { id: 'a1', team: 'A' as const, label: 'A', x: 1, y: -8, hand: 'right' as const, stroke: 'fore' as const, role: 'all' as const },
    { id: 'b1', team: 'B' as const, label: 'B', x: -1, y: 8, hand: 'left' as const, stroke: 'back' as const, role: 'all' as const },
  ]

  it('保存した配置をそのまま読み戻せる', () => {
    const raw = JSON.stringify({ mode: 'doubles', players: { doubles, singles }, activeIds: { doubles: ['a1', 'b2'], singles: ['a1'] }, premise: 'セカンド' })
    const last = parseLastLayout(raw)!
    expect(last.players.doubles.map((p) => [p.id, p.x, p.y])).toEqual(doubles.map((p) => [p.id, p.x, p.y]))
    expect(last.activeIds.doubles).toEqual(['a1', 'b2'])
    expect(last.premise).toBe('セカンド')
  })

  it('壊れたデータは読まない', () => {
    expect(parseLastLayout('{"mode":"doubles","players":{}}')).toBeNull()
    expect(parseLastLayout('not json')).toBeNull()
    expect(parseLastLayout(null)).toBeNull()
  })
})
