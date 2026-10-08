import { BarChart3, CalendarCheck, Check, ChevronLeft, ListChecks, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { href } from '../../shell/route'
import { Support } from '../../shell/Support'
import {
  LETTERS,
  bestStreak,
  categories,
  currentStreak,
  dateKey,
  defaultProgress,
  questions,
  recordAnswer,
  todaysQuestion,
} from './logic'
import type { QuizProgress, QuizQuestion } from './logic'
import { QuizCourt } from './QuizCourt'
import { loadProgress, saveProgress } from './storage'
import '../drill/drill.css'
import './quiz.css'

export type QuizSection = 'today' | 'archive' | 'record'

export function Quiz({ section, id }: { section: QuizSection; id?: string }) {
  const [progress, setProgress] = useState<QuizProgress>(loadProgress)
  const today = dateKey(new Date())
  useEffect(() => saveProgress(progress), [progress])

  const answer = (q: QuizQuestion, choice: number, isDaily: boolean) => setProgress((p) => recordAnswer(p, q, choice, today, isDaily))
  const picked = id ? questions.find((q) => q.id === id) : undefined

  return (
    <div className="screen drill quiz">
      <header className="appbar">
        <a className="icon-btn" href={picked ? href('quiz', 'archive') : href()} aria-label={picked ? '問題の一覧へ戻る' : 'ホームへ戻る'}>
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="brandmark" aria-hidden="true" />
          局面クイズ
        </div>
      </header>

      {section === 'today' && <Today progress={progress} today={today} onAnswer={answer} />}
      {section === 'archive' &&
        (picked ? (
          <QuestionCard key={picked.id} q={picked} label={`No.${picked.no}・${picked.category}`} onAnswer={(c) => answer(picked, c, false)} />
        ) : (
          <Archive progress={progress} />
        ))}
      {section === 'record' && <Record progress={progress} today={today} onReset={() => setProgress(defaultProgress())} />}

      <nav className="tabbar" aria-label="局面クイズのメニュー">
        <a className="tab" href={href('quiz')} aria-current={section === 'today' ? 'page' : undefined}>
          <CalendarCheck size={22} aria-hidden="true" />
          今日の1問
        </a>
        <a className="tab" href={href('quiz', 'archive')} aria-current={section === 'archive' ? 'page' : undefined}>
          <ListChecks size={22} aria-hidden="true" />
          過去の問題
        </a>
        <a className="tab" href={href('quiz', 'record')} aria-current={section === 'record' ? 'page' : undefined}>
          <BarChart3 size={22} aria-hidden="true" />
          記録
        </a>
      </nav>
    </div>
  )
}

function Today({
  progress,
  today,
  onAnswer,
}: {
  progress: QuizProgress
  today: string
  onAnswer: (q: QuizQuestion, choice: number, isDaily: boolean) => void
}) {
  const q = todaysQuestion(questions, today)
  if (!q) {
    return (
      <main className="screen-body">
        <p className="empty">問題を準備中です。</p>
      </main>
    )
  }
  const done = progress.days[today]
  const [m, d] = today.slice(5).split('-').map(Number)
  return (
    <QuestionCard
      key={`${today}-${q.id}`}
      q={q}
      label={`今日の1問　${m}月${d}日`}
      initialChoice={done && done.id === q.id ? done.choice : undefined}
      onAnswer={(c) => onAnswer(q, c, true)}
      footer={(correct) => <ShareToday dateLabel={`${m}/${d}`} correct={correct} streak={currentStreak(progress, today)} />}
    />
  )
}

function QuestionCard({
  q,
  label,
  initialChoice,
  onAnswer,
  footer,
}: {
  q: QuizQuestion
  label: string
  initialChoice?: number
  onAnswer: (choice: number) => void
  footer?: (correct: boolean) => ReactNode
}) {
  const [choice, setChoice] = useState<number | undefined>(initialChoice)
  const answered = choice !== undefined
  const correct = choice === q.correct

  const pick = (i: number) => {
    if (answered) return
    setChoice(i)
    onAnswer(i)
  }

  return (
    <main className="screen-body play quiz-play">
      <p className="eyebrow">{label}</p>
      <h1 className="prompt">{q.question}</h1>
      <dl className="quiz-premise">
        {q.premise.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <QuizCourt q={q} showAnswer={answered} />

      <div className="choices" role="group" aria-label="答えを選ぶ">
        {q.options.map((o, i) => {
          const state = !answered ? '' : i === q.correct ? 'is-right' : i === choice ? 'is-wrong' : 'is-dim'
          return (
            <button key={i} type="button" className={`choice ${state}`} onClick={() => pick(i)} disabled={answered}>
              <span className="choice-no num">{LETTERS[i]}</span>
              <span className="choice-text">
                {o.main}
                {o.sub && <small>{o.sub}</small>}
              </span>
              {state === 'is-right' && <Check size={20} aria-label="正解" />}
              {state === 'is-wrong' && <X size={20} aria-label="あなたの答え" />}
            </button>
          )
        })}
      </div>

      {answered ? (
        <>
          <section className={`feedback ${correct ? 'is-right' : 'is-wrong'}`} aria-live="polite">
            <p className="feedback-head">{correct ? '正解' : `おしい　正解は ${LETTERS[q.correct]}`}</p>
            {q.explain && <p>{q.explain}</p>}
          </section>
          {q.others.length > 0 && (
            <section className="quiz-list">
              <h2 className="section-title">ほかの選択肢は？</h2>
              <ul>
                {q.others.map(([o, why]) => (
                  <li key={o}>
                    <b>{o}</b>
                    <span>{why}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {q.rules.length > 0 && (
            <section className="quiz-list">
              <h2 className="section-title">覚えておくこと</h2>
              <ul>
                {q.rules.map(([r, why]) => (
                  <li key={r}>
                    <b>{r}</b>
                    <span>{why}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {footer?.(correct)}
          <a className="btn btn-ghost btn-block" href={href('quiz', 'archive')}>
            過去の問題も解く
          </a>
          <Support compact />
        </>
      ) : (
        <p className="hint">選ぶと、正解の動きと理由が出ます。</p>
      )}
    </main>
  )
}

function ShareToday({ dateLabel, correct, streak }: { dateLabel: string; correct: boolean; streak: number }) {
  const [msg, setMsg] = useState('')
  const share = async () => {
    const url = `${location.origin}${location.pathname}?src=quiz_share#/quiz`
    const text = `ソフトテニスIQ 今日の1問（${dateLabel}）\n${correct ? '⭕ 正解' : '❌ 不正解'}${streak > 1 ? `　🔥連続${streak}日` : ''}\nキミは解ける？`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ソフトテニスIQ 局面クイズ', text, url })
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
    <div className="quiz-share">
      {streak > 0 && (
        <p className="quiz-streak">
          <b className="num">{streak}</b>日連続
        </p>
      )}
      <button type="button" className="btn btn-accent btn-block" onClick={share}>
        <Share2 size={18} aria-hidden="true" />
        結果を友達に送る
      </button>
      {msg && (
        <p className="support-msg" role="status">
          {msg}
        </p>
      )}
      <p className="hint">次の問題は、明日また出ます。</p>
    </div>
  )
}

function Archive({ progress }: { progress: QuizProgress }) {
  const [cat, setCat] = useState('')
  const cats = categories(questions)
  const list = [...questions].reverse().filter((q) => !cat || q.category === cat)
  return (
    <main className="screen-body stack">
      <h1 className="section-title">過去の問題（{questions.length}問）</h1>
      <div className="quiz-chips" role="group" aria-label="カテゴリで絞り込む">
        {['', ...cats].map((c) => (
          <button key={c || 'all'} type="button" className="quiz-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c || 'すべて'}
          </button>
        ))}
      </div>
      <ul className="retry-list">
        {list.map((q) => {
          const s = progress.solved[q.id]
          return (
            <li key={q.id}>
              <a className="retry quiz-item" href={href('quiz', 'archive', q.id)}>
                <span className="retry-cat">
                  No.{q.no}・{q.category}・{q.level}
                </span>
                <span className="retry-q">{q.question}</span>
                {s && <span className={`quiz-mark ${s.correct ? 'ok' : 'ng'}`}>{s.correct ? '正解' : 'まちがい'}</span>}
              </a>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function Record({ progress, today, onReset }: { progress: QuizProgress; today: string; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const solved = Object.values(progress.solved)
  const correct = solved.filter((s) => s.correct).length
  return (
    <main className="screen-body record">
      <h1 className="section-title">これまでの記録</h1>
      <div className="stat-row">
        <div>
          <span>連続日数</span>
          <b className="num">{currentStreak(progress, today)}</b>
        </div>
        <div>
          <span>最高連続</span>
          <b className="num">{bestStreak(progress)}</b>
        </div>
        <div>
          <span>解いた日</span>
          <b className="num">{Object.keys(progress.days).length}</b>
        </div>
      </div>
      <p className="record-note">
        解いた問題 <b className="num">{solved.length}</b> / {questions.length}問・そのうち正解 <b className="num">{correct}</b>問（最後の答えで数えます）
      </p>
      <section className="reset">
        <p>記録はこの端末のブラウザにだけ保存されています。</p>
        {confirming ? (
          <div className="result-actions">
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => {
                onReset()
                setConfirming(false)
              }}
            >
              記録を消す
            </button>
            <button type="button" className="btn btn-quiet btn-block" onClick={() => setConfirming(false)}>
              やめる
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
            記録をリセット
          </button>
        )}
      </section>
    </main>
  )
}
