// アプリのアイコンを作る（Playwright の Chromium で描画）：node scripts/build-icons.mjs
// 夜の紺の地に、公式キャラクター「ホークアイ先生」の丸いアイコン（SNS と同じ原画 art/hawk-icon.png）を置き、ふちをボールの黄緑にする。
// 原画は描き直さない（本人の方針）。原画の黒い輪の内側（1000px 角の 70〜930）だけを丸く切り抜いて使う。
//   public/icon-192.png・icon-512.png・apple-touch-icon.png・icon-maskable-*.png、public/icon.svg（タブ用。PNG を埋めこんだ SVG）
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const path = (rel) => new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const art = `data:image/png;base64,${readFileSync(path('art/hawk-icon.png')).toString('base64')}`
const NAVY = '#0e1a2b'
const BALL = '#d8f04a'

/** size 角のアイコンの HTML。maskable は角丸なしの全面塗り（丸く切られても顔が残るよう小さめに置く） */
function html(size, maskable) {
  const d = Math.round(size * (maskable ? 0.7 : 0.8))   // 丸の直径（黄緑のふちを含む）
  const ring = Math.max(2, Math.round(size * 0.028))
  const inner = d - ring * 2
  const k = inner / 860
  return `<style>*{margin:0}</style>
  <div style="width:${size}px;height:${size}px;background:${NAVY};border-radius:${maskable ? 0 : Math.round(size * 0.22)}px;display:grid;place-items:center">
    <div style="width:${d}px;height:${d}px;border-radius:50%;background:${BALL};display:grid;place-items:center">
      <div style="width:${inner}px;height:${inner}px;border-radius:50%;overflow:hidden;background:#fff">
        <img src="${art}" style="display:block;width:${1000 * k}px;height:${1000 * k}px;margin:${-70 * k}px 0 0 ${-70 * k}px">
      </div>
    </div>
  </div>`
}

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true],
]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(html(size, maskable))
  await page.waitForFunction(() => [...document.images].every((i) => i.complete))
  await page.screenshot({ path: path(`public/${name}`), omitBackground: !maskable })
}
// タブのアイコン：256px の PNG を SVG に埋めこむ（SVG は外の画像を読めないため）
await page.setViewportSize({ width: 256, height: 256 })
await page.setContent(html(256, false))
await page.waitForFunction(() => [...document.images].every((i) => i.complete))
const png = (await page.screenshot({ omitBackground: true })).toString('base64')
writeFileSync(path('public/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${png}"/></svg>\n`)
await browser.close()
console.log('icons written')
