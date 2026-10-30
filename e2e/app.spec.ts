import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** ページが横にはみ出していない（スマホで横スクロールが出ない） */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  // はじめての計測のお知らせは、専用のテスト以外では閉じた状態にしておく（ほかの操作の邪魔をしないように）
  await page.addInitScript(() => {
    if (!location.hash.includes('notice-test')) localStorage.setItem('stiq-privacy-seen', '1')
  })
  // 本番と同じ作り（vite preview）なので、テストの操作が本番の回数に入らないよう、受け口への送信は止める
  await page.route('https://script.google.com/**', (route) => route.abort())
  // 書体は同梱。Google Fonts を読みに行っていないことも確かめる
  page.on('request', (req) => {
    expect(req.url()).not.toContain('fonts.googleapis.com')
  })
})

test('ホーム：5つの道具がアプリ内で開け、共有用の画像が設定されている', async ({ page }) => {
  await page.goto('./')
  const cards = page.locator('.tool-list .tool-card')
  await expect(cards).toHaveCount(5)
  await expect(cards.nth(0)).toHaveAttribute('href', '#/type')
  await expect(cards.nth(1)).toHaveAttribute('href', '#/quiz')
  await expect(cards.nth(2)).toHaveAttribute('href', '#/drill')
  await expect(cards.nth(3)).toHaveAttribute('href', '#/jinkei')
  await expect(cards.nth(4)).toHaveAttribute('href', '#/note')
  // 姉妹アプリ（ミニゲーム集）は別のアプリとして開き、どこから来たかの印を付ける
  const sister = page.locator('.sister-card')
  await expect(sister).toHaveAttribute('href', 'https://omicreate.github.io/softtennis-asobi/?src=st_iq_cross')
  await expect(sister).toHaveAttribute('target', '_blank')
  await expect(sister.locator('img')).toHaveJSProperty('complete', true)
  expect(await sister.locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
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
  await page.locator('.tool-card[href="#/jinkei"]').click()
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

test('試合ノート：スタート画面、はじめての案内、記録、取り消し、分析、サマリー画像', async ({ page }) => {
  await page.goto('./#/note')
  await expect(page.locator('.note-start')).toBeVisible()
  await expect(page.locator('.scoreboard')).toHaveCount(0)
  await expectNoHorizontalScroll(page)
  await page.getByRole('button', { name: '試合を始める' }).click()
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
  await expect(page.locator('.rec-match').getByRole('link', { name: '新しい試合' })).toHaveAttribute('href', '#/note/new')

  await page.getByRole('link', { name: '分析' }).click()
  await expect(page.locator('.metric').nth(1)).toContainText('1本')
  await page.getByRole('link', { name: 'サマリー画像を作る' }).click()
  await expect(page.locator('.summary-frame img')).toHaveAttribute('src', /^data:image\/png/)

  await page.reload()
  await page.goto('./#/note')
  await expect(page.locator('.guide')).toHaveCount(0)
  await expect(page.locator('.note-start')).toHaveCount(0)
})

test('試合ノート：サンプルは見るだけで、記録タブではスタート画面に戻る', async ({ page }) => {
  await page.goto('./#/note')
  await page.getByRole('button', { name: '記録済みのサンプルで、分析の見え方を試す' }).click()
  await expect(page).toHaveURL(/#\/note\/analysis$/)
  await page.getByRole('link', { name: '記録' }).click()
  await expect(page.locator('.start-sample')).toBeVisible()
  await expect(page.locator('.big-win')).toHaveCount(0)
  await page.getByRole('button', { name: '試合を始める' }).click()
  await expect(page.locator('.sb-A .sb-name')).toContainText('自チーム')
  await expect(page.locator('.sb-A .sb-points')).toHaveText('0')
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

test('応援：ホームとドリルの結果に応援欄があり、お金の応援への導線は無い', async ({ page }) => {
  await page.goto('./')
  const support = page.locator('.support')
  await expect(support).toBeVisible()
  await expect(support.getByRole('link')).toHaveCount(0)
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

test('局面クイズ：今日の1問を解くと正解の動きと理由が出て、記録と過去の問題に残る', async ({ page }) => {
  await page.goto('./#/quiz')
  await expect(page.locator('.quiz-court')).toBeVisible()
  await page.locator('.choice').first().click()
  await expect(page.locator('.feedback')).toBeVisible()
  await expect(page.getByRole('button', { name: '結果を友達に送る' })).toBeVisible()
  await expect(page.locator('.quiz-streak')).toContainText('1日連続')
  await expectNoHorizontalScroll(page)
  await page.getByRole('link', { name: '記録' }).click()
  await expect(page.locator('.stat-row b').first()).toHaveText('1')
  await page.getByRole('link', { name: '過去の問題' }).click()
  await expect(page.locator('.quiz-mark')).toHaveCount(1)
  await page.locator('.quiz-item').last().click()
  await expect(page.locator('.prompt')).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('プライバシーと計測：ホームから開け、「送らない」を選ぶと残る', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'プライバシーと計測' }).click()
  await expect(page.getByRole('heading', { name: 'このアプリが数えること' })).toBeVisible()
  await page.getByRole('radio', { name: '送らない' }).click()
  await expect(page.getByRole('radio', { name: '送らない' })).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(page.getByRole('radio', { name: '送らない' })).toHaveAttribute('aria-checked', 'true')
  await expectNoHorizontalScroll(page)
})

test('計測のお知らせ：はじめてだけ出て、閉じると次から出ない', async ({ page }) => {
  await page.goto('./#notice-test')
  const notice = page.getByRole('complementary', { name: '計測のお知らせ' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: '詳しく・送らない' })).toHaveAttribute('href', '#/privacy')
  await expectNoHorizontalScroll(page)
  await notice.getByRole('button', { name: 'お知らせを閉じる' }).click()
  await expect(notice).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('complementary', { name: '計測のお知らせ' })).toHaveCount(0)
})

test('タイプ診断：12問に答えると結果が出て、相性のペアと共有リンクから開ける', async ({ page }) => {
  await page.goto('./#/type')
  await page.getByRole('button', { name: '診断をはじめる' }).click()
  for (let i = 0; i < 12; i++) {
    await expect(page.locator('.eyebrow.num')).toHaveText(`Q${i + 1} / 12`)
    await page.locator('.choices .choice').nth(i % 4).click()
  }
  await expect(page.locator('.type-name')).toBeVisible()
  await expect(page.locator('.type-bar')).toHaveCount(6)
  await expectNoHorizontalScroll(page)
  // 前回の結果として残る
  const last = await page.evaluate(() => localStorage.getItem('stiq-type-v1'))
  expect(last).toMatch(/^[a-z]+-[a-z]+$/)
  // 相性のいいペアのタイプ紹介へ
  await page.locator('.type-match').first().click()
  await expect(page).toHaveURL(/#\/type\/t\/[a-z]+-[a-z]+$/)
  await expect(page.locator('.type-name')).toBeVisible()
  // 共有リンク（?src= 付き）でタイプ紹介が開く
  await page.goto('./?src=type_share#/type/t/yomi-mae')
  await expect(page.locator('.type-name')).toHaveText('ポーチの狩人')
  await expect(page.getByRole('link', { name: '自分のタイプを診断する' })).toBeVisible()
  // 知らないタイプは診断のはじめに戻る
  await page.goto('./#/type/t/xxx')
  await expect(page.getByRole('button', { name: '診断をはじめる' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('タイプ診断：計測のお知らせは画面の中に出て、ボタンに重ならない', async ({ page }) => {
  // このテストだけ、はじめての人と同じ（お知らせが出る）状態にする
  // （beforeEach が開くたびに「見た」印を付けるので、そのあとで消す）
  await page.addInitScript(() => localStorage.removeItem('stiq-privacy-seen'))
  const overlaps = async (a: string, b: string) => {
    const [x, y] = [await page.locator(a).boundingBox(), await page.locator(b).boundingBox()]
    if (!x || !y) throw new Error('見つからない')
    return x.y < y.y + y.height && y.y < x.y + x.height && x.x < y.x + y.width && y.x < x.x + x.width
  }
  // 共有リンクから来た人の入口
  await page.goto('./?src=type_share#/type/t/yomi-mae')
  const notice = page.getByRole('complementary', { name: '計測のお知らせ' })
  await expect(notice).toBeVisible()
  await expect(notice).toHaveCSS('position', 'static')
  expect(await overlaps('.privacy-notice', 'a.btn-accent')).toBe(false)
  // 結果画面
  await page.goto('./#/type')
  await page.getByRole('button', { name: '診断をはじめる' }).click()
  for (let i = 0; i < 12; i++) await page.locator('.choices .choice').nth(i % 4).click()
  await expect(page.locator('.type-name')).toBeVisible()
  await expect(notice).toHaveCSS('position', 'static')
  for (const sel of ['.type-share .btn', '.type-result .btn-quiet']) expect(await overlaps('.privacy-notice', sel)).toBe(false)
  await expectNoHorizontalScroll(page)
  // 閉じたら消え、「見た」印が残る（ほかの画面でも出なくなる）
  await notice.getByRole('button', { name: 'お知らせを閉じる' }).click()
  await expect(notice).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('stiq-privacy-seen'))).toBe('1')
})

test('タイプ診断：「はじめた」は、やり直しも含めて毎回数える（送るのは app・ev・v だけ）', async ({ page }) => {
  const sent: string[] = []
  await page.route('https://script.google.com/**', (route) => {
    sent.push(route.request().url())
    return route.abort()
  })
  await page.goto('./#/type')
  for (let round = 0; round < 2; round++) {
    if (round === 0) await page.getByRole('button', { name: '診断をはじめる' }).click()
    else await page.getByRole('button', { name: 'もう一度診断する' }).click()
    for (let i = 0; i < 12; i++) await page.locator('.choices .choice').nth(i % 4).click()
    await expect(page.locator('.type-name')).toBeVisible()
  }
  await expect.poll(() => sent.filter((u) => u.includes('ev=finish')).length).toBe(2)
  const starts = sent.filter((u) => u.includes('ev=start'))
  expect(starts).toHaveLength(2)
  expect(sent.filter((u) => u.includes('ev=open'))).toHaveLength(1)
  for (const u of starts) expect([...new URL(u).searchParams.keys()].sort()).toEqual(['app', 'ev', 'v'])
})
