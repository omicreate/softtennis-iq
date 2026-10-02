import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// 書体はアプリに同梱する（電波のない会場でも同じ見た目にするため。Google Fonts には頼らない）
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import '@fontsource/noto-sans-jp/900.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/800.css'
import './design/base.css'
import { trackSourceOnce } from './shell/track'

trackSourceOnce()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: 本番ビルドのみ Service Worker を登録（開発時はキャッシュが邪魔になるため除外）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
