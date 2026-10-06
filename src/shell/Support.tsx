import { Heart, Share2 } from 'lucide-react'
import { useState } from 'react'
import './support.css'

export const NOTE_URL = 'https://note.com/softtennis_iq'

/** 共有するリンク：アプリのトップに、共有から来たことが分かる印を付ける */
export function shareUrl() {
  return `${location.origin}${location.pathname}?src=share`
}

/**
 * 応援の入口。いちばんの応援は「仲間に教えてもらうこと」なので共有を先に、
 * お金での応援（note のチップ）は大人向けに控えめに置く。
 */
export function Support({ compact = false }: { compact?: boolean }) {
  const [msg, setMsg] = useState('')

  async function share() {
    const url = shareUrl()
    const text = 'ソフトテニスのルールと戦術を、スマホで練習できる無料アプリ'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ソフトテニスIQ', text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setMsg('リンクをコピーしました')
    } catch (e) {
      // 共有画面を閉じただけのときは何も出さない
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMsg(url)
    }
  }

  return (
    <section className={compact ? 'support compact' : 'support'} aria-labelledby="support-title">
      <h2 id="support-title">
        <Heart size={16} aria-hidden="true" />
        ソフトテニスIQを応援する
      </h2>
      {!compact && (
        <p>
          このアプリは無料で作り続けています。役に立ったら、チームの仲間や顧問の先生に教えてもらえるのが、いちばんの応援です。
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-block" onClick={share}>
        <Share2 size={18} aria-hidden="true" />
        チームに教える
      </button>
      {msg && (
        <p className="support-msg" role="status">
          {msg}
        </p>
      )}
      <p className="support-adult">
        大人の方へ：
        <a href={NOTE_URL} target="_blank" rel="noopener">
          note のチップ
        </a>
        で開発を応援できます。
      </p>
    </section>
  )
}
