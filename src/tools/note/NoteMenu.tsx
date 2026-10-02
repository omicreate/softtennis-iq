// 試合ノート：試合タブ（試合情報・新しい試合・保存済み試合・サマリー画像・データの書き出し）
import { Download, FileJson, FileSpreadsheet, FolderOpen, Image as ImageIcon, Plus, Share2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { href } from '../../shell/route'
import * as E from './engine/engine.js'
import type { ArchiveEntry, MatchForm as Form, NoteState } from './engine/engine.js'
import { COURT_CONDITION, EVENT, FORMATION, MATCH_FORMATS, SURFACE, TEMPERATURE, TIME_OF_DAY, WEATHER, WIND } from './options'

type Act = <T>(fn: () => T) => T

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function Options({ list }: { list: (string | [string, string])[] }) {
  return (
    <>
      {list.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o]
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
    </>
  )
}

function MatchForm({ mode, act }: { mode: 'new' | 'edit'; act: Act }) {
  const [f, setF] = useState<Form>(() => E.matchFormDefaults(mode))
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((c) => ({ ...c, [k]: e.target.value }))
  const singles = f.matchType === 'singles'
  const changeType = (type: string) =>
    setF((c) => ({
      ...c,
      matchType: type,
      teamA: type === 'singles' && ['自チーム', '自ペア'].includes(c.teamA) ? '自分' : type === 'doubles' && c.teamA === '自分' ? '自チーム' : c.teamA,
      teamB: type === 'singles' && c.teamB === '相手ペア' ? '相手選手' : type === 'doubles' && c.teamB === '相手選手' ? '相手ペア' : c.teamB,
    }))
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    act(() => (mode === 'new' ? E.startNewMatch(f) : E.saveMatchInfo(f)))
    location.hash = href('note')
  }
  return (
    <form className="screen-body note-form" onSubmit={submit}>
      <h1 className="section-title">{mode === 'new' ? '新しい試合' : '試合情報を編集'}</h1>
      {mode === 'new' && E.matchHasRecordableData() && <p className="fine">今の試合は「保存済み試合」に残ります。</p>}

      <div className="seg" role="group" aria-label="種目">
        {(['doubles', 'singles'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={f.matchType === t} onClick={() => changeType(t)}>
            {t === 'doubles' ? 'ダブルス' : 'シングルス'}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="試合形式">
        {MATCH_FORMATS.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={f.matchFormat === v} onClick={() => setF((c) => ({ ...c, matchFormat: v }))}>
            {l}
          </button>
        ))}
      </div>

      <fieldset className="form-grid">
        <legend>名前（本名でなくても大丈夫です）</legend>
        <Field id="mf-a" label={singles ? '自分' : '自チーム'}>
          <input id="mf-a" className="text-input" value={f.teamA} maxLength={20} onChange={set('teamA')} />
        </Field>
        <Field id="mf-b" label={singles ? '相手' : '相手ペア'}>
          <input id="mf-b" className="text-input" value={f.teamB} maxLength={20} onChange={set('teamB')} />
        </Field>
        {!singles && (
          <>
            <Field id="mf-ar" label="自チームの後衛">
              <input id="mf-ar" className="text-input" value={f.ARear} maxLength={16} onChange={set('ARear')} />
            </Field>
            <Field id="mf-af" label="自チームの前衛">
              <input id="mf-af" className="text-input" value={f.AFront} maxLength={16} onChange={set('AFront')} />
            </Field>
            <Field id="mf-br" label="相手の後衛">
              <input id="mf-br" className="text-input" value={f.BRear} maxLength={16} onChange={set('BRear')} />
            </Field>
            <Field id="mf-bf" label="相手の前衛">
              <input id="mf-bf" className="text-input" value={f.BFront} maxLength={16} onChange={set('BFront')} />
            </Field>
            <Field id="mf-form" label="相手の陣形">
              <select id="mf-form" className="select" value={f.opponentFormation} onChange={set('opponentFormation')}>
                <Options list={FORMATION} />
              </select>
            </Field>
          </>
        )}
      </fieldset>

      {mode === 'new' && (
        <div className="field">
          <span className="field-label">最初のサービス</span>
          <div className="seg" role="group" aria-label="最初のサービス">
            {(['A', 'B'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={f.server === s} onClick={() => setF((c) => ({ ...c, server: s }))}>
                {s === 'A' ? f.teamA || '自チーム' : f.teamB || '相手'}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="more">
        <summary>日時・大会・コートなど（あとでもOK）</summary>
        <fieldset className="form-grid">
          <Field id="mf-date" label="日付">
            <input id="mf-date" type="date" className="text-input" value={f.date} onChange={set('date')} />
          </Field>
          <Field id="mf-tod" label="時間帯">
            <select id="mf-tod" className="select" value={f.timeOfDay} onChange={set('timeOfDay')}>
              <Options list={TIME_OF_DAY} />
            </select>
          </Field>
          <Field id="mf-start" label="開始時刻">
            <input id="mf-start" type="time" className="text-input" value={f.startTime} onChange={set('startTime')} />
          </Field>
          <Field id="mf-end" label="終了時刻">
            <input id="mf-end" type="time" className="text-input" value={f.endTime} onChange={set('endTime')} />
          </Field>
          <Field id="mf-event" label="区分">
            <select id="mf-event" className="select" value={f.event} onChange={set('event')}>
              <Options list={EVENT} />
            </select>
          </Field>
          <Field id="mf-tour" label="大会名">
            <input id="mf-tour" className="text-input" value={f.tournament} maxLength={40} onChange={set('tournament')} />
          </Field>
          <Field id="mf-venue-name" label="開催地／会場">
            <input id="mf-venue-name" className="text-input" value={f.venueName} maxLength={40} onChange={set('venueName')} />
          </Field>
          <Field id="mf-court" label="コート">
            <input id="mf-court" className="text-input" value={f.venue} maxLength={30} onChange={set('venue')} />
          </Field>
          <Field id="mf-weather" label="天気">
            <select id="mf-weather" className="select" value={f.weather} onChange={set('weather')}>
              <Options list={WEATHER} />
            </select>
          </Field>
          <Field id="mf-temp" label="気温">
            <select id="mf-temp" className="select" value={f.temperature} onChange={set('temperature')}>
              <Options list={TEMPERATURE} />
            </select>
          </Field>
          <Field id="mf-wind" label="風">
            <select id="mf-wind" className="select" value={f.wind} onChange={set('wind')}>
              <Options list={WIND} />
            </select>
          </Field>
          <Field id="mf-surface" label="コートの種類">
            <select id="mf-surface" className="select" value={f.surface} onChange={set('surface')}>
              <Options list={SURFACE} />
            </select>
          </Field>
          <Field id="mf-cond" label="コートの状態">
            <select id="mf-cond" className="select" value={f.courtCondition} onChange={set('courtCondition')}>
              <Options list={COURT_CONDITION} />
            </select>
          </Field>
        </fieldset>
      </details>

      <button type="submit" className="btn btn-primary btn-block">
        {mode === 'new' ? 'この内容で試合を始める' : '保存'}
      </button>
      <a className="btn btn-quiet btn-block" href={href('note', 'menu')}>
        やめる
      </a>
    </form>
  )
}

function Archive({ act, onSummary }: { act: Act; onSummary: (s: NoteState) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [result, setResult] = useState('all')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const all = useMemo(() => E.loadArchivedMatches(), [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = E.sortArchivedMatches(E.filterArchivedMatches(all, { query, status, result }), 'newest')
  const usage = E.getAppStorageUsage()
  const savedAt = (e: ArchiveEntry) => {
    const d = new Date(e.savedAt)
    return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return (
    <main className="screen-body note-archive">
      <h1 className="section-title">保存済み試合</h1>
      <p className="fine">
        この端末に {usage.archivedCount}件（約{E.formatStorageSize(usage.totalBytes)}）。新しい試合を始めると、それまでの試合はここに残ります。
      </p>
      <input className="text-input" type="search" placeholder="名前・大会名・日付で探す" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="保存済み試合を探す" />
      <div className="chip-row scroll">
        {[
          ['all', 'すべて', setStatus, status],
          ['finished', '終了', setStatus, status],
          ['unfinished', '途中', setStatus, status],
        ].map(([v, l, fn, cur]) => (
          <button key={`s-${v}`} type="button" className="chip" aria-pressed={cur === v} onClick={() => (fn as (x: string) => void)(v as string)}>
            {l as string}
          </button>
        ))}
        {[
          ['own-win', '勝ち'],
          ['opponent-win', '負け'],
        ].map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={result === v} onClick={() => setResult(result === v ? 'all' : v)}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="empty">{all.length ? '当てはまる試合はありません。' : 'まだ保存済み試合はありません。'}</p>
      ) : (
        <ul className="archive">
          {list.map((e) => (
            <li key={e.id}>
              <b>{e.title || '保存済み試合'}</b>
              <span className="fine">
                {savedAt(e)}保存・{e.finished ? '終了' : '途中'}・{e.pointCount || 0}点
              </span>
              {confirm === e.id ? (
                <div className="slot-confirm">
                  <span>この試合を消しますか？元に戻せません。</span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      E.removeArchivedMatch(e.id)
                      setConfirm(null)
                      setTick((t) => t + 1)
                    }}
                  >
                    消す
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirm(null)}>
                    やめる
                  </button>
                </div>
              ) : (
                <div className="archive-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      act(() => E.openArchivedMatch(e.id))
                      location.hash = href('note')
                    }}
                  >
                    開く
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onSummary(e.state)}>
                    画像
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirm(e.id)}>
                    消す
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function dataUrlToFile(dataUrl: string, name: string) {
  const [head, body] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(head)?.[1] || 'image/png'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

function Summary({ target }: { target: NoteState | null }) {
  const [mode, setMode] = useState<'share' | 'detail'>('share')
  const [nameMode, setNameMode] = useState('role')
  const url = useMemo(() => E.summaryImageDataUrl(target, mode, nameMode), [target, mode, nameMode])
  const name = E.summaryFileName(mode)
  const save = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }
  const share = async () => {
    const file = dataUrlToFile(url, name)
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ソフトテニスIQ｜試合ノート' })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
    save()
  }
  return (
    <main className="screen-body note-summary">
      <h1 className="section-title">サマリー画像{target ? '（保存済み試合）' : ''}</h1>
      <div className="seg" role="group" aria-label="画像の種類">
        <button type="button" aria-pressed={mode === 'share'} onClick={() => setMode('share')}>
          チーム共有用（1枚）
        </button>
        <button type="button" aria-pressed={mode === 'detail'} onClick={() => setMode('detail')}>
          振り返り用（詳しく）
        </button>
      </div>
      {mode === 'share' && (
        <div className="seg" role="group" aria-label="名前の表示">
          {[
            ['role', '役割だけ'],
            ['team', 'チーム名あり'],
            ['full', '名前あり'],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={nameMode === v} onClick={() => setNameMode(v)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <p className="fine">画像はこの端末の中で作ります。共有する前に、名前や大会名が出ていないか確認してください。</p>
      <div className="summary-frame">
        <img src={url} alt="試合のサマリー画像" />
      </div>
      <div className="two-btns">
        <button type="button" className="btn btn-primary" onClick={share}>
          <Share2 size={18} />
          共有
        </button>
        <button type="button" className="btn btn-ghost" onClick={save}>
          <Download size={18} />
          保存
        </button>
      </div>
    </main>
  )
}

export function NoteMenu({ section, act }: { section: string; act: Act }) {
  const [summaryTarget, setSummaryTarget] = useState<NoteState | null>(null)
  const [confirmSample, setConfirmSample] = useState(false)
  const [importText, setImportText] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const s = E.getState()

  if (section === 'new' || section === 'edit') return <MatchForm key={section} mode={section} act={act} />
  if (section === 'archive')
    return (
      <Archive
        act={act}
        onSummary={(st) => {
          setSummaryTarget(st)
          location.hash = href('note', 'summary')
        }}
      />
    )
  if (section === 'summary') return <Summary target={summaryTarget} />

  const info = s.matchInfo
  const archivedCount = E.loadArchivedMatches().length
  const loadSample = () => {
    act(() => E.loadSampleMatch())
    location.hash = href('note', 'analysis')
  }

  return (
    <main className="screen-body note-menu">
      <section className="match-card">
        <p className="eyebrow">今の試合{s.isPracticeMatch ? '（サンプル）' : ''}</p>
        <h1>
          {E.displayName('A')} <span>vs</span> {E.displayName('B')}
        </h1>
        <p className="fine">
          {[s.matchType === 'singles' ? 'シングルス' : 'ダブルス', E.matchFormatLabel(), info.date, info.tournament, info.venueName].filter((x) => x && x !== '未記録').join('・')}
        </p>
        <a className="btn btn-ghost" href={href('note', 'edit')}>
          試合情報を編集
        </a>
      </section>

      <div className="menu-list">
        <a className="menu-item" href={href('note', 'new')}>
          <Plus size={20} />
          <span>
            <b>新しい試合を始める</b>
            <small>今の試合は保存済み試合に残ります</small>
          </span>
        </a>
        <a className="menu-item" href={href('note', 'archive')}>
          <FolderOpen size={20} />
          <span>
            <b>保存済み試合</b>
            <small>{archivedCount}件・開く／画像／消す</small>
          </span>
        </a>
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setSummaryTarget(null)
            location.hash = href('note', 'summary')
          }}
        >
          <ImageIcon size={20} />
          <span>
            <b>サマリー画像</b>
            <small>LINEやSNSで共有する1枚／振り返り用</small>
          </span>
        </button>
        {confirmSample ? (
          <div className="slot-confirm menu-confirm">
            <span>今の試合を保存済み試合に残して、サンプル試合を読み込みます。</span>
            <button type="button" className="btn btn-primary" onClick={loadSample}>
              読み込む
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmSample(false)}>
              やめる
            </button>
          </div>
        ) : (
          <button type="button" className="menu-item" onClick={() => (E.matchHasRecordableData() ? setConfirmSample(true) : loadSample())}>
            <ListIcon />
            <span>
              <b>サンプル試合で試す</b>
              <small>記録済みの例で、分析と履歴の見え方を確かめる</small>
            </span>
          </button>
        )}
      </div>

      <section className="stack">
        <h2 className="section-title">データ</h2>
        <div className="menu-list">
          <button type="button" className="menu-item" onClick={() => E.exportCsv()}>
            <FileSpreadsheet size={20} />
            <span>
              <b>今の試合をCSVで書き出す</b>
              <small>表計算ソフトで開けます</small>
            </span>
          </button>
          <button type="button" className="menu-item" onClick={() => (E.exportArchivedCsv() ? null : setMessage('保存済み試合がまだありません。'))}>
            <FileSpreadsheet size={20} />
            <span>
              <b>保存済み試合をまとめてCSVで書き出す</b>
            </span>
          </button>
          <button type="button" className="menu-item" onClick={() => E.exportBackupJson()}>
            <FileJson size={20} />
            <span>
              <b>試合データを書き出す（端末の引き継ぎ用）</b>
              <small>今の試合と保存済み試合を1つのファイルにします</small>
            </span>
          </button>
          <button type="button" className="menu-item" onClick={() => fileRef.current?.click()}>
            <Upload size={20} />
            <span>
              <b>試合データを読み込む</b>
              <small>書き出したファイルから戻します</small>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) setImportText(await file.text())
            }}
          />
        </div>
        {importText !== null && (
          <div className="slot-confirm">
            <span>読み込むと、今の試合と保存済み試合が置き換わります。</span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                try {
                  act(() => E.importBackupText(importText))
                  setMessage('試合データを読み込みました。')
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '試合データを読み込めませんでした。')
                }
                setImportText(null)
              }}
            >
              読み込む
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setImportText(null)}>
              やめる
            </button>
          </div>
        )}
        {message && (
          <p className="fine" role="status">
            {message}
          </p>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            try {
              localStorage.removeItem('stiq-note-guide-v1')
            } catch {
              // 保存できない環境では何もしない
            }
            location.hash = href('note')
          }}
        >
          記録のしかたをもう一度見る
        </button>
        <p className="fine">記録はこの端末のブラウザにだけ保存され、外部には送られません。以前の「ソフトテニス試合ノート」の記録もそのまま引き継いでいます。</p>
      </section>
    </main>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8l6 4-6 4z" fill="currentColor" />
    </svg>
  )
}
