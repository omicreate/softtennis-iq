// コート描画と操作（旧 jinkei-lab/src/CourtCanvas.tsx を新デザインに移植）
// 自チーム（A）＝黄の丸、相手（B）＝白の四角、セオリー線＝ボールの黄緑、デッドゾーン＝赤の斜線。動画と同じ配色。
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject, SVGProps } from 'react'
import {
  COURT_HALF_L,
  DOUBLES_HALF_W,
  RACKET_LENGTH,
  SERVICE_LINE,
  SINGLES_HALF_W,
  WORLD_X,
  WORLD_Y,
  clampToWorld,
  contactPoint,
  opponentDistances,
  project,
  reachTier,
  unproject,
  zoneGeometry,
} from './geometry'
import type { MatchMode, Orientation, Player, Point } from './types'

/** SVG は画像書き出しでもそのまま使うため、色はトークンと同じ値を直接持つ */
export const COURT_COLORS = {
  bg: '#0e1a2b',
  grid: 'rgba(184,198,214,0.07)',
  court: '#2a7656',
  courtEdge: '#1f5a42',
  line: '#ffffff',
  net: '#0e1a2b',
  ball: '#d8f04a',
  ours: '#f4e04d',
  opp: '#ffffff',
  ng: '#ff7a6b',
  mute: '#b8c6d6',
  ink: '#0e1a2b',
}
const C = COURT_COLORS
const TIER_COLOR = { cover: C.mute, stretch: C.ours, open: C.ng } as const

type Props = {
  svgRef: RefObject<SVGSVGElement | null>
  mode: MatchMode
  orientation: Orientation
  players: Player[]
  activeIds: string[]
  zoom: number
  pan: Point
  rulerPos: { x: number | null; y: number | null }
  showRuler: boolean
  junior: boolean
  onPlayersChange: (players: Player[]) => void
  onToggleActive: (id: string) => void
  onZoomChange: (zoom: number) => void
  onPanChange: (pan: Point) => void
  onRulerPosChange: (pos: { x: number | null; y: number | null }) => void
}

type DragState = { id: string; pointerId: number; startClient: Point; moved: boolean }

function pointsAttr(points: Point[], orientation: Orientation) {
  return points
    .map((point) => {
      const p = project(point, orientation)
      return `${p.x},${p.y}`
    })
    .join(' ')
}

function pathAttr(points: Point[], orientation: Orientation) {
  return (
    points
      .map((point, index) => {
        const p = project(point, orientation)
        return `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      })
      .join(' ') + ' Z'
  )
}

export default function CourtCanvas({
  svgRef,
  mode,
  orientation,
  players,
  activeIds,
  zoom,
  pan,
  rulerPos,
  showRuler,
  junior,
  onPlayersChange,
  onToggleActive,
  onZoomChange,
  onPanChange,
  onRulerPosChange,
}: Props) {
  const dragRef = useRef<DragState | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const panRef = useRef<{ pointerId: number; startClient: Point; startPan: Point } | null>(null)
  const rulerDragRef = useRef<{ axis: 'x' | 'y'; pointerId: number; startClient: Point; startCross: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const zones = useMemo(
    () =>
      activeIds
        .map((id) => players.find((player) => player.id === id))
        .filter((player): player is Player => !!player)
        .map((player) => ({ player, zone: zoneGeometry(player, mode) })),
    [activeIds, players, mode],
  )
  const soloZone = zones.length === 1 ? zones[0].zone : null

  const horizontal = orientation === 'horizontal'
  const extentX = horizontal ? WORLD_Y : WORLD_X
  const extentY = horizontal ? WORLD_X : WORLD_Y
  const viewW = (extentX * 2) / zoom
  const viewH = (extentY * 2) / zoom
  // パンはワールド境界を越えない範囲にクランプ（全体が見えている軸は固定）
  const clampPan = (p: Point): Point => {
    const limitX = Math.max(0, extentX - viewW / 2)
    const limitY = Math.max(0, extentY - viewH / 2)
    return { x: Math.max(-limitX, Math.min(limitX, p.x)), y: Math.max(-limitY, Math.min(limitY, p.y)) }
  }
  const panC = clampPan(pan)
  const view = { x: panC.x - viewW / 2, y: panC.y - viewH / 2, width: viewW, height: viewH }

  const toWorld = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const svgPoint = {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.height,
    }
    return clampToWorld(unproject(svgPoint, orientation))
  }

  const pinchDistance = () => {
    const points = [...pointersRef.current.values()]
    if (points.length < 2) return 0
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  }

  const capture = (pointerId: number) => {
    try {
      svgRef.current?.setPointerCapture(pointerId)
    } catch {
      // 合成イベント等でキャプチャできなくても操作は続行できる
    }
  }

  const svgPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      // 2本指になったらドラッグ・パン・定規移動を打ち切ってピンチズームへ
      dragRef.current = null
      panRef.current = null
      rulerDragRef.current = null
      setDraggingId(null)
      pinchRef.current = { startDist: pinchDistance(), startZoom: zoom }
      return
    }
    if (!dragRef.current && !rulerDragRef.current) {
      panRef.current = { pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, startPan: panC }
    }
  }

  const rulerPointerDown = (event: ReactPointerEvent<SVGRectElement>, axis: 'x' | 'y') => {
    capture(event.pointerId)
    rulerDragRef.current = {
      axis,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startCross: axis === 'x' ? (rulerPos.y ?? view.y + 0.5) : (rulerPos.x ?? view.x + 0.5),
    }
  }

  const markerPointerDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    capture(event.pointerId)
    dragRef.current = { id, pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, moved: false }
  }

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const dist = pinchDistance()
      if (pinch.startDist > 0 && dist > 0) onZoomChange(+(pinch.startZoom * (dist / pinch.startDist)).toFixed(2))
      return
    }
    const drag = dragRef.current
    if (drag && drag.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y) > 8) {
        if (!drag.moved) setDraggingId(drag.id)
        drag.moved = true
      }
      if (!drag.moved) return
      const point = toWorld(event)
      onPlayersChange(players.map((player) => (player.id === drag.id ? { ...player, ...point } : player)))
      return
    }
    const rulerDrag = rulerDragRef.current
    if (rulerDrag && rulerDrag.pointerId === event.pointerId) {
      const rect = svgRef.current!.getBoundingClientRect()
      if (rulerDrag.axis === 'x') {
        const next = rulerDrag.startCross + ((event.clientY - rulerDrag.startClient.y) / rect.height) * view.height
        onRulerPosChange({ ...rulerPos, y: Math.max(-extentY + 0.4, Math.min(extentY - 0.4, next)) })
      } else {
        const next = rulerDrag.startCross + ((event.clientX - rulerDrag.startClient.x) / rect.width) * view.width
        onRulerPosChange({ ...rulerPos, x: Math.max(-extentX + 0.4, Math.min(extentX - 0.4, next)) })
      }
      return
    }
    const panDrag = panRef.current
    if (panDrag && panDrag.pointerId === event.pointerId) {
      const rect = svgRef.current!.getBoundingClientRect()
      onPanChange(
        clampPan({
          x: panDrag.startPan.x - ((event.clientX - panDrag.startClient.x) / rect.width) * view.width,
          y: panDrag.startPan.y - ((event.clientY - panDrag.startClient.y) / rect.height) * view.height,
        }),
      )
    }
  }

  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null
    if (rulerDragRef.current?.pointerId === event.pointerId) rulerDragRef.current = null
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved) onToggleActive(drag.id)
    setDraggingId(null)
    dragRef.current = null
  }

  const P = (point: Point) => project(point, orientation)
  const courtCorners = [
    { x: -DOUBLES_HALF_W, y: -COURT_HALF_L },
    { x: DOUBLES_HALF_W, y: -COURT_HALF_L },
    { x: DOUBLES_HALF_W, y: COURT_HALF_L },
    { x: -DOUBLES_HALF_W, y: COURT_HALF_L },
  ]
  const line = (a: Point, b: Point, key: string, props: SVGProps<SVGLineElement> = {}) => {
    const pa = P(a)
    const pb = P(b)
    return <line key={key} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} {...props} />
  }
  const opponentRect = soloZone
    ? [
        { x: -WORLD_X, y: 0 },
        { x: WORLD_X, y: 0 },
        { x: WORLD_X, y: soloZone.farY },
        { x: -WORLD_X, y: soloZone.farY },
      ]
    : []

  return (
    <svg
      ref={svgRef}
      className="court-svg"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="application"
      aria-label="選手を動かして打球エリアを分析するソフトテニスコート"
      onPointerDown={svgPointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <defs>
        <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke={C.grid} strokeWidth="0.03" />
        </pattern>
        <pattern id="deadHatch" width="0.55" height="0.55" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="0.55" height="0.55" fill={C.ng} fillOpacity="0.1" />
          <line x1="0" y1="0" x2="0" y2="0.55" stroke={C.ng} strokeWidth="0.12" strokeOpacity="0.55" />
        </pattern>
        {/* 実寸のラケット（全長0.69m）。定規で使う */}
        <g id="racketIcon">
          <ellipse cx="0" cy="0.195" rx="0.125" ry="0.185" fill="none" stroke="currentColor" strokeWidth="0.055" />
          <path d="M -0.055 0.36 L 0 0.46 L 0.055 0.36" fill="none" stroke="currentColor" strokeWidth="0.045" strokeLinejoin="round" />
          <line x1="0" y1="0.44" x2="0" y2="0.52" stroke="currentColor" strokeWidth="0.05" />
          <rect x="-0.05" y="0.51" width="0.1" height="0.16" rx="0.045" fill="currentColor" />
        </g>
        {soloZone && (
          <clipPath id="opponentClip">
            <polygon points={pointsAttr(opponentRect, orientation)} />
          </clipPath>
        )}
      </defs>

      <rect x={view.x} y={view.y} width={view.width} height={view.height} fill={C.bg} />
      <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#grid)" />
      <polygon points={pointsAttr(courtCorners, orientation)} fill={C.court} stroke={C.courtEdge} strokeWidth="0.1" />

      {soloZone && (
        <path
          className="zone-layer"
          d={`${pathAttr(opponentRect, orientation)} ${pathAttr(soloZone.theory, orientation)}`}
          fill="url(#deadHatch)"
          fillRule="evenodd"
          clipPath="url(#opponentClip)"
        />
      )}
      {zones.map(({ player, zone }) => (
        <polygon
          key={`fill-${player.id}`}
          className="zone-layer"
          points={pointsAttr(zone.theoryFill, orientation)}
          fill={C.ball}
          fillOpacity="0.16"
          stroke={C.ball}
          strokeWidth="0.06"
          strokeOpacity="0.7"
          strokeLinejoin="round"
        />
      ))}

      <g stroke={C.line} strokeWidth="0.075">
        {line({ x: -DOUBLES_HALF_W, y: -COURT_HALF_L }, { x: DOUBLES_HALF_W, y: -COURT_HALF_L }, 'base-1')}
        {line({ x: -DOUBLES_HALF_W, y: COURT_HALF_L }, { x: DOUBLES_HALF_W, y: COURT_HALF_L }, 'base-2')}
        {line({ x: -DOUBLES_HALF_W, y: -COURT_HALF_L }, { x: -DOUBLES_HALF_W, y: COURT_HALF_L }, 'side-1')}
        {line({ x: DOUBLES_HALF_W, y: -COURT_HALF_L }, { x: DOUBLES_HALF_W, y: COURT_HALF_L }, 'side-2')}
        {line({ x: -SINGLES_HALF_W, y: -COURT_HALF_L }, { x: -SINGLES_HALF_W, y: COURT_HALF_L }, 'single-1')}
        {line({ x: SINGLES_HALF_W, y: -COURT_HALF_L }, { x: SINGLES_HALF_W, y: COURT_HALF_L }, 'single-2')}
        {line({ x: -SINGLES_HALF_W, y: -SERVICE_LINE }, { x: SINGLES_HALF_W, y: -SERVICE_LINE }, 'service-1')}
        {line({ x: -SINGLES_HALF_W, y: SERVICE_LINE }, { x: SINGLES_HALF_W, y: SERVICE_LINE }, 'service-2')}
        {line({ x: 0, y: -SERVICE_LINE }, { x: 0, y: SERVICE_LINE }, 'center-service')}
        {line({ x: -0.15, y: -COURT_HALF_L }, { x: 0.15, y: -COURT_HALF_L }, 'mark-1')}
        {line({ x: -0.15, y: COURT_HALF_L }, { x: 0.15, y: COURT_HALF_L }, 'mark-2')}
      </g>
      {line({ x: -DOUBLES_HALF_W - 0.4, y: 0 }, { x: DOUBLES_HALF_W + 0.4, y: 0 }, 'net', { stroke: C.net, strokeWidth: 0.18 })}

      {zones.map(({ player, zone }) => (
        <g key={`lines-${player.id}`} className="zone-layer" fill="none" strokeLinecap="round">
          {line(zone.contact, zone.extended.left, `l-${player.id}`, { stroke: C.ball, strokeWidth: 0.11 })}
          {line(zone.contact, zone.extended.center, `c-${player.id}`, { stroke: C.ball, strokeWidth: 0.08, strokeDasharray: '0.34 0.26' })}
          {line(zone.contact, zone.extended.right, `r-${player.id}`, { stroke: C.ball, strokeWidth: 0.11 })}
        </g>
      ))}

      {zones.length > 0 &&
        (() => {
          // コース名ラベル：セオリー線の意味をコート上に言語化する
          const halfW = mode === 'doubles' ? DOUBLES_HALF_W : SINGLES_HALF_W
          const signs = [...new Set(zones.map(({ zone }) => zone.sign))]
          return (
            <g className="zone-layer" pointerEvents="none">
              {signs.flatMap((sign) =>
                [
                  { x: -halfW, label: '左コース' },
                  { x: 0, label: 'センター' },
                  { x: halfW, label: '右コース' },
                ].map(({ x, label }) => {
                  const p = P({ x, y: sign * (COURT_HALF_L + 0.6) })
                  return (
                    <text key={`${sign}-${label}`} className="court-text" x={p.x} y={p.y + 0.18} textAnchor="middle" fontSize="0.48" fontWeight="700" fill={C.ball}>
                      {label}
                    </text>
                  )
                }),
              )}
            </g>
          )
        })()}

      {zones.map(({ player }) => (
        // 測定線：相手の担当2コース（近い外側とセンター）までの最短経路と「何本分か」
        <g key={`measure-${player.id}`} className="zone-layer" pointerEvents="none">
          {opponentDistances(player, players, mode).flatMap((row) => {
            const opponent = players.find((p) => p.id === row.playerId)
            if (!opponent) return []
            const a = P(opponent)
            return (['outer', 'center'] as const).map((side) => {
              const m = row[side]
              const b = P(m.foot)
              const color = TIER_COLOR[reachTier(m.distance, { role: opponent.role, junior })]
              const len = Math.hypot(b.x - a.x, b.y - a.y)
              const dx = len > 0.001 ? (b.x - a.x) / len : 0
              const dy = len > 0.001 ? (b.y - a.y) / len : -1
              const short = len < 2.4
              const lx = short ? b.x + dx * 1.1 : (a.x + b.x) / 2 + -dy * 0.62
              const ly = short ? b.y + dy * 1.1 : (a.y + b.y) / 2 + dx * 0.62
              return (
                <g key={`${player.id}-${row.playerId}-${side}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="0.07" strokeDasharray="0.18 0.14" />
                  <circle cx={b.x} cy={b.y} r="0.1" fill={color} />
                  <rect x={lx - 0.82} y={ly - 0.34} width="1.64" height="0.68" rx="0.34" fill={color} />
                  <text x={lx} y={ly + 0.17} textAnchor="middle" fontSize="0.44" fontWeight="800" fill={C.ink}>
                    {`${(m.distance / RACKET_LENGTH).toFixed(1)}本`}
                  </text>
                </g>
              )
            })
          })}
        </g>
      ))}

      {showRuler &&
        (['y', 'x'] as const).map((axis) => {
          // ラケット定規：実寸のラケットを交互の濃淡で並べ、5本ごとに数字。つかんで平行移動できる
          const R = RACKET_LENGTH
          const alongMin = axis === 'x' ? view.x : view.y
          const alongMax = axis === 'x' ? view.x + view.width : view.y + view.height
          const placed = axis === 'x' ? rulerPos.y : rulerPos.x
          const cross = placed ?? (axis === 'x' ? view.y : view.x) + 0.5
          const items = []
          for (let k = Math.floor(alongMin / R); k <= Math.ceil(alongMax / R); k++) {
            const s0 = k * R
            items.push(
              <use
                key={`racket-${k}`}
                href="#racketIcon"
                transform={axis === 'x' ? `translate(${s0} ${cross}) rotate(-90)` : `translate(${cross} ${s0})`}
                color={C.line}
                opacity={((k % 2) + 2) % 2 === 0 ? 0.7 : 0.35}
              />,
            )
            if (k % 5 === 0) {
              items.push(
                <text
                  key={`num-${k}`}
                  className="court-text"
                  x={axis === 'x' ? s0 : cross + 0.4}
                  y={axis === 'x' ? cross + 0.78 : s0 + 0.16}
                  fontSize="0.42"
                  fontWeight="700"
                  fill={C.mute}
                  textAnchor={axis === 'x' ? 'middle' : 'start'}
                >
                  {Math.abs(k)}
                </text>,
              )
            }
          }
          return (
            <g key={`ruler-${axis}`} pointerEvents="none">
              {items}
              <rect
                className="ruler-grab"
                x={axis === 'x' ? view.x : cross - 0.55}
                y={axis === 'x' ? cross - 0.55 : view.y}
                width={axis === 'x' ? view.width : 1.1}
                height={axis === 'x' ? 1.1 : view.height}
                fill="transparent"
                pointerEvents="all"
                onPointerDown={(event) => rulerPointerDown(event, axis)}
              />
            </g>
          )
        })}

      <g>
        {players.map((player) => {
          const p = P(player)
          const isActive = activeIds.includes(player.id)
          const isDragging = player.id === draggingId
          const isA = player.team === 'A'
          return (
            <g
              key={player.id}
              className={`player-marker ${isDragging ? 'is-dragging' : ''}`}
              transform={`translate(${p.x} ${p.y})`}
              onPointerDown={(event) => markerPointerDown(event, player.id)}
              role="button"
              aria-pressed={isActive}
              aria-label={`${player.label}を選択または移動`}
            >
              <circle r="1.35" fill="transparent" />
              <g className="marker-body">
                {/* 白黒でも見分けられるよう、A＝丸・B＝四角の形で分ける */}
                {isA ? (
                  <circle r="0.5" fill={C.ours} stroke={C.ink} strokeWidth="0.08" />
                ) : (
                  <rect x="-0.45" y="-0.45" width="0.9" height="0.9" rx="0.1" fill={C.opp} stroke={C.ink} strokeWidth="0.08" />
                )}
                {isActive &&
                  (isA ? (
                    <circle r="0.72" fill="none" stroke={C.ball} strokeWidth="0.12" />
                  ) : (
                    <rect x="-0.66" y="-0.66" width="1.32" height="1.32" rx="0.16" fill="none" stroke={C.ball} strokeWidth="0.12" />
                  ))}
              </g>
              <text y="1.18" textAnchor="middle" className="court-text player-label" fill={isActive ? C.ball : isA ? C.ours : C.opp}>
                {player.label}
              </text>
            </g>
          )
        })}
      </g>

      {zones.map(({ player }) => {
        const contact = contactPoint(player)
        const pp = P(player)
        const cp = P(contact)
        return (
          <g key={`contact-${player.id}`} pointerEvents="none">
            <line x1={pp.x} y1={pp.y} x2={cp.x} y2={cp.y} stroke={C.ball} strokeWidth="0.08" strokeLinecap="round" />
            <circle cx={cp.x} cy={cp.y} r="0.22" fill={C.ink} stroke={C.ball} strokeWidth="0.1" />
          </g>
        )
      })}
    </svg>
  )
}
