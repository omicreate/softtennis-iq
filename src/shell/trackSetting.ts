// 計測の「送らない」設定（この端末のブラウザにだけ保存）
const KEY = 'stiq-track-off'

export function isTrackingOff(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setTrackingOff(off: boolean) {
  try {
    if (off) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // 保存できない環境では、ブラウザの「追跡しない」設定だけが効く
  }
}
