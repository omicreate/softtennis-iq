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

/** はじめて開いたときだけ、計測していることを一行で知らせる。閉じるか、説明を開いたら次からは出さない */
export function PrivacyNotice({ hidden }: { hidden?: boolean }) {
  const [open, setOpen] = useState(() => !seen())
  if (!open || hidden) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // 保存できなくても閉じる
    }
    setOpen(false)
  }
  return (
    <aside className="privacy-notice" aria-label="計測のお知らせ">
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
