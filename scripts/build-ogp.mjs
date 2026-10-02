// scripts/ogp.html を 1200×630 の PNG（public/ogp.png）に書き出す
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const html = new URL('./ogp.html', import.meta.url)
const out = fileURLToPath(new URL('../public/ogp.png', import.meta.url))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto(html.href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out })
await browser.close()
console.log('ogp.png written')
