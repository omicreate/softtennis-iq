// 試合ノート：分析（数字と文言は旧アプリのエンジンをそのまま使う）
import { useState } from 'react'
import { href } from '../../shell/route'
import * as E from './engine/engine.js'

type Tone = 'own' | 'opp' | 'neutral' | string

function Bars({ title, counts, tone }: { title: string; counts: Record<string, number>; tone: Tone }) {
  const entries = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <section className="an-block">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className="empty">まだ記録がありません</p>
      ) : (
        <ul className="bars">
          {entries.map(([label, value]) => (
            <li key={label} className={`tone-${tone}`}>
              <span>{label}</span>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${Math.max(8, Math.round((value / max) * 100))}%` }} />
              </span>
              <b className="num">{value}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PlayerCard({ item }: { item: ReturnType<typeof E.getPlayerPlusMinus>[number] }) {
  const tone = item.diff > 0 ? 'own' : item.diff < 0 ? 'opp' : 'neutral'
  const chips = (list: [string, number][]) =>
    list.length ? (
      <div className="pm-chips">
        {list.slice(0, 5).map(([label, v]) => (
          <span key={label}>
            {label} <b>{v}</b>
          </span>
        ))}
      </div>
    ) : (
      <p className="empty">記録なし</p>
    )
  return (
    <article className={`pm-card tone-${tone}`}>
      <div className="pm-head">
        <strong>{item.label}</strong>
        <span className="pm-diff num">{E.formatContributionDiff(item.diff)}</span>
      </div>
      <div className="pm-score num">
        <b className="plus">+{item.plus}</b>
        <b className="minus">−{item.minus}</b>
      </div>
      <small>決まり方</small>
      {chips(item.outcomes)}
      <small>プレー別</small>
      {chips(item.shots)}
      <ul className="pm-review">
        {E.buildPlayerReviewItems(item).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </article>
  )
}

function ServeReceiveCard({ item }: { item: ReturnType<typeof E.getPlayerServeReceiveStats>[number] }) {
  return (
    <article className={`sr-card tone-${item.tone}`}>
      <div className="pm-head">
        <strong>{item.label}</strong>
        <span className="pm-diff num">{E.formatContributionDiff(item.diff)}</span>
      </div>
      <dl>
        <dt>サーブ</dt>
        <dd>
          <b className="num">{item.servePoints ? `${item.firstServe}/${item.servePoints}本` : '未記録'}</b>
          <small>ファースト {E.formatRate(item.firstServeRate)}・DF {item.doubleFaults}本・得点 {item.serveScores}本</small>
        </dd>
        <dt>レシーブ</dt>
        <dd>
          <b className="num">{item.receivePoints ? `${item.receiveKeep}/${item.receivePoints}本` : '未記録'}</b>
          <small>成功 {E.formatRate(item.receiveKeepRate)}・得点 {item.receiveScores}本・ミス {item.receiveMisses}本</small>
        </dd>
      </dl>
    </article>
  )
}

export function NoteAnalysis({ act }: { act: <T>(fn: () => T) => T }) {
  const [mode, setMode] = useState<'overall' | 'players'>('overall')
  const s = E.getState()
  const data = E.getAnalysisData()
  const opening = E.getGameOpeningStats()
  const ownWon = s.points.filter((p) => p.winner === 'A')
  const ownLost = s.points.filter((p) => p.winner === 'B')
  const comments = [...new Set(E.buildSummaryComments(data))].slice(0, 3)
  const { ownItems, opponentItems } = E.getSideInsightItems()
  const plan = E.buildActionPlanRows(data, { limit: 5 })
  const rally = E.getRallyLengthStats()
  const players = E.getPlayerPlusMinus()
  const sr = E.getPlayerServeReceiveStats()
  const ownTitle = s.matchType === 'singles' ? '自分' : '自チーム'

  if (!data.total) {
    return (
      <main className="screen-body note-analysis">
        <div className="start-card">
          <p>ポイントを記録すると、ここに試合の傾向と次に活かすポイントが出ます。</p>
          <div className="start-actions">
            <a className="chip" href={href('note')}>
              記録する
            </a>
            <a className="chip" href={href('note', 'menu')}>
              サンプル試合で見てみる
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="screen-body note-analysis">
      <div className="metrics">
        {[
          ['ゲーム最初の1本', opening.total ? `${opening.own}/${opening.total}本` : '未記録', opening.total ? (opening.own >= opening.opp ? 'own' : 'opp') : 'neutral'],
          ['自分たちで取った', `${data.ownScoredByPattern}本`, 'own'],
          ['相手ミスで取った', `${data.ownPointsByOpponentError}本`, 'own'],
          ['ミスで与えた', `${data.ownLostByOwnError}本`, 'opp'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`metric tone-${tone}`}>
            <span>{label}</span>
            <b className="num">{value}</b>
          </div>
        ))}
      </div>

      <section className="an-card">
        <h2>試合から分かったこと</h2>
        <ul className="dots">
          {comments.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="sides">
          <article className="tone-own">
            <b>{ownTitle}</b>
            <ul>
              {ownItems.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
          <article className="tone-opp">
            <b>相手</b>
            <ul>
              {opponentItems.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="an-card">
        <h2>次に活かすポイント</h2>
        <ol className="plan">
          {plan.map(([title, note, tone]) => (
            <li key={title} className={`tone-${tone}`}>
              <b>{title}</b>
              <span>{note}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="seg" role="group" aria-label="表示">
        <button type="button" aria-pressed={mode === 'overall'} onClick={() => setMode('overall')}>
          試合全体
        </button>
        <button type="button" aria-pressed={mode === 'players'} onClick={() => setMode('players')}>
          選手別
        </button>
      </div>

      {mode === 'overall' ? (
        <>
          <section className="an-block">
            <h3>流れと勝負所</h3>
            <ul className="momentum">
              {E.getMomentumRows().map(([label, value, tone, note, detail]) => (
                <li key={label} className={`tone-${tone}`}>
                  <span>{label}</span>
                  <b>{value}</b>
                  <small>{note}。{detail}</small>
                </li>
              ))}
            </ul>
          </section>
          <Bars title="得点の場面" counts={E.getScoringSituationCounts()} tone="own" />
          <Bars title="失点の場面" counts={E.getLosingSituationCounts()} tone="opp" />
          <Bars title="得点パターン（自チーム）" counts={E.countByOutcomeType('score', ownWon)} tone="own" />
          <Bars title="与えたミス（自チーム）" counts={E.countByOutcomeType('error', ownLost)} tone="opp" />
          <Bars title="ラリーの長さ（サービスを1本目として）" counts={{ '3本以内': rally.short, '4本以上': rally.long }} tone="neutral" />
        </>
      ) : (
        <>
          {(['A', 'B'] as const).map((side) => (
            <section key={side} className="an-block">
              <h3>{side === 'A' ? ownTitle : '相手'}：+／−と貢献差</h3>
              <p className="fine">＋は得点として記録したプレー、−はミスとして記録したプレーです。前衛・後衛の良し悪しは決めつけず、記録された事実で見ます。</p>
              <div className="card-grid">
                {players
                  .filter((p) => p.side === side)
                  .map((p) => (
                    <PlayerCard key={p.key} item={p} />
                  ))}
              </div>
            </section>
          ))}
          {(['A', 'B'] as const).map((side) => (
            <section key={`sr-${side}`} className="an-block">
              <h3>{side === 'A' ? ownTitle : '相手'}：サーブ・レシーブ</h3>
              <div className="card-grid">
                {sr
                  .filter((p) => p.side === side)
                  .map((p) => (
                    <ServeReceiveCard key={p.player} item={p} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}

      <section className="an-card">
        <div className="rec-head">
          <h2>保存した振り返り</h2>
          <button type="button" className="btn btn-ghost" onClick={() => act(() => E.saveAnalysisMemo())}>
            今の振り返りを保存
          </button>
        </div>
        {(s.analysisMemos || []).length === 0 ? (
          <p className="empty">試合の途中で保存すると、その時点の選手別コメントが残ります。</p>
        ) : (
          <ul className="memos">
            {s.analysisMemos.map((m: { at: string; games?: { A: number; B: number }; points?: { A: number; B: number }; pointCount: number; items?: string[] }) => {
              const d = new Date(m.at)
              const time = Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              return (
                <li key={m.at}>
                  <b className="num">
                    {time}　G {m.games?.A ?? 0}-{m.games?.B ?? 0}・{m.pointCount}点時点
                  </b>
                  <ul>
                    {(m.items || []).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <a className="btn btn-primary btn-block" href={href('note', 'summary')}>
        サマリー画像を作る
      </a>
    </main>
  )
}
