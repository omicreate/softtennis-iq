// 流入計測：?src= が付いているときだけ、面の識別子とアプリ名を1回送る（学習記録や入力内容は送らない。DNT・GPC がオン、または「送らない」を選んだら送らない）
// 旧3アプリと同じ集計先・同じアプリ名で送り、数値シートの集計をそのまま続ける。
import { parseRoute } from './route'
import { toolById } from './tools'
import { isTrackingOff } from './trackSetting'

/** アプリの版（集計で、直した前後を見分ける） */
export const APP_VERSION = '0.1.0'

const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbxdPOPn6aUE3yhlCWt_qadU6POkEkxYXN3qxLsdcel-FWJFa_Fmu4NjL7P_jcrLew4/exec'

export function trackSourceOnce() {
  try {
    const src = new URLSearchParams(location.search).get('src')
    // 印は英数字・ハイフン・下線だけ（40文字まで）。それ以外は送らない（集計シートへの数式の混入などを防ぐ）
    if (!src || !/^[A-Za-z0-9_-]{1,40}$/.test(src)) return
    // ブラウザの「追跡しない」（DNT・GPC）がオンなら送らない
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return
    // 「プライバシーと計測」で「送らない」を選んだ端末からは送らない
    if (isTrackingOff()) return
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

/** 機能の中で数えるできごと：開いた・最後までやった・共有した（中身や結果は送らない） */
export type CountEvent = 'open' | 'finish' | 'share'

/**
 * 機能の使われ方を、回数だけ送る（例：タイプ診断を開いた・12問答え終えた・結果を共有した）。
 * 送るのは機能の名前・できごとの種類・アプリの版だけ。答え・結果のタイプ・リンクの印は送らない。
 * 開いたは同じタブで1回だけ。DNT・GPC がオン、「送らない」を選んだ、開発中のときは送らない。
 */
export function countEvent(app: string, ev: CountEvent) {
  try {
    if (import.meta.env.DEV) return
    if (!/^[a-z0-9-]{1,40}$/.test(app)) return
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return
    if (isTrackingOff()) return
    if (ev === 'open') {
      const key = `ev_sent:${app}:open`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    }
    const url = `${ENDPOINT}?app=${encodeURIComponent(app)}&ev=${ev}&v=${APP_VERSION}`
    if (navigator.sendBeacon?.(url)) return
    void fetch(url, { mode: 'no-cors', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => {})
  } catch {
    // 計測が失敗してもアプリ本体は止めない
  }
}
