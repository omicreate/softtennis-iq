// public/icon.svg から PWA 用の PNG アイコンを作る（Playwright の Chromium で描画）
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-maskable-192.png', 192, 0.12],
  ['icon-maskable-512.png', 512, 0.12],
]) {
  await page.setViewportSize({ width: size, height: size })
  // maskable は角丸なしの全面塗り＋安全域の余白
  const body = pad
    ? `<div style="width:${size}px;height:${size}px;background:#0e1a2b;display:grid;place-items:center">
         <div style="width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`
  await page.setContent(`<style>*{margin:0}svg{width:100%;height:100%;display:block}</style>${body}`)
  await page.screenshot({ path: out(name), omitBackground: !pad })
}
await browser.close()
console.log('icons written')
