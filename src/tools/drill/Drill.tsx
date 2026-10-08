import { BarChart3, Check, ChevronLeft, CircleHelp, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { href } from '../../shell/route'
import { Support } from '../../shell/Support'
import {
  buildDrillSet,
  defaultProgress,
  categoryStats,
  DRILL_SET_SIZE,
  findQuestion,
  labelOf,
  masteryRate,
  recordAnswer,
  withShuffledChoices,
} from './logic'
import { loadProgress, saveProgress } from './storage'
import type { Progress, Question } from './types'
import './drill.css'

type Section = 'play' | 'review' | 'record'

interface Session {
  questions: Question[]
  index: number
  selected: string | null
  results: boolean[]
  /** セットの呼び名（ジャンル名や「もう一度」） */
  label: string
}

function newSession(progress: Progress, category = ''): { session: Session; progress: Progress } {
  const built = buildDrillSet(progress, category)
  return {
    progress: built.progress,
    session: {
      questions: built.set.map((q) => withShuffledChoices(q)),
      index: 0,
      selected: null,
      results: [],
      label: category ? labelOf(category) : '',
    },
  }
}

export function Drill({ section }: { section: Section }) {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [session, setSession] = useState<Session>(() => newSession(progress).session)

  useEffect(() => saveProgress(progress), [progress])

  const start = (category = '') => {
    const next = newSession(progress, category)
    setProgress(next.progress)
    setSession(next.session)
    location.hash = href('drill')
  }

  const retryOne = (id: string) => {
    const q = findQuestion(id)
    if (!q) return
    setSession({ questions: [withShuffledChoices(q)], index: 0, selected: null, results: [], label: 'もう一度' })
    location.hash = href('drill')
  }

  const startReview = () => {
    const qs = progress.reviewQueue.map(findQuestion).filter((q): q is Question => Boolean(q)).slice(0, DRILL_SET_SIZE)
    if (!qs.length) return
    setSession({ questions: qs.map((q) => withShuffledChoices(q)), index: 0, selected: null, results: [], label: '振り返り' })
    location.hash = href('drill')
  }

  const answer = (choiceId: string) => {
    const q = session.questions[session.index]
    if (!q || session.selected) return
    setProgress((p) => recordAnswer(p, q, choiceId))
    setSession((s) => ({ ...s, selected: choiceId, results: [...s.results, choiceId === q.answerId] }))
  }

  const next = () => setSession((s) => ({ ...s, index: s.index + 1, selected: null }))

  const reviewCount = progress.reviewQueue.length

  return (
    <div className="screen drill">
      <header className="appbar">
        <a className="icon-btn" href={href()} aria-label="ホームへ戻る">
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="brandmark" aria-hidden="true" />
          ルールドリル
        </div>
        {section === 'play' && session.index < session.questions.length && (
          <div className="appbar-end num drill-count">
            {session.index + 1} / {session.questions.length}
          </div>
        )}
      </header>

      {section === 'play' &&
        (session.index < session.questions.length ? (
          <Play session={session} onAnswer={answer} onNext={next} />
        ) : (
          <Result session={session} onRestart={() => start()} reviewCount={reviewCount} />
        ))}
      {section === 'review' && (
        <Review progress={progress} onRetry={retryOne} onCategory={start} onReviewAll={startReview} />
      )}
      {section === 'record' && <Record progress={progress} onReset={() => setProgress(defaultProgress())} />}

      <nav className="tabbar" aria-label="ルールドリルのメニュー">
        <a className="tab" href={href('drill')} aria-current={section === 'play' ? 'page' : undefined}>
          <CircleHelp size={22} aria-hidden="true" />
          ドリル
        </a>
        <a className="tab" href={href('drill', 'review')} aria-current={section === 'review' ? 'page' : undefined}>
          <RotateCcw size={22} aria-hidden="true" />
          振り返り
          {reviewCount > 0 && <span className="badge">{reviewCount}</span>}
        </a>
        <a className="tab" href={href('drill', 'record')} aria-current={section === 'record' ? 'page' : undefined}>
          <BarChart3 size={22} aria-hidden="true" />
          記録
        </a>
      </nav>
    </div>
  )
}

/** 10問の進み具合をボールで並べる */
function Balls({ total, results, current }: { total: number; results: boolean[]; current?: number }) {
  return (
    <ol className="balls" aria-label={`${total}問中${results.length}問回答、正解${results.filter(Boolean).length}問`}>
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={i < results.length ? (results[i] ? 'ok' : 'ng') : i === current ? 'now' : ''}
        />
      ))}
    </ol>
  )
}

function Play({ session, onAnswer, onNext }: { session: Session; onAnswer: (id: string) => void; onNext: () => void }) {
  const q = session.questions[session.index]
  const answered = session.selected !== null
  const correct = session.selected === q.answerId
  const nextRef = useRef<HTMLButtonElement>(null)
  const isLast = session.index === session.questions.length - 1

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true })
  }, [answered])

  return (
    <main className="screen-body play">
      {session.questions.length > 1 && (
        <Balls total={session.questions.length} results={session.results} current={session.index} />
      )}
      <p className="eyebrow">{session.label || labelOf(q.category)}</p>
      <h1 className="prompt">{q.prompt}</h1>

      <div className="choices" role="group" aria-label="答えを選ぶ">
        {q.choices.map((c, i) => {
          const state = !answered
            ? ''
            : c.id === q.answerId
              ? 'is-right'
              : c.id === session.selected
                ? 'is-wrong'
                : 'is-dim'
          return (
            <button key={c.id} type="button" className={`choice ${state}`} onClick={() => onAnswer(c.id)} disabled={answered}>
              <span className="choice-no num">{i + 1}</span>
              <span className="choice-text">{c.text}</span>
              {state === 'is-right' && <Check size={20} aria-label="正解" />}
              {state === 'is-wrong' && <X size={20} aria-label="あなたの答え" />}
            </button>
          )
        })}
      </div>

      {answered && (
        <section className={`feedback ${correct ? 'is-right' : 'is-wrong'}`} aria-live="polite">
          <p className="feedback-head">{correct ? '正解' : 'おしい'}</p>
          <p>
            <b>{q.officialTerm}</b>　{q.plainExplanation}
          </p>
          <p className="feedback-ref">ルールブック：{q.ruleRef}</p>
        </section>
      )}

      <div className="play-foot">
        {answered ? (
          <button ref={nextRef} type="button" className="btn btn-primary btn-block" onClick={onNext}>
            {isLast ? '結果を見る' : '次の問題へ'}
          </button>
        ) : (
          <p className="hint">選ぶと、ルールの用語と短い説明が出ます。</p>
        )}
      </div>
    </main>
  )
}

function resultMessage(score: number, total: number) {
  if (score === total) return '満点です。このジャンルはばっちりです。'
  if (score >= Math.ceil(total * 0.7)) return 'いい調子です。まちがえた問題だけ見直しておきましょう。'
  return 'まちがえた問題は「振り返り」に入っています。次に覚えるチャンスです。'
}

function Result({ session, onRestart, reviewCount }: { session: Session; onRestart: () => void; reviewCount: number }) {
  const total = session.questions.length
  const score = session.results.filter(Boolean).length
  const missed = session.questions.filter((_, i) => session.results[i] === false)
  return (
    <main className="screen-body result">
      <p className="eyebrow">{session.label || `${DRILL_SET_SIZE}問セット`} 完了</p>
      <p className="result-score num">
        {score}
        <span>/ {total}</span>
      </p>
      {total > 1 && <Balls total={total} results={session.results} />}
      <p className="result-msg">{resultMessage(score, total)}</p>

      <div className="result-actions">
        <button type="button" className="btn btn-accent btn-block" onClick={onRestart}>
          次の{DRILL_SET_SIZE}問へ
        </button>
        {reviewCount > 0 && (
          <a className="btn btn-ghost btn-block" href={href('drill', 'review')}>
            振り返りを見る（{reviewCount}問）
          </a>
        )}
      </div>
      {missed.length > 0 && (
        <section className="missed">
          <h2>まちがえた問題</h2>
          <ul>
            {missed.map((q) => (
              <li key={q.id}>
                <b>{q.officialTerm}</b>
                <span>{q.plainExplanation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Support compact />
    </main>
  )
}

function Review({
  progress,
  onRetry,
  onCategory,
  onReviewAll,
}: {
  progress: Progress
  onRetry: (id: string) => void
  onCategory: (category: string) => void
  onReviewAll: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const items = progress.reviewQueue.map(findQuestion).filter((q): q is Question => Boolean(q))
  const visible = showAll ? items : items.slice(0, 5)
  const stats = categoryStats(progress)
  return (
    <main className="screen-body review">
      <section className="stack">
        <div className="review-head">
          <h1 className="section-title">もう一度やる問題</h1>
          {items.length > 0 && <span className="num drill-count">{items.length}問</span>}
        </div>
        {items.length === 0 ? (
          <p className="empty">まちがえた問題がここに入ります。今は0問です。</p>
        ) : (
          <ul className="retry-list">
            {visible.map((q) => (
              <li key={q.id}>
                <button type="button" className="retry" onClick={() => onRetry(q.id)}>
                  <span className="retry-cat">{labelOf(q.category)}</span>
                  <span className="retry-q">{q.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length > 5 && (
          <button type="button" className="more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '5問だけ表示' : `残り${items.length - 5}問も表示`}
          </button>
        )}
        {items.length > 0 && (
          <button type="button" className="btn btn-accent btn-block" onClick={onReviewAll}>
            まとめてやる（{Math.min(items.length, DRILL_SET_SIZE)}問）
          </button>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">ジャンルを選んで練習</h2>
        <div className="cat-grid">
          {stats.map((s) => (
            <button key={s.category} type="button" className="cat" onClick={() => onCategory(s.category)}>
              <span className="cat-name">{labelOf(s.category)}</span>
              <span className="cat-num num">
                {s.correct}
                <small>/{s.total}</small>
              </span>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${s.rate}%` }} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function formatDate(value: string) {
  const d = new Date(value)
  if (!value || Number.isNaN(d.getTime())) return 'まだありません'
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Record({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const total = progress.totalAnswered
  const accuracy = total ? Math.round((progress.totalCorrect / total) * 100) : 0
  const stats = categoryStats(progress)
  return (
    <main className="screen-body record">
      <h1 className="section-title">これまでの記録</h1>
      <div className="stat-row">
        <div>
          <span>回答数</span>
          <b className="num">{total}</b>
        </div>
        <div>
          <span>正答率</span>
          <b className="num">
            {accuracy}
            <small>%</small>
          </b>
        </div>
        <div>
          <span>最高連続正解</span>
          <b className="num">{progress.bestStreak}</b>
        </div>
      </div>
      <p className="record-note">
        覚えた問題 <b className="num">{masteryRate(progress)}%</b>（2回以上答えて8割正解）・最後に解いた日 {formatDate(progress.lastStudyAt)}
      </p>

      <section className="stack">
        <h2 className="section-title">ジャンル別（一度でも正解した問題の割合）</h2>
        <ul className="bars">
          {stats.map((s) => (
            <li key={s.category}>
              <span>{labelOf(s.category)}</span>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${s.rate}%` }} />
              </span>
              <b className="num">{s.rate}%</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="reset">
        <p>記録はこの端末のブラウザにだけ保存されています。</p>
        {confirming ? (
          <div className="reset-confirm">
            <p>この端末の学習記録をすべて消します。元に戻せません。</p>
            <div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onReset()
                  setConfirming(false)
                }}
              >
                消す
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
            学習記録を消す
          </button>
        )}
      </section>
    </main>
  )
}
