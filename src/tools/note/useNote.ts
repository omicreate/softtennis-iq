import { useCallback, useReducer } from 'react'
import * as E from './engine/engine.js'

/**
 * エンジンの state はその場で書き換わるので、操作のあとに画面を描き直す合図だけを持つ。
 * act(() => E.recordPoint('A')) のように使う。
 */
export function useNote() {
  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const act = useCallback(<T,>(fn: () => T): T => {
    const result = fn()
    bump()
    return result
  }, [])
  return { state: E.getState(), act, version }
}
