// 陣形ラボ（旧 jinkei-lab を新デザインに移植）
// コートを画面いっぱいに出し、「今の穴」は下のシートに。陣形の読み込みと保存・共有は別タブにまとめた。
import { ChevronLeft, LayoutGrid, Link2, Minus, Plus, RotateCcw, Save, Share2, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { href } from '../../shell/route'
import CourtCanvas, { COURT_COLORS } from './CourtCanvas'
import { RACKET_LENGTH, opponentDistances, reachThresholds, reachTier, weakestHole } from './geometry'
import type { HoleSummary } from './geometry'
import { buildShareUrl, parseLayoutSearch } from './layoutShare'
import { FORMATION_OPTIONS, TENKAI_OPTIONS, applyFormation, applyTenkai } from './presets'
import type { Formation, Team, Tenkai } from './presets'
import { loadLastLayout, saveLastLayout } from './lastLayout'
import { loadJuniorPref, loadSlots, persistJuniorPref, persistSlots } from './slots'
import type { Slot } from './slots'
import type { Handedness, MatchMode, Orientation, Player, PlayerRole, Stroke } from './types'
import './jinkei.css'

export type JinkeiSection = 'court' | 'setup' | 'save'

const doublesSeed: Player[] = applyTenkai(
  [
    { id: 'a1', team: 'A', label: 'A後衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'back' },
    { id: 'a2', team: 'A', label: 'A前衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'front' },
    { id: 'b1', team: 'B', label: 'B後衛', x: 0, y: 0, hand: 'right', stroke: 'fore', role: 'back' },
    { id: 'b2', team: 'B', label: 'B前衛', x: 0, y: 0, hand: 'left', stroke: 'back', role: 'front' },
  ],
  'cross',
)
const singlesSeed: Player[] = [
  { id: 'a1', team: 'A', label: 'A', x: 1.2, y: -8.8, hand: 'right', stroke: 'fore', role: 'all' },
  { id: 'b1', team: 'B', label: 'B', x: -1.2, y: 8.8, hand: 'left', stroke: 'back', role: 'all' },
]

const TIER_LABEL = { cover: 'カバー圏内', stretch: '踏み込みで届く', open: 'リーチ外' } as const
const ZOOM_MIN = 0.8
const ZOOM_MAX = 1.6

// 共有リンク（?layout=）で開いたときの配置。旧 jinkei-lab のリンクも転送されてここで読む
const linkLayout = typeof window === 'undefined' ? null : parseLayoutSearch(window.location.search)
let linkLayoutUsed = false

/** 画面を開くたびに初期配置を決める。共有リンクの配置は最初の1回だけ使い、あとは前回の配置から始める */
function initialLayout() {
  const publicLayout = linkLayout && !linkLayoutUsed ? linkLayout : null
  return { publicLayout, lastLayout: publicLayout ? null : loadLastLayout() }
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 穴までの距離を、守る相手の到達目安（カバー／踏み込み）と比べるバー */
function ReachBar({ hole, junior }: { hole: HoleSummary; junior: boolean }) {
  const t = reachThresholds({ role: hole.opponentRole, junior })
  const max = Math.max(6, t.stretch + 1.5)
  const rackets = hole.distance / RACKET_LENGTH
  const pct = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  return (
    <div className="reach">
      <div className="reach-track" aria-hidden="true">
        <i className="reach-cover" style={{ width: pct(t.cover) }} />
        <i className="reach-stretch" style={{ left: pct(t.cover), width: `calc(${pct(t.stretch)} - ${pct(t.cover)})` }} />
        <b className={`reach-mark tier-${hole.tier}`} style={{ left: pct(rackets) }} />
      </div>
      <div className="reach-labels">
        <span>カバー 〜{t.cover}本</span>
        <span>踏み込み 〜{t.stretch}本</span>
        <span>リーチ外</span>
      </div>
    </div>
  )
}

export function Jinkei({ section }: { section: JinkeiSection }) {
  const [{ publicLayout, lastLayout }] = useState(initialLayout)
  useEffect(() => {
    linkLayoutUsed = true
  }, [])
  const [mode, setMode] = useState<MatchMode>(publicLayout?.mode ?? lastLayout?.mode ?? 'doubles')
  const [playersByMode, setPlayersByMode] = useState(() =>
    !publicLayout
      ? (lastLayout?.players ?? { doubles: doublesSeed, singles: singlesSeed })
      : publicLayout.mode === 'doubles'
        ? { doubles: publicLayout.players, singles: singlesSeed }
        : { doubles: doublesSeed, singles: publicLayout.players },
  )
  const [activeByMode, setActiveByMode] = useState<Record<MatchMode, string[]>>(() =>
    lastLayout?.activeIds ?? {
      doubles: publicLayout?.mode === 'doubles' ? publicLayout.activeIds : ['a1'],
      singles: publicLayout?.mode === 'singles' ? publicLayout.activeIds : ['a1'],
    },
  )
  const [orientation, setOrientation] = useState<Orientation>('vertical')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rulerPos, setRulerPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [showRuler, setShowRuler] = useState(false)
  const [premise, setPremise] = useState(publicLayout?.premise ?? lastLayout?.premise ?? '')
  const [junior, setJunior] = useState(publicLayout?.junior ?? loadJuniorPref)
  const [slots, setSlots] = useState<Slot[]>(loadSlots)
  const [preset, setPreset] = useState<{ tenkai: Tenkai | null; A: Formation | null; B: Formation | null }>({
    tenkai: publicLayout || lastLayout ? null : 'cross',
    A: publicLayout || lastLayout ? null : 'gankou',
    B: publicLayout || lastLayout ? null : 'gankou',
  })
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<{ players: Player[]; activeIds: string[]; premise: string } | null>(null)
  const [confirmSlot, setConfirmSlot] = useState<{ index: number; kind: 'over' | 'clear' } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const players = playersByMode[mode]
  const activeIds = activeByMode[mode]
  const actives = activeIds.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p)
  const editTarget = actives.length ? actives[actives.length - 1] : null

  const shareUrl = useMemo(
    () => buildShareUrl(window.location.href, { v: 1, mode, players, activeIds, premise, junior }, '#/jinkei'),
    [mode, players, activeIds, premise, junior],
  )
  const holes = useMemo(
    () => actives.map((s) => weakestHole(s, players, mode, junior)).filter((h): h is HoleSummary => h !== null),
    [actives, players, mode, junior],
  )

  // 配置が変わるたびに、この端末へ自動で残す
  useEffect(() => {
    saveLastLayout({ mode, players: playersByMode, activeIds: activeByMode, premise })
  }, [mode, playersByMode, activeByMode, premise])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 7000)
    return () => clearTimeout(t)
  }, [undo])

  const setPlayers = (next: Player[]) => setPlayersByMode((c) => ({ ...c, [mode]: next }))
  const toggleActive = (id: string) =>
    setActiveByMode((c) => ({ ...c, [mode]: c[mode].includes(id) ? c[mode].filter((v) => v !== id) : [...c[mode], id] }))
  const updateEditTarget = (patch: Partial<Player>) => {
    if (!editTarget) return
    setPlayers(players.map((p) => (p.id === editTarget.id ? { ...p, ...patch } : p)))
  }
  const applyZoom = (v: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +v.toFixed(2))))

  const loadTenkai = (tenkai: Tenkai) => {
    setPlayersByMode((c) => ({ ...c, doubles: applyTenkai(c.doubles, tenkai) }))
    setPreset({ tenkai, A: 'gankou', B: 'gankou' })
    setToast(`${TENKAI_OPTIONS.find((o) => o.value === tenkai)?.label}を読み込みました`)
  }
  const loadFormation = (team: Team, formation: Formation) => {
    setPlayersByMode((c) => ({ ...c, doubles: applyFormation(c.doubles, team, formation) }))
    setPreset((c) => ({ ...c, tenkai: null, [team]: formation }))
  }
  const handlePlayersChange = (next: Player[]) => {
    setPlayers(next)
    if (mode === 'doubles') setPreset({ tenkai: null, A: null, B: null })
  }

  const reset = () => {
    setUndo({ players, activeIds, premise })
    setPlayers(mode === 'doubles' ? doublesSeed : singlesSeed)
    setActiveByMode((c) => ({ ...c, [mode]: ['a1'] }))
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRulerPos({ x: null, y: null })
    setPreset({ tenkai: 'cross', A: 'gankou', B: 'gankou' })
    setPremise('')
  }
  const undoReset = () => {
    if (!undo) return
    setPlayers(undo.players)
    setActiveByMode((c) => ({ ...c, [mode]: undo.activeIds }))
    setPremise(undo.premise)
    setPreset({ tenkai: null, A: null, B: null })
    setUndo(null)
  }

  const changeJunior = (value: boolean) => {
    setJunior(value)
    persistJuniorPref(value)
  }

  const saveSlots = (next: Slot[]) => {
    setSlots(next)
    try {
      persistSlots(next)
    } catch {
      // 端末内に保存できない環境でも画面上の状態は保つ
    }
  }
  const saveSlot = (index: number) => {
    const now = new Date()
    const stamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const name = premise.trim() || `${mode === 'doubles' ? 'ダブルス' : 'シングルス'} ${stamp}`
    saveSlots(slots.map((s, i) => (i === index ? { name, mode, players, activeIds, premise } : s)))
    setConfirmSlot(null)
    setToast(`枠${index + 1}に保存しました`)
  }
  const loadSlot = (index: number) => {
    const slot = slots[index]
    if (!slot) return
    setMode(slot.mode)
    setPlayersByMode((c) => ({ ...c, [slot.mode]: slot.players }))
    setActiveByMode((c) => ({ ...c, [slot.mode]: slot.activeIds }))
    setPremise(slot.premise)
    setPreset({ tenkai: null, A: null, B: null })
    location.hash = href('jinkei')
  }
  const clearSlot = (index: number) => {
    saveSlots(slots.map((s, i) => (i === index ? null : s)))
    setConfirmSlot(null)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setToast('配置のリンクをコピーしました')
    } catch {
      setToast('コピーできませんでした')
    }
  }

  // 画面のコートを画像にする（下に前提メモとアプリ名の帯を付ける）
  const rasterize = () =>
    new Promise<Blob | null>((resolve) => {
      const svg = svgRef.current
      if (!svg) return resolve(null)
      const rect = svg.getBoundingClientRect()
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('width', String(rect.width))
      clone.setAttribute('height', String(rect.height))
      const props = ['opacity', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'paint-order', 'font-size', 'font-weight', 'font-family']
      const src = svg.querySelectorAll<SVGElement>('*')
      const dst = clone.querySelectorAll<SVGElement>('*')
      src.forEach((el, i) => {
        const cs = getComputedStyle(el)
        for (const p of props) {
          const v = cs.getPropertyValue(p)
          if (v) dst[i].style.setProperty(p, v)
        }
      })
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
      const image = new Image()
      image.onload = () => {
        const scale = 2
        const band = 72
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(rect.width * scale)
        canvas.height = Math.round(rect.height * scale) + band
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return resolve(null)
        }
        ctx.fillStyle = COURT_COLORS.bg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, rect.width * scale, rect.height * scale)
        ctx.fillStyle = '#1b2f4b'
        ctx.fillRect(0, canvas.height - band, canvas.width, band)
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 24px "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif'
        ctx.fillText(premise ? `前提：${premise}` : '陣形ラボ', 24, canvas.height - band / 2)
        ctx.textAlign = 'right'
        ctx.fillStyle = COURT_COLORS.ball
        ctx.fillText('ソフトテニスIQ｜陣形ラボ', canvas.width - 24, canvas.height - band / 2)
        URL.revokeObjectURL(url)
        canvas.toBlob((b) => resolve(b), 'image/png')
      }
      image.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      image.src = url
    })

  const saveImage = async () => {
    const blob = await rasterize()
    if (!blob) return setToast('画像を作れませんでした')
    const file = new File([blob], 'jinkei-lab.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '陣形ラボ', text: premise ? `前提：${premise}` : 'ソフトテニスの配置', url: shareUrl })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'jinkei-lab.png'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const editRole: PlayerRole = editTarget?.role ?? (mode === 'singles' ? 'all' : 'back')
  const presetLabel = preset.tenkai ? TENKAI_OPTIONS.find((o) => o.value === preset.tenkai)?.label : '自由配置'

  return (
    <div className={`screen jinkei section-${section}`}>
      <header className="appbar">
        <a className="icon-btn" href={href()} aria-label="ホームへ戻る">
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="ballmark" aria-hidden="true" />
          陣形ラボ
        </div>
        {section === 'court' && (
          <div className="appbar-end">
            <a className="pill" href={href('jinkei', 'setup')}>
              {mode === 'singles' ? 'シングルス' : presetLabel} ▾
            </a>
          </div>
        )}
      </header>

      {section === 'court' && (
        <>
          <div className="chips" role="group" aria-label="表示">
            <button type="button" className="chip" aria-pressed={showRuler} onClick={() => setShowRuler((v) => !v)}>
              定規
            </button>
            <button type="button" className="chip" aria-pressed={junior} onClick={() => changeJunior(!junior)}>
              ジュニア
            </button>
            <button type="button" className="chip" aria-pressed={orientation === 'horizontal'} onClick={() => {
              setOrientation((o) => (o === 'vertical' ? 'horizontal' : 'vertical'))
              setPan({ x: 0, y: 0 })
              setRulerPos({ x: null, y: null })
            }}>
              横向き
            </button>
            <button type="button" className="chip chip-icon" onClick={reset} aria-label="配置をリセット">
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="court-area">
            <CourtCanvas
              svgRef={svgRef}
              mode={mode}
              orientation={orientation}
              players={players}
              activeIds={activeIds}
              zoom={zoom}
              pan={pan}
              rulerPos={rulerPos}
              showRuler={showRuler}
              junior={junior}
              onPlayersChange={handlePlayersChange}
              onToggleActive={toggleActive}
              onZoomChange={applyZoom}
              onPanChange={setPan}
              onRulerPosChange={setRulerPos}
            />
            {premise && <div className="premise">前提：{premise}</div>}
            <div className="court-share" role="group" aria-label="共有">
              <button type="button" onClick={copyLink} aria-label="配置のリンクをコピー">
                <Link2 size={18} />
              </button>
              <button type="button" onClick={saveImage} aria-label="この配置を画像で共有・保存">
                <Share2 size={18} />
              </button>
            </div>
            <div className="zoom" role="group" aria-label="拡大縮小">
              <button type="button" onClick={() => applyZoom(zoom + 0.15)} aria-label="拡大">
                <Plus size={18} />
              </button>
              <button type="button" onClick={() => applyZoom(zoom - 0.15)} aria-label="縮小">
                <Minus size={18} />
              </button>
            </div>
          </div>

          <section className="sheet" aria-live="polite">
            {holes.length === 0 ? (
              <p className="sheet-hint">
                選手をタップすると、打点からのセオリー線と相手の守備の穴が見えます。ドラッグで自由に動かせます。
              </p>
            ) : (
              holes.map((hole) => (
                <div className="hole" key={`${hole.shooterLabel}-${hole.opponentLabel}-${hole.courseLabel}`}>
                  <div className="hole-head">
                    <div>
                      <p className="hole-kicker">今の穴{holes.length > 1 ? `（${hole.shooterLabel}が打つ）` : ''}</p>
                      <p className="hole-name">
                        {hole.opponentLabel}の{hole.courseLabel}
                      </p>
                    </div>
                    <p className={`hole-num num tier-${hole.tier}`}>
                      {(hole.distance / RACKET_LENGTH).toFixed(1)}
                      <span>本</span>
                    </p>
                  </div>
                  <ReachBar hole={hole} junior={junior} />
                  <p className="hole-tier">{TIER_LABEL[hole.tier]}</p>
                </div>
              ))
            )}

            {editTarget && (
              <details className="player-settings" open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)}>
                <summary>{editTarget.label}の設定と、相手ごとの距離</summary>
                <div className="settings-grid">
                  <Segmented<Handedness>
                    label="利き手"
                    value={editTarget.hand}
                    options={[
                      { value: 'right', label: '右利き' },
                      { value: 'left', label: '左利き' },
                    ]}
                    onChange={(hand) => updateEditTarget({ hand })}
                  />
                  <Segmented<Stroke>
                    label="打球面"
                    value={editTarget.stroke}
                    options={[
                      { value: 'fore', label: 'フォア' },
                      { value: 'back', label: 'バック' },
                    ]}
                    onChange={(stroke) => updateEditTarget({ stroke })}
                  />
                  {mode === 'doubles' && (
                    <Segmented<PlayerRole>
                      label="役割"
                      value={editRole === 'all' ? 'back' : editRole}
                      options={[
                        { value: 'back', label: '後衛' },
                        { value: 'front', label: '前衛' },
                      ]}
                      onChange={(role) => updateEditTarget({ role })}
                    />
                  )}
                </div>
                <ul className="dist-list">
                  {opponentDistances(editTarget, players, mode).map((row) => {
                    const defender = players.find((p) => p.id === row.playerId)
                    return [
                      { key: 'outer', course: row.outer.side === 'left' ? '左コース' : '右コース', m: row.outer },
                      { key: 'center', course: 'センター', m: row.center },
                    ].map(({ key, course, m }) => {
                      const tier = reachTier(m.distance, { role: defender?.role ?? 'all', junior })
                      return (
                        <li key={`${row.playerId}-${key}`}>
                          <span>
                            {row.label}の{course}
                          </span>
                          <b className={`num tier-${tier}`}>{(m.distance / RACKET_LENGTH).toFixed(1)}本</b>
                          <small>{TIER_LABEL[tier]}</small>
                        </li>
                      )
                    })
                  })}
                </ul>
                <p className="fine">平面の距離です。球速・高さ・回転は見ていません。ラケット1本＝0.69m。</p>
              </details>
            )}
          </section>
        </>
      )}

      {section === 'setup' && (
        <main className="screen-body setup">
          <Segmented<MatchMode>
            label="種目"
            value={mode}
            options={[
              { value: 'doubles', label: 'ダブルス' },
              { value: 'singles', label: 'シングルス' },
            ]}
            onChange={setMode}
          />
          {mode === 'doubles' && (
            <>
              <div className="field">
                <span className="field-label">展開（両チームを雁行陣で並べる）</span>
                <div className="preset-grid">
                  {TENKAI_OPTIONS.map((o) => (
                    <button key={o.value} type="button" className="preset" aria-pressed={preset.tenkai === o.value} onClick={() => loadTenkai(o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {(['A', 'B'] as Team[]).map((team) => (
                <div className="field" key={team}>
                  <span className="field-label">
                    <i className={`team-dot team-${team}`} aria-hidden="true" />
                    {team === 'A' ? '自チーム（A・手前）の陣形' : '相手（B・奥）の陣形'}
                  </span>
                  <div className="preset-grid cols-3">
                    {FORMATION_OPTIONS.map((o) => (
                      <button key={o.value} type="button" className="preset" aria-pressed={preset[team] === o.value} onClick={() => loadFormation(team, o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="fine">
                雁行陣は、前衛＝ネットからラケット1.5〜2本分、後衛＝ベースラインからラケット1本分うしろが基準です。展開の左右は自チーム（手前）から見た呼び方です。
              </p>
            </>
          )}
          <Segmented
            label="到達の目安"
            value={junior ? 'junior' : 'adult'}
            options={[
              { value: 'adult', label: '一般' },
              { value: 'junior', label: 'ジュニア' },
            ]}
            onChange={(v) => changeJunior(v === 'junior')}
          />
          <div className="field">
            <label className="field-label" htmlFor="premise">
              前提メモ（コートの上に出ます。保存名にも使います）
            </label>
            <input id="premise" className="text-input" type="text" maxLength={30} placeholder="例：相手のセカンドサービス" value={premise} onChange={(e) => setPremise(e.target.value)} />
          </div>
          <a className="btn btn-accent btn-block" href={href('jinkei')}>
            <LayoutGrid size={18} />
            コートで見る
          </a>
        </main>
      )}

      {section === 'save' && (
        <main className="screen-body save">
          <section className="stack">
            <h1 className="section-title">配置を保存</h1>
            <p className="fine">この端末のブラウザにだけ保存します（3枠）。</p>
            <ul className="slots">
              {slots.map((slot, index) => (
                <li key={index} className="slot">
                  {slot ? (
                    <>
                      <button type="button" className="slot-main" onClick={() => loadSlot(index)}>
                        <span className="slot-no num">{index + 1}</span>
                        <span className="slot-name">{slot.name}</span>
                        <span className="slot-mode">{slot.mode === 'doubles' ? 'ダブルス' : 'シングルス'}</span>
                      </button>
                      {confirmSlot?.index === index ? (
                        <div className="slot-confirm">
                          <span>{confirmSlot.kind === 'over' ? '今の配置で上書きしますか？' : 'この枠を消しますか？'}</span>
                          <button type="button" className="btn btn-danger" onClick={() => (confirmSlot.kind === 'over' ? saveSlot(index) : clearSlot(index))}>
                            {confirmSlot.kind === 'over' ? '上書き' : '消す'}
                          </button>
                          <button type="button" className="btn btn-quiet" onClick={() => setConfirmSlot(null)}>
                            やめる
                          </button>
                        </div>
                      ) : (
                        <div className="slot-actions">
                          <button type="button" className="btn btn-quiet" onClick={() => setConfirmSlot({ index, kind: 'over' })}>
                            上書き
                          </button>
                          <button type="button" className="btn btn-quiet" onClick={() => setConfirmSlot({ index, kind: 'clear' })}>
                            消す
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <button type="button" className="slot-empty" onClick={() => saveSlot(index)}>
                      <Save size={16} /> 空き枠{index + 1}｜今の配置を保存
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="stack">
            <h2 className="section-title">共有</h2>
            <button type="button" className="btn btn-ghost btn-block" onClick={copyLink}>
              <Link2 size={18} />
              配置のリンクをコピー
            </button>
            <p className="fine">
              リンクには今の配置と前提メモだけが入ります。画像は、コート画面の右上にある共有ボタンから保存・共有できます。前提メモに個人名や学校名を書いたときは、共有先での見え方に気をつけてください。
            </p>
          </section>
        </main>
      )}


      {undo && (
        <div className="toast" role="status">
          リセットしました
          <button type="button" onClick={undoReset}>
            元に戻す
          </button>
        </div>
      )}
      {toast && !undo && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="tabbar" aria-label="陣形ラボのメニュー">
        <a className="tab" href={href('jinkei')} aria-current={section === 'court' ? 'page' : undefined}>
          <Square size={22} aria-hidden="true" />
          コート
        </a>
        <a className="tab" href={href('jinkei', 'setup')} aria-current={section === 'setup' ? 'page' : undefined}>
          <LayoutGrid size={22} aria-hidden="true" />
          陣形
        </a>
        <a className="tab" href={href('jinkei', 'save')} aria-current={section === 'save' ? 'page' : undefined}>
          <Save size={22} aria-hidden="true" />
          保存・共有
        </a>
      </nav>
    </div>
  )
}
