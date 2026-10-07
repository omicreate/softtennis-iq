// 局面クイズのコート図（静止画）。座標は陣形ラボと同じメートル（ネットが y=0、自チームが下）。
// 自チーム＝黄の丸、相手＝白の四角、ボール・ショット＝黄緑の矢印、移動＝点線。動画と同じ配色。
import { COURT_COLORS as C } from '../jinkei/CourtCanvas'
import { COURT_HALF_L, DOUBLES_HALF_W, SERVICE_LINE, SINGLES_HALF_W } from '../jinkei/geometry'
import type { Point, QuizEvent, QuizQuestion } from './logic'

const VIEW_X = DOUBLES_HALF_W + 1.6
const VIEW_Y = COURT_HALF_L + 2.4

/** 画面の座標（上が相手側） */
const sx = (p: Point) => p[0]
const sy = (p: Point) => -p[1]

interface Arrow {
  from: Point
  to: Point
  kind: 'shot' | 'move' | 'guide' | 'arrow'
  label?: string
}

interface Mark {
  at: Point
  label?: string
}

/**
 * 出来事を順に追って、最後の位置と矢印を求める。
 * 問題の図（hints=false）ではショットと移動だけを描き、基準の線や目安は答えのあとにだけ出す（ヒントになるため）。
 */
function play(start: Record<string, Point>, ball: string | undefined, ev: QuizEvent[], hints: boolean) {
  const pos = { ...start }
  const arrows: Arrow[] = []
  const marks: Mark[] = []
  let ballAt: Point | undefined = ball ? pos[ball] : undefined
  for (const e of [...ev].sort((a, b) => (a.t0 ?? 0) - (b.t0 ?? 0))) {
    if (e.k === 'move' && e.who && e.to && pos[e.who]) {
      arrows.push({ from: pos[e.who], to: e.to, kind: 'move' })
      pos[e.who] = e.to
    } else if (e.k === 'shot' && e.to) {
      const from = e.from || (e.by && pos[e.by]) || ballAt
      if (from) arrows.push({ from, to: e.to, kind: 'shot' })
      ballAt = e.to
    } else if (hints && (e.k === 'guide' || e.k === 'arrow') && e.to) {
      const from = e.from || (e.fromWho && pos[e.fromWho])
      if (from) arrows.push({ from, to: e.to, kind: e.k, label: e.label })
    } else if (hints && e.k === 'ghost' && e.at) {
      marks.push({ at: e.at, label: e.label })
    }
  }
  return { pos, arrows, marks }
}

const STROKE = { shot: C.ball, move: C.mute, guide: C.ours, arrow: C.mute } as const

export function QuizCourt({ q, showAnswer }: { q: QuizQuestion; showAnswer: boolean }) {
  const start = Object.fromEntries(q.players.map((p) => [p.id, p.pos])) as Record<string, Point>
  const setup = play(start, q.setup.ball, q.setup.ev, showAnswer)
  const answer = showAnswer ? play({ ...setup.pos, ...q.answer.start }, undefined, q.answer.ev, true) : null
  const pos = answer ? answer.pos : setup.pos
  // 答えのあとは、場面の基準線・目安と、正解の動きを重ねる（場面のショットは消して見やすくする）
  const arrows = answer ? [...setup.arrows.filter((a) => a.kind === 'guide' || a.kind === 'arrow'), ...answer.arrows] : setup.arrows
  const marks = answer ? [...setup.marks, ...answer.marks] : []

  const line = { stroke: C.line, strokeWidth: 0.08 }
  return (
    <svg
      className="quiz-court"
      viewBox={`${-VIEW_X} ${-VIEW_Y} ${VIEW_X * 2} ${VIEW_Y * 2}`}
      role="img"
      aria-label={showAnswer ? '正解の動きを示したコート図' : '問題の場面を示したコート図'}
    >
      <defs>
        <marker id="qc-shot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={C.ball} />
        </marker>
        <marker id="qc-move" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={C.mute} />
        </marker>
      </defs>
      <rect x={-VIEW_X} y={-VIEW_Y} width={VIEW_X * 2} height={VIEW_Y * 2} rx="0.8" fill={C.courtEdge} />
      <rect x={-DOUBLES_HALF_W} y={-COURT_HALF_L} width={DOUBLES_HALF_W * 2} height={COURT_HALF_L * 2} fill={C.court} {...line} />
      <line x1={-SINGLES_HALF_W} y1={-COURT_HALF_L} x2={-SINGLES_HALF_W} y2={COURT_HALF_L} {...line} />
      <line x1={SINGLES_HALF_W} y1={-COURT_HALF_L} x2={SINGLES_HALF_W} y2={COURT_HALF_L} {...line} />
      <line x1={-SINGLES_HALF_W} y1={-SERVICE_LINE} x2={SINGLES_HALF_W} y2={-SERVICE_LINE} {...line} />
      <line x1={-SINGLES_HALF_W} y1={SERVICE_LINE} x2={SINGLES_HALF_W} y2={SERVICE_LINE} {...line} />
      <line x1="0" y1={-SERVICE_LINE} x2="0" y2={SERVICE_LINE} {...line} />
      <line x1={-DOUBLES_HALF_W - 0.5} y1="0" x2={DOUBLES_HALF_W + 0.5} y2="0" stroke={C.net} strokeWidth="0.3" />

      {arrows.map((a, i) => (
        <line
          key={i}
          x1={sx(a.from)}
          y1={sy(a.from)}
          x2={sx(a.to)}
          y2={sy(a.to)}
          stroke={STROKE[a.kind]}
          strokeWidth={a.kind === 'shot' ? 0.16 : 0.1}
          strokeDasharray={a.kind === 'shot' ? undefined : '0.35 0.25'}
          strokeLinecap="round"
          markerEnd={a.kind === 'guide' ? undefined : `url(#qc-${a.kind === 'shot' ? 'shot' : 'move'})`}
        />
      ))}
      {marks.map((m, i) => (
        <circle key={i} cx={sx(m.at)} cy={sy(m.at)} r="0.45" fill="none" stroke={C.ball} strokeWidth="0.1" strokeDasharray="0.2 0.15" />
      ))}
      {[...arrows.filter((a) => a.label).map((a) => ({ at: a.to, label: a.label! })), ...marks.filter((m) => m.label).map((m) => ({ at: m.at, label: m.label! }))].map(
        (l, i) => (
          <CourtLabel key={`l${i}`} at={l.at} text={l.label} />
        ),
      )}

      {q.players.map((p) => {
        const at = pos[p.id] ?? p.pos
        const ours = p.team === 'blue'
        return (
          <g key={p.id} transform={`translate(${sx(at)} ${sy(at)})`}>
            {ours ? (
              <circle r="0.62" fill={C.ours} stroke={C.ink} strokeWidth="0.08" />
            ) : (
              <rect x="-0.55" y="-0.55" width="1.1" height="1.1" rx="0.12" fill={C.opp} stroke={C.ink} strokeWidth="0.08" />
            )}
            <text y="0.3" textAnchor="middle" fontSize="0.8" fontWeight="800" fill={C.ink}>
              {p.role}
            </text>
            {p.you && (
              <g transform="translate(0 1.35)">
                <rect x="-1.25" y="-0.42" width="2.5" height="0.84" rx="0.42" fill={C.ball} />
                <text y="0.24" textAnchor="middle" fontSize="0.6" fontWeight="800" fill={C.ink}>
                  あなた
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 図の中の短い説明。コートの外にはみ出さないよう、左右の位置を寄せる */
function CourtLabel({ at, text }: { at: Point; text: string }) {
  const w = text.length * 0.62 + 0.8
  const x = Math.max(-VIEW_X + w / 2 + 0.2, Math.min(VIEW_X - w / 2 - 0.2, sx(at)))
  const y = sy(at) + (at[1] < 0 ? 1.3 : -1.3)
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y="-0.45" width={w} height="0.9" rx="0.45" fill={C.bg} fillOpacity="0.85" />
      <text y="0.22" textAnchor="middle" fontSize="0.6" fontWeight="700" fill={C.ball}>
        {text}
      </text>
    </g>
  )
}
