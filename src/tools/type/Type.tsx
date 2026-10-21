import { ChevronLeft, RotateCcw, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { href } from '../../shell/route'
import { Support } from '../../shell/Support'
import { countEvent } from '../../shell/track'
import { AXES, AXIS_INFO, PAIR_NOTE, QUESTIONS, TIP, TYPES } from './data'
import type { Axis } from './data'
import { isTypeKey, matchOf, plainName, scoreOf } from './logic'
import type { TypeResult } from './logic'
import { loadLast, saveLast } from './storage'
import '../drill/drill.css'
import './type.css'

const LETTERS = ['A', 'B', 'C', 'D']

/** 名前は「|」の位置でだけ改行する（言葉の途中で折り返さない） */
function TypeName({ k }: { k: string }) {
  return (
    <>
      {TYPES[k].name.split('|').map((part) => (
        <span key={part} className="nb">
          {part}
        </span>
      ))}
    </>
  )
}

export function Type({ view }: { view?: string }) {
  const shown = isTypeKey(view) ? view : undefined
  return (
    <div className="screen drill type">
      <header className="appbar">
        <a className="icon-btn" href={shown ? href('type') : href()} aria-label={shown ? '診断へ戻る' : 'ホームへ戻る'}>
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="brandmark" aria-hidden="true" />
          タイプ診断
        </div>
      </header>
      {shown ? <TypeView k={shown} /> : <Diagnosis />}
    </div>
  )
}

/** 診断の本体：はじめ → 12問 → 結果 */
function Diagnosis() {
  const [picks, setPicks] = useState<number[] | null>(null)
  const [result, setResult] = useState<TypeResult | null>(null)
  const last = loadLast()

  useEffect(() => {
    countEvent('softtennis-type', 'open')
  }, [])

  useEffect(() => {
    if (result) {
      saveLast(result.key)
      countEvent('softtennis-type', 'finish')
    }
  }, [result])

  if (result) return <Result r={result} onRetry={() => (setResult(null), setPicks([]))} />

  if (picks === null) {
    return (
      <main className="screen-body type-intro">
        <p className="eyebrow">SOFT TENNIS TYPE</p>
        <h1 className="type-title">
          <span className="nb">あなたの</span>
          <span className="nb">プレースタイルは、</span>
          <span className="nb">30タイプの</span>
          <span className="nb">どれ？</span>
        </h1>
        <p className="type-lead">12問・1分。攻め・ねばり・読み・前へ・ペア力・こだわりの6つから、あなたのタイプと相性のいいペアが分かります。</p>
        <button type="button" className="btn btn-accent btn-block" onClick={() => setPicks([])}>
          診断をはじめる
        </button>
        {last && (
          <a className="btn btn-ghost btn-block" href={href('type', 't', last)}>
            前回の結果：{plainName(last)}
          </a>
        )}
        <p className="type-note">遊びの診断です。実力や性格を測るものではありません。答えと結果はどこにも送りません（数えるのは回数だけ）。</p>
      </main>
    )
  }

  const i = picks.length
  const q = QUESTIONS[i]
  const pick = (c: number) => {
    const next = [...picks, c]
    if (next.length === QUESTIONS.length) setResult(scoreOf(next))
    else setPicks(next)
  }
  return (
    <main className="screen-body play type-play">
      <div className="type-progress" aria-hidden="true">
        <i style={{ width: `${(i / QUESTIONS.length) * 100}%` }} />
      </div>
      <p className="eyebrow num">
        Q{i + 1} / {QUESTIONS.length}
      </p>
      <h1 className="prompt">{q.q}</h1>
      <div className="choices" role="group" aria-label="いちばん近いものを選ぶ">
        {q.options.map((op, c) => (
          <button key={`${i}-${c}`} type="button" className="choice" onClick={() => pick(c)}>
            <span className="choice-no num">{LETTERS[c]}</span>
            <span className="choice-text">
              {op.main}
              {op.sub && <small>{op.sub}</small>}
            </span>
          </button>
        ))}
      </div>
      {i > 0 && (
        <button type="button" className="btn btn-quiet" onClick={() => setPicks(picks.slice(0, -1))}>
          ひとつ前に戻る
        </button>
      )}
    </main>
  )
}

/** 診断の結果：見せ場は名前だけ。下に内訳・相性・ひとこと */
function Result({ r, onRetry }: { r: TypeResult; onRetry: () => void }) {
  const t = TYPES[r.key]
  return (
    <main className="screen-body type-result">
      <section className="type-hero">
        <p className="eyebrow">あなたのタイプ</p>
        <h1 className="type-name type-reveal">
          <TypeName k={r.key} />
        </h1>
        <p className="type-catch">{t.catch}</p>
        <p className="type-aruaru">{t.aruaru}</p>
      </section>

      <section className="type-block">
        <h2>6つの項目</h2>
        <div className="type-bars">
          {[...AXES]
            .sort((a, b) => r.pct[b] - r.pct[a])
            .map((a) => (
              <div key={a} className={`type-bar ${a === r.main || a === r.sub ? 'is-top' : ''}`}>
                <span className="type-bar-label">{AXIS_INFO[a].name}</span>
                <span className="type-bar-track">
                  <i style={{ width: `${r.pct[a]}%` }} />
                </span>
                <b className="num">{r.pct[a]}</b>
              </div>
            ))}
        </div>
        <p className="type-note">50 がふつう。1位と2位の組み合わせで、タイプが決まります。</p>
      </section>

      <Details k={r.key} main={r.main} />

      <ShareType k={r.key} />
      <button type="button" className="btn btn-quiet" onClick={onRetry}>
        <RotateCcw size={16} aria-hidden="true" />
        もう一度診断する
      </button>
      <p className="type-note">遊びの診断です。実力や性格を測るものではありません。</p>
      <Support compact />
    </main>
  )
}

/** 相性・ペアになる人へ・上達のひとこと（結果とタイプ紹介で共通） */
function Details({ k, main }: { k: string; main: Axis }) {
  const match = matchOf(k)
  return (
    <>
      <section className="type-block">
        <h2>相性のいいペア</h2>
        <a className="type-match" href={href('type', 't', match)}>
          <b>
            <TypeName k={match} />
          </b>
          <span>{TYPES[match].catch}</span>
        </a>
      </section>
      <section className="type-block">
        <h2>ペアになる人へ</h2>
        <p>{PAIR_NOTE[main]}</p>
      </section>
      <section className="type-block">
        <h2>上達のひとこと</h2>
        <p>{TIP[main]}</p>
      </section>
    </>
  )
}

/** タイプの紹介（共有リンク・相性のリンクから開く） */
function TypeView({ k }: { k: string }) {
  const t = TYPES[k]
  const [a, b] = k.split('-') as [Axis, Axis]
  return (
    <main className="screen-body type-result">
      <section className="type-hero">
        <p className="eyebrow">
          {AXIS_INFO[a].name} × {AXIS_INFO[b].name}
        </p>
        <h1 className="type-name">
          <TypeName k={k} />
        </h1>
        <p className="type-catch">{t.catch}</p>
        <p className="type-aruaru">{t.aruaru}</p>
      </section>
      <Details k={k} main={a} />
      <a className="btn btn-accent btn-block" href={href('type')}>
        自分のタイプを診断する
      </a>
      <p className="type-note">遊びの診断です。実力や性格を測るものではありません。</p>
    </main>
  )
}

function ShareType({ k }: { k: string }) {
  const [msg, setMsg] = useState('')
  const share = async () => {
    countEvent('softtennis-type', 'share')
    const url = `${location.origin}${location.pathname}?src=type_share#/type/t/${k}`
    const text = `ソフトテニス タイプ診断\n私は「${plainName(k)}」タイプ\n${TYPES[k].catch}\nあなたは？ #ソフトテニス`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ソフトテニス タイプ診断', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setMsg('結果をコピーしました')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMsg(`${text}\n${url}`)
    }
  }
  return (
    <div className="type-share">
      <button type="button" className="btn btn-accent btn-block" onClick={share}>
        <Share2 size={18} aria-hidden="true" />
        結果をペアに送る
      </button>
      {msg && (
        <p className="support-msg" role="status">
          {msg}
        </p>
      )}
    </div>
  )
}
