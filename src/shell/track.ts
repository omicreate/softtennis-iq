// 流入計測：?src= が付いているときだけ、面の識別子とアプリ名を1回送る（学習記録や入力内容は送らない）
// 旧3アプリと同じ集計先・同じアプリ名で送り、数値シートの集計をそのまま続ける。
import { parseRoute } from './route'
import { toolById } from './tools'

const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbxdPOPn6aUE3yhlCWt_qadU6POkEkxYXN3qxLsdcel-FWJFa_Fmu4NjL7P_jcrLew4/exec'

export function trackSourceOnce() {
  try {
    const src = new URLSearchParams(location.search).get('src')
    if (!src) return
    const app = toolById(parseRoute(location.hash)[0] ?? '')?.trackName ?? 'softtennis-iq'
    const key = `src_sent:${app}:${src}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const url = `${ENDPOINT}?src=${encodeURIComponent(src)}&app=${encodeURIComponent(app)}`
    if (navigator.sendBeacon) navigator.sendBeacon(url)
    else fetch(url, { mode: 'no-cors', keepalive: true })
  } catch {
    // 計測が失敗してもアプリ本体は止めない
  }
}
