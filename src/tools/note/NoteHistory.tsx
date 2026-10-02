// 試合ノート：履歴（1点ごとの確認と、詳細のあとから補足）
import { useState } from 'react'
import * as E from './engine/engine.js'
import type { NotePoint } from './engine/engine.js'
import { COURSE, EDIT_SHOTS, HAND, OUTCOMES, RALLY, RESULT } from './options'

const FILTERS: [string, string][] = [
  ['all', 'すべて'],
  ['own', '取った点'],
  ['opp', '取られた点'],
  ['errors', 'ミスだけ'],
  ['late', 'ゲーム終盤'],
]

function Select({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: (string | [string, string])[]; onChange: (v: string) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o]
          return (
            <option key={v} value={v}>
              {l}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function EditSheet({ index, onClose, act }: { index: number; onClose: () => void; act: <T>(fn: () => T) => T }) {
  const p = E.getState().points[index]
  const [form, setForm] = useState({
    player: E.normalizePlayerKey(p.player || '不明'),
    outcome: p.outcome || 'ストローク得点',
    shot: p.shot || 'ストローク',
    rally: p.rally || '0',
    hand: p.hand || '不明',
    course: p.course || '未記録',
    result: p.result || '不明',
    memo: p.memo || '',
  })
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className="edit-sheet">
        <h2 id="edit-title">{index + 1}点目の詳細を補足</h2>
        <div className="form-grid">
          <Select id="ep-player" label="誰のプレー" value={form.player} options={E.getPointEditPlayerOptions()} onChange={set('player')} />
          <Select id="ep-outcome" label="ポイント内容" value={form.outcome} options={OUTCOMES} onChange={set('outcome')} />
          <Select id="ep-shot" label="ショット" value={form.shot} options={EDIT_SHOTS} onChange={set('shot')} />
          <Select id="ep-rally" label="ラリー数" value={form.rally} options={RALLY} onChange={set('rally')} />
          <Select id="ep-hand" label="打球面" value={form.hand} options={HAND} onChange={set('hand')} />
          <Select id="ep-course" label="コース" value={form.course} options={COURSE} onChange={set('course')} />
          <Select id="ep-result" label="ボールの結果" value={form.result} options={RESULT} onChange={set('result')} />
          <label className="field" htmlFor="ep-memo">
            <span className="field-label">メモ</span>
            <input id="ep-memo" className="text-input" value={form.memo} maxLength={60} onChange={(e) => set('memo')(e.target.value)} />
          </label>
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              act(() => E.editPoint(index, form))
              onClose()
            }}
          >
            保存
          </button>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            やめる
          </button>
        </div>
      </div>
    </div>
  )
}

export function NoteHistory({ act }: { act: <T>(fn: () => T) => T }) {
  const [filter, setFilter] = useState('all')
  const [newest, setNewest] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const s = E.getState()
  const info = s.matchInfo
  const time = E.getMatchTimeRange(info)
  const list = E.filterHistoryPoints(s.points, filter)
  const ordered = newest ? [...list].reverse() : list
  const groups: { game: number; points: NotePoint[] }[] = []
  for (const p of ordered) {
    const g = E.historyGameNumber(p)
    const cur = groups[groups.length - 1]
    if (!cur || cur.game !== g) groups.push({ game: g, points: [p] })
    else cur.points.push(p)
  }

  return (
    <main className="screen-body note-history">
      <div className="rec-head">
        <p className="fine">
          {info.date || '日付未記録'}
          {time ? ` / ${time}` : ''}
        </p>
        <button type="button" className="chip" onClick={() => setNewest((v) => !v)}>
          {newest ? '新しい順' : '古い順'}
        </button>
      </div>
      <div className="chip-row scroll">
        {FILTERS.map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="empty">当てはまるポイントはまだありません。</p>
      ) : (
        groups.map((g, gi) => {
          const inOrder = [...g.points].sort((a, b) => s.points.indexOf(a) - s.points.indexOf(b))
          const won = inOrder.find((p) => p.gameWonBy)?.gameWonBy
          const lastPts = inOrder[inOrder.length - 1]?.scoreAfter?.points || { A: 0, B: 0 }
          return (
            <details key={`${g.game}-${gi}`} className="game-group" open={gi === 0}>
              <summary>
                <b className="num">{E.historyGameLabel(g.game)}</b>
                <span>
                  {won ? (won === 'A' ? '取った' : '取られた') : `途中 ${lastPts.A}-${lastPts.B}`}・{g.points.length}点
                </span>
              </summary>
              <ol className="points">
                {g.points.map((p) => {
                  const n = s.points.indexOf(p) + 1
                  const b = p.scoreBefore.points
                  const a = p.scoreAfter?.points || b
                  const meta = [
                    p.course && p.course !== '未記録' ? p.course : '',
                    E.historyPhaseLabel(p),
                    p.serveStart,
                    p.memo,
                  ]
                    .filter(Boolean)
                    .join('・')
                  return (
                    <li key={p.id || n} className={p.winner === 'A' ? 'own' : 'opp'}>
                      <div className="pt-head">
                        <span className="num">{n}点目</span>
                        <b>{p.winner === 'A' ? '取った' : '取られた'}</b>
                        <span className="num pt-score">
                          {b.A}-{b.B} → {a.A}-{a.B}
                        </span>
                      </div>
                      <p className="pt-main">
                        {p.outcome}
                        {p.player && p.player !== '不明' ? `／${E.playerLabel(p.player)}` : ''}
                      </p>
                      {meta && <p className="fine">{meta}</p>}
                      <button type="button" className="pt-edit" onClick={() => setEditing(n - 1)}>
                        詳細を補足
                      </button>
                    </li>
                  )
                })}
              </ol>
            </details>
          )
        })
      )}
      {editing !== null && <EditSheet index={editing} act={act} onClose={() => setEditing(null)} />}
    </main>
  )
}
