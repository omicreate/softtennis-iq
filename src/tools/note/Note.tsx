// 試合ノート（旧 soft-tennis-note を新デザインに移植）
// 屋外の日なたでも読めるよう明るい「日なたモード」。スコアだけナイター色で締める。
// 記録は「誰のプレー」「ショット」を選んで「取った／取られた」を押すだけ。保存されるデータの形は旧アプリと同じ。
import { BarChart3, ChevronLeft, ListOrdered, Menu, PenLine } from 'lucide-react'
import { href } from '../../shell/route'
import * as E from './engine/engine.js'
import type { Side } from './engine/engine.js'
import { NoteAnalysis } from './NoteAnalysis'
import { NoteHistory } from './NoteHistory'
import { NoteMenu } from './NoteMenu'
import { SERVE_STARTS, SHOTS } from './options'
import { useNote } from './useNote'
import './note.css'

export type NoteSection = 'record' | 'analysis' | 'history' | 'menu' | 'new' | 'edit' | 'archive' | 'summary'

const otherSide = (s: Side): Side => (s === 'A' ? 'B' : 'A')

function Scoreboard() {
  const s = E.getState()
  const winner = E.getWinnerTeam()
  const mp = E.getMatchPointTeams()
  const final = !s.finished && E.isFinalGame()
  const gameNo = s.games.A + s.games.B + 1
  const status = s.finished ? '試合終了' : s.matchFormat === 'final' ? 'ファイナルゲーム' : final ? `第${gameNo}ゲーム（ファイナル）` : `第${gameNo}ゲーム`
  const team = (side: Side) => (
    <div className={`sb-team sb-${side} ${s.finished && winner ? (winner === side ? 'is-win' : 'is-lose') : ''}`}>
      <span className="sb-name">
        {!s.finished && s.server === side && <i className="sb-serve" aria-label="サービス" />}
        {E.shortDisplayName(side)}
      </span>
      <b className="sb-points num">{s.finished ? s.games[side] : E.pointLabel(side).replace(' D', '').replace(' A', '')}</b>
      {!s.finished && /[DA]$/.test(E.pointLabel(side)) && (
        <small className="sb-flag">{E.pointLabel(side).endsWith('A') ? 'アドバンテージ' : 'デュース'}</small>
      )}
    </div>
  )
  return (
    <section className="scoreboard" aria-label="スコア">
      <div className="sb-meta">
        <span>
          {s.matchType === 'singles' ? 'シングルス' : 'ダブルス'}・{E.matchFormatLabel()}
        </span>
        <span>{status}</span>
      </div>
      <div className="sb-row">
        {team('A')}
        <div className="sb-games num">
          <b>
            {s.games.A}–{s.games.B}
          </b>
          <span>ゲーム</span>
        </div>
        {team('B')}
      </div>
      {mp.length > 0 && <p className="sb-alert">マッチポイント：{mp.map((t) => E.displayName(t)).join('・')}</p>}
      {!mp.length && E.getRuleNoteText() && <p className="sb-note">{E.getRuleNoteText()}</p>}
    </section>
  )
}

function Record({ act }: { act: <T>(fn: () => T) => T }) {
  const s = E.getState()
  const singles = s.matchType === 'singles'
  const players = singles ? ['A選手', 'B選手'] : ['A後衛', 'A前衛', 'B後衛', 'B前衛']
  const df = s.selectedServe === 'ダブルフォールト'
  const preview = (w: Side) => {
    const o = E.outcomeFor(w, s.selectedPlayer, s.selectedShot, s.selectedServe)
    return o === '不明' ? '決まり手は未記録' : o
  }
  const last = s.points[s.points.length - 1]
  const cycleServicePlayer = (field: 'selectedServerPlayer' | 'selectedReceiverPlayer', side: Side) => {
    const keys = E.serviceSidePlayerKeys(side)
    const i = keys.indexOf(s[field])
    act(() => E.setServicePlayers({ [field]: keys[(i + 1) % keys.length] }))
  }
  const rallyAuto = E.rallyLengthModeForOutcome(E.outcomeFor('A', s.selectedPlayer, s.selectedShot, s.selectedServe))
  const rally = s.selectedRallyLengthManual || rallyAuto

  if (s.finished) {
    const w = E.getWinnerTeam()
    return (
      <main className="screen-body note-record">
        <div className="done-card">
          <p className="eyebrow">試合終了</p>
          <h2>{w ? `${E.displayName(w)}の勝ち` : '試合終了'}</h2>
          <p>
            ゲーム <b className="num">{s.games.A}–{s.games.B}</b>・{s.points.length}ポイント記録
          </p>
          <div className="done-actions">
            <a className="btn btn-primary btn-block" href={href('note', 'analysis')}>
              分析を見る
            </a>
            <a className="btn btn-ghost btn-block" href={href('note', 'summary')}>
              サマリー画像を作る
            </a>
            <button type="button" className="btn btn-quiet" onClick={() => act(() => E.undoPoint())}>
              最後のポイントを取り消す
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="screen-body note-record">
      {s.points.length === 0 && (
        <div className="start-card">
          <p>
            <b>{E.displayName(s.server)}</b>のサービスから始めます。チーム名や大会名は「試合」タブで入れられます。
          </p>
          <div className="start-actions">
            <button type="button" className="chip" onClick={() => act(() => E.updateSelection({ server: otherSide(s.server) }))}>
              サービス側を入れ替える
            </button>
            <a className="chip" href={href('note', 'new')}>
              試合情報を入れる
            </a>
          </div>
        </div>
      )}

      <section className="rec-group" aria-label="サービス">
        <div className="rec-head">
          <h2>サービス</h2>
          <p className="svc-players">
            <button type="button" onClick={() => cycleServicePlayer('selectedServerPlayer', s.server)}>
              {E.playerLabel(s.selectedServerPlayer)}
            </button>
            <span aria-hidden="true">→</span>
            <button type="button" onClick={() => cycleServicePlayer('selectedReceiverPlayer', otherSide(s.server))}>
              {E.playerLabel(s.selectedReceiverPlayer)}
            </button>
          </p>
        </div>
        <div className="chip-row">
          {SERVE_STARTS.map(([value, label]) => (
            <button key={value} type="button" className="chip" aria-pressed={s.selectedServe === value} onClick={() => act(() => E.updateSelection({ selectedServe: value }))}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {!df && (
        <>
          <section className="rec-group" aria-label="誰のプレー">
            <div className="rec-head">
              <h2>誰のプレー？</h2>
              <small>あとで履歴から入れてもOK</small>
            </div>
            <div className={`chip-grid ${singles ? 'cols-2' : ''}`}>
              {players.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`chip chip-player side-${key[0]}`}
                  aria-pressed={s.selectedPlayer === key}
                  onClick={() => act(() => E.updateSelection({ selectedPlayer: s.selectedPlayer === key ? '不明' : key }))}
                >
                  {E.playerLabel(key)}
                </button>
              ))}
            </div>
          </section>
          <section className="rec-group" aria-label="ショット">
            <div className="rec-head">
              <h2>ショット</h2>
              <div className="rally" role="group" aria-label="ラリーの長さ">
                {(['short', 'long'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={rally === v} onClick={() => act(() => E.updateSelection({ selectedRallyLengthManual: v }))}>
                    {v === 'short' ? '3本以内' : '4本以上'}
                  </button>
                ))}
              </div>
            </div>
            <div className="chip-grid cols-3">
              {SHOTS.map((shot) => (
                <button key={shot} type="button" className="chip" aria-pressed={s.selectedShot === shot} onClick={() => act(() => E.updateSelection({ selectedShot: s.selectedShot === shot ? '不明' : shot }))}>
                  {shot}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <label className="memo">
        <span>メモ</span>
        <input type="text" value={s.selectedMemo || ''} maxLength={60} placeholder="例：前衛が早く動けた" onChange={(e) => act(() => E.updateSelection({ selectedMemo: e.target.value }))} />
      </label>

      {last && (
        <div className="last">
          <span>
            直前：{s.points.length}点目 {last.winner === 'A' ? '取った' : '取られた'}（{last.outcome}）
          </span>
          <button type="button" onClick={() => act(() => E.undoPoint())}>
            取り消す
          </button>
        </div>
      )}

      <div className="bigbtns">
        <button type="button" className="big-win" disabled={df && s.server === 'A'} onClick={() => act(() => E.recordPoint('A'))}>
          取った
          <small>{df ? (s.server === 'B' ? '相手のダブルフォールト' : '—') : preview('A')}</small>
        </button>
        <button type="button" className="big-lose" disabled={df && s.server === 'B'} onClick={() => act(() => E.recordPoint('B'))}>
          取られた
          <small>{df ? (s.server === 'A' ? '自チームのダブルフォールト' : '—') : preview('B')}</small>
        </button>
      </div>
    </main>
  )
}

export function Note({ section }: { section: NoteSection }) {
  const { act, version } = useNote()
  const tab = ['analysis', 'history'].includes(section) ? section : section === 'record' ? 'record' : 'menu'

  return (
    <div className="screen note theme-sun" data-version={version}>
      <div className="note-top">
      <header className="appbar">
        <a className="icon-btn" href={href()} aria-label="ホームへ戻る">
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="ballmark" aria-hidden="true" />
          試合ノート
        </div>
        {!['record', 'analysis', 'history'].includes(section) && <div className="appbar-end note-status num">{E.getCompactMatchStatus()}</div>}
      </header>

      {(section === 'record' || section === 'analysis' || section === 'history') && <Scoreboard />}
      </div>

      {section === 'record' && <Record act={act} />}
      {section === 'analysis' && <NoteAnalysis act={act} />}
      {section === 'history' && <NoteHistory act={act} />}
      {['menu', 'new', 'edit', 'archive', 'summary'].includes(section) && <NoteMenu section={section} act={act} />}

      <nav className="tabbar" style={{ ['--tabs' as string]: 4 }} aria-label="試合ノートのメニュー">
        <a className="tab" href={href('note')} aria-current={tab === 'record' ? 'page' : undefined}>
          <PenLine size={22} aria-hidden="true" />
          記録
        </a>
        <a className="tab" href={href('note', 'analysis')} aria-current={tab === 'analysis' ? 'page' : undefined}>
          <BarChart3 size={22} aria-hidden="true" />
          分析
        </a>
        <a className="tab" href={href('note', 'history')} aria-current={tab === 'history' ? 'page' : undefined}>
          <ListOrdered size={22} aria-hidden="true" />
          履歴
        </a>
        <a className="tab" href={href('note', 'menu')} aria-current={tab === 'menu' ? 'page' : undefined}>
          <Menu size={22} aria-hidden="true" />
          試合
        </a>
      </nav>
    </div>
  )
}
