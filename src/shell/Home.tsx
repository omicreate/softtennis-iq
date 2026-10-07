import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { loadProgress } from '../tools/drill/storage'
import { href } from './route'
import { Support } from './Support'
import { tools, type ToolId } from './tools'
import './home.css'

/** 各ツールのカードに載せる小さな図（その道具の「現物」を見せる） */
function ToolVisual({ id }: { id: ToolId }) {
  if (id === 'drill') {
    const p = loadProgress()
    const rate = p.totalAnswered ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : null
    return (
      <div className="tv tv-drill" aria-hidden="true">
        <div className="tv-balls">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} className={i < 6 ? 'ok' : i === 6 ? 'ng' : ''} />
          ))}
        </div>
        <span className="num">{rate === null ? '108問' : `正答率 ${rate}%`}</span>
      </div>
    )
  }
  if (id === 'quiz') {
    return (
      <svg className="tv tv-court" viewBox="0 0 120 64" aria-hidden="true">
        <rect width="120" height="64" rx="6" fill="var(--apron)" />
        <rect x="8" y="10" width="104" height="44" fill="var(--court)" stroke="#fff" strokeWidth="1.2" />
        <line x1="60" y1="6" x2="60" y2="58" stroke="var(--bg)" strokeWidth="3" />
        <circle cx="26" cy="22" r="5" fill="var(--ours)" />
        <circle cx="46" cy="40" r="5" fill="var(--ours)" />
        <rect x="80" y="18" width="9" height="9" rx="2" fill="#fff" />
        <text x="96" y="46" fontSize="20" fontWeight="900" fill="var(--ball)">?</text>
      </svg>
    )
  }
  if (id === 'jinkei') {
    return (
      <svg className="tv tv-court" viewBox="0 0 120 64" aria-hidden="true">
        <rect width="120" height="64" rx="6" fill="var(--apron)" />
        <rect x="8" y="10" width="104" height="44" fill="var(--court)" stroke="#fff" strokeWidth="1.2" />
        <line x1="60" y1="6" x2="60" y2="58" stroke="var(--bg)" strokeWidth="3" />
        <line x1="22" y1="32" x2="112" y2="12" stroke="var(--ball)" strokeWidth="1.2" />
        <line x1="22" y1="32" x2="112" y2="52" stroke="var(--ball)" strokeWidth="1.2" />
        <circle cx="22" cy="32" r="5" fill="var(--ours)" />
        <circle cx="48" cy="22" r="5" fill="var(--ours)" />
        <rect x="88" y="34" width="9" height="9" rx="2" fill="#fff" />
        <rect x="70" y="16" width="9" height="9" rx="2" fill="#fff" />
      </svg>
    )
  }
  return (
    <div className="tv tv-score num" aria-hidden="true">
      <b>3</b>
      <span>2–2</span>
      <b className="opp">2</b>
    </div>
  )
}

export function Home() {
  return (
    <div className="screen home">
      <header className="appbar">
        <div className="appbar-title">
          <span className="ballmark" aria-hidden="true" />
          ソフトテニスIQ
        </div>
      </header>
      <main className="screen-body">
        <section className="home-hero">
          <p className="eyebrow">SOFT TENNIS IQ</p>
          <h1>
            動画で見た戦術を、
            <br />
            コートの外でも。
          </h1>
        </section>

        <ul className="tool-list">
          {tools.map((tool) => {
            const legacy = tool.status === 'legacy'
            return (
              <li key={tool.id}>
                <a
                  className="tool-card"
                  href={legacy ? tool.legacyUrl : href(tool.id)}
                  {...(legacy ? { target: '_blank', rel: 'noopener' } : {})}
                >
                  <ToolVisual id={tool.id} />
                  <div className="tool-text">
                    <h2>{tool.name}</h2>
                    <p>{tool.lead}</p>
                    {legacy && <span className="tool-note">新デザインは準備中。今は現行版が開きます</span>}
                  </div>
                  {legacy ? <ArrowUpRight size={20} aria-label="別のページで開く" /> : <ChevronRight size={22} aria-hidden="true" />}
                </a>
              </li>
            )
          })}
        </ul>

        <Support />

        <footer className="home-foot">
          <p>
            戦術ショート動画は Instagram・Threads・YouTube の{' '}
            <a href="https://www.instagram.com/softtennis_iq/" target="_blank" rel="noopener">
              @softtennis_iq
            </a>{' '}
            で配信しています。
          </p>
          <p>記録はこの端末のブラウザにだけ保存され、外部には送られません。</p>
          <p className="num">© omicreate</p>
        </footer>
      </main>
    </div>
  )
}
