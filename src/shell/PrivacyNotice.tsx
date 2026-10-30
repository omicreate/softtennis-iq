import { X } from 'lucide-react'
import { useState } from 'react'
import { href } from './route'
import './privacy.css'

const KEY = 'stiq-privacy-seen'

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * はじめて開いたときだけ、計測していることを一行で知らせる。閉じるか、説明を開いたら次からは出さない。
 * inline は画面の中に置く形（下のタブがない画面用。浮かせるとボタンに重なるため）
 */
export function PrivacyNotice({ hidden, inline }: { hidden?: boolean; inline?: boolean }) {
  const [open, setOpen] = useState(() => !seen())
  // 別の場所で閉じた後にも出ないよう、毎回保存を確かめる
  if (!open || hidden || seen()) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // 保存できなくても閉じる
    }
    setOpen(false)
  }
  return (
    <aside className={`privacy-notice${inline ? ' is-inline' : ''}`} aria-label="計測のお知らせ">
      <p>
        このアプリは、リンクから開いた回数と、診断を使った回数だけを数えています。
        <a href={href('privacy')} onClick={close}>
          詳しく・送らない
        </a>
      </p>
      <button type="button" className="icon-btn" aria-label="お知らせを閉じる" onClick={close}>
        <X size={20} />
      </button>
    </aside>
  )
}
