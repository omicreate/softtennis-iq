import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** ページが横にはみ出していない（スマホで横スクロールが出ない） */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  // 書体は同梱。Google Fonts を読みに行っていないことも確かめる
  page.on('request', (req) => {
    expect(req.url()).not.toContain('fonts.googleapis.com')
  })
})

test('ホーム：3つの道具がアプリ内で開け、共有用の画像が設定されている', async ({ page }) => {
  await page.goto('./')
  const cards = page.locator('.tool-card')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toHaveAttribute('href', '#/drill')
  await expect(cards.nth(1)).toHaveAttribute('href', '#/jinkei')
  await expect(cards.nth(2)).toHaveAttribute('href', '#/note')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /ogp\.png$/)
  const ogp = await page.request.get('ogp.png')
  expect(ogp.ok()).toBe(true)
  await expectNoHorizontalScroll(page)
})

test('ルールドリル：10問を解くと結果と振り返りが出る', async ({ page }) => {
  await page.goto('./#/drill')
  for (let i = 0; i < 10; i += 1) {
    await page.locator('.choice').first().click()
    await expect(page.locator('.feedback-ref')).toContainText('ルールブック：')
    await page.locator('.play-foot .btn').click()
  }
  await expect(page.locator('.result-score')).toContainText('/ 10')
  await expectNoHorizontalScroll(page)
  await page.getByRole('link', { name: '記録' }).click()
  await expect(page.locator('.stat-row b').first()).toHaveText('10')
})

test('陣形ラボ：選手を足すと穴が増え、ホームに戻っても配置が残る', async ({ page }) => {
  await page.goto('./#/jinkei')
  await expect(page.locator('.hole')).toHaveCount(1)
  const marker = page.locator('[aria-label="B前衛を選択または移動"]')
  const box = (await marker.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.hole')).toHaveCount(2)
  await expectNoHorizontalScroll(page)

  await page.getByRole('link', { name: 'ホームへ戻る' }).click()
  await page.locator('.tool-card').nth(1).click()
  await expect(page.locator('.hole')).toHaveCount(2)

  await page.goto('./#/jinkei/setup')
  await page.getByRole('button', { name: '逆クロス' }).click()
  await page.getByRole('link', { name: 'コート' }).first().click()
  await expect(page.locator('.pill')).toContainText('逆クロス')
})

test('陣形ラボ：共有リンクで同じ配置が開く', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./#/jinkei')
  await page.getByRole('button', { name: '配置のリンクをコピー' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('layout=')
  expect(link).toContain('#/jinkei')
  const other = await context.newPage()
  await other.goto(link)
  await expect(other.locator('.hole')).toHaveCount(1)
})

test('試合ノート：はじめての案内、記録、取り消し、分析、サマリー画像', async ({ page }) => {
  await page.goto('./#/note')
  await expect(page.locator('.guide')).toBeVisible()
  await page.getByRole('button', { name: 'わかった' }).click()
  await expect(page.locator('.guide')).toHaveCount(0)

  await page.locator('.chip-player').first().click()
  await page.getByRole('button', { name: 'ボレー', exact: true }).click()
  await expect(page.locator('.big-win small')).toHaveText('ボレー得点')
  await page.locator('.big-win').click()
  await expect(page.locator('.sb-A .sb-points')).toHaveText('1')
  await page.locator('.big-lose').click()
  await expect(page.locator('.sb-B .sb-points')).toHaveText('1')
  await page.getByRole('button', { name: '取り消す' }).click()
  await expect(page.locator('.sb-B .sb-points')).toHaveText('0')
  await expectNoHorizontalScroll(page)

  await page.getByRole('link', { name: '分析' }).click()
  await expect(page.locator('.metric').nth(1)).toContainText('1本')
  await page.getByRole('link', { name: 'サマリー画像を作る' }).click()
  await expect(page.locator('.summary-frame img')).toHaveAttribute('src', /^data:image\/png/)

  await page.reload()
  await page.goto('./#/note')
  await expect(page.locator('.guide')).toHaveCount(0)
})

test('試合ノート：旧アプリで保存した試合をそのまま開ける', async ({ page }) => {
  await page.goto('./')
  const legacy = {
    teams: { A: '旧データ中', B: '相手校' },
    players: { ARear: '一郎', AFront: '二郎', BRear: '三郎', BFront: '四郎' },
    matchType: 'doubles',
    matchFormat: '7',
    server: 'A',
    gamePoints: { A: 1, B: 1 },
    games: { A: 0, B: 0 },
    points: [
      { id: 'p1', winner: 'A', server: 'A', outcome: 'サービス得点', player: 'ARear', serveStart: '第1サービスで開始', rally: '1', scoreBefore: { games: { A: 0, B: 0 }, points: { A: 0, B: 0 } }, scoreAfter: { games: { A: 0, B: 0 }, points: { A: 1, B: 0 } } },
      { id: 'p2', winner: 'B', server: 'A', outcome: 'ダブルフォルト', player: 'ARear', serveStart: 'ダブルフォールト', scoreBefore: { games: { A: 0, B: 0 }, points: { A: 1, B: 0 } }, scoreAfter: { games: { A: 0, B: 0 }, points: { A: 1, B: 1 } } },
    ],
  }
  const archive = [{ id: 'old-1', savedAt: '2026-05-30T09:00:00Z', title: '2026-05-30 / 旧データ中 vs 相手校 / 4-2', pointCount: 30, games: { A: 4, B: 2 }, finished: true, state: { ...legacy, games: { A: 4, B: 2 } } }]
  await page.evaluate(
    ([s, a]) => {
      localStorage.setItem('soft-tennis-logger-state-v1', s)
      localStorage.setItem('soft-tennis-logger-archive-v1', a)
      localStorage.setItem('stiq-note-guide-v1', '1')
    },
    [JSON.stringify(legacy), JSON.stringify(archive)],
  )
  await page.goto('./#/note/history')
  await page.reload()
  await expect(page.locator('.pt-main')).toHaveText(['ダブルフォールト／一郎', 'サービス得点／一郎'])
  await page.goto('./#/note/archive')
  await expect(page.locator('.archive li b')).toHaveText(['2026-05-30 / 旧データ中 vs 相手校 / 4-2'])
})

test('応援：ホームとドリルの結果に応援欄があり、note へのリンクが付いている', async ({ page }) => {
  await page.goto('./')
  const support = page.locator('.support')
  await expect(support).toBeVisible()
  await expect(support.getByRole('link', { name: 'note のチップ' })).toHaveAttribute('href', 'https://note.com/softtennis_iq')
  await expect(support.getByRole('button', { name: 'チームに教える' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.goto('./#/drill')
  for (let i = 0; i < 10; i += 1) {
    await page.locator('.choice').first().click()
    await page.locator('.play-foot .btn').click()
  }
  await expect(page.locator('.support.compact')).toBeVisible()
  await expectNoHorizontalScroll(page)
})
