// 試合ノートのエンジンが旧アプリと同じ結果を出すことを確かめる
// （旧 soft-tennis-note/tests/fixture-analysis-regression.test.js を移植。実運用の試合を匿名化したCSVを使う）
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

type Engine = typeof import('./engine/engine.js')
let E: Engine

// ブラウザの localStorage・canvas を最小限で用意する
const store = new Map<string, string>()
function fakeCanvas() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '800 28px sans-serif',
    fillRect() {},
    fillText() {},
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(this.font)?.[1] || 28)
      return { width: String(text).length * size * 0.58 }
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
  }
  return { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,TEST' }
}

beforeAll(async () => {
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    document: { createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas() : { click() {} }) },
  })
  E = await import('./engine/engine.js')
})

const dir = join(__dirname, 'fixtures')

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  const headers = rows.shift()!.map((h) => h.replace(/^﻿/, ''))
  return rows.filter((l) => l.some(Boolean)).map((l) => Object.fromEntries(headers.map((h, i) => [h, l[i] ?? ''])))
}
const score = (v: string) => {
  const [a, b] = String(v || '0-0').split('-').map((x) => Number(x) || 0)
  return { A: a, B: b }
}
const side = (v: string) => (v === '自チーム' ? 'A' : 'B')
const playerKey = (v: string) =>
  ({ 自チーム選手1: 'A後衛', 自チーム選手2: 'A前衛', 相手チーム選手1: 'B後衛', 相手チーム選手2: 'B前衛' })[v] || '不明'

function rowsToPoints(rows: Record<string, string>[]) {
  return rows.map((row) => ({
    winner: side(row['得点側']),
    server: side(row['サービスサイド']),
    course: row['コース'],
    outcome: row['ポイント内容'],
    result: row['ボールの結果'],
    serveStart: row['サービスの入り方'],
    serverPlayer: playerKey(row['サーブ選手'] || '不明'),
    receiverPlayer: playerKey(row['レシーブ選手'] || '不明'),
    hand: row['打球面'],
    player: playerKey(row['誰のプレー']),
    shot: row['ショット'],
    rally: row['ラリー数'] || '0',
    phase: row['場面'],
    gameNumber: score(row['ゲーム']).A + score(row['ゲーム']).B + 1,
    gameWonBy: row['ゲーム取得'] ? side(row['ゲーム取得']) : undefined,
    scoreBefore: { games: score(row['ゲーム']), points: score(row['ポイント']) },
    scoreAfter: { games: score(row['ゲーム']), points: score(row['ポイント']) },
    at: row['記録時刻'],
  }))
}

function fixtureState(points: unknown[], games: { A: number; B: number }, extra: Record<string, unknown> = {}) {
  const base = structuredClone(E.defaultState)
  return {
    ...base,
    matchType: 'doubles',
    matchFormat: '7',
    gamesToWin: 4,
    teams: { A: '自チーム', B: '相手ペア' },
    players: { ARear: '自チーム選手1', AFront: '自チーム選手2', BRear: '相手チーム選手1', BFront: '相手チーム選手2' },
    points,
    games,
    gamePoints: { A: 0, B: 0 },
    finished: true,
    ...extra,
  }
}

describe('旧アプリとの一致（匿名化した実際の試合）', () => {
  it('7ゲームマッチの分析値・サマリーが期待値どおり', () => {
    const expected = JSON.parse(readFileSync(join(dir, 'practice-match-7game-expected.json'), 'utf8'))
    const points = rowsToPoints(parseCsv(readFileSync(join(dir, 'practice-match-7game-anonymized.csv'), 'utf8')))
    E.setState(
      fixtureState(points, { A: expected.summary.ownGamesWon, B: expected.summary.opponentGamesWon }, {
        matchInfo: {
          ...E.defaultState.matchInfo,
          date: expected.match.date,
          opponentFormation: expected.match.formation,
          tournament: expected.match.tournament,
          venueName: expected.match.venue,
          venue: expected.match.court,
        },
      }),
    )
    const data = JSON.parse(JSON.stringify(E.getAnalysisData()))
    const ex = expected.appAnalysis
    for (const key of ['total', 'ownPoints', 'ownLost', 'pointDiff', 'pointRate', 'ownScoredByPattern', 'ownPointsByOpponentError', 'ownLostByOwnError', 'firstServeRate', 'secondServeStarts', 'ownDoubleFaults', 'ownReceiveMisses', 'ownEarlyLost']) {
      expect(data[key], key).toEqual(ex[key])
    }
    expect(data.topScore).toEqual(ex.topScore)
    expect(data.topError).toEqual(ex.topError)
    expect(data.topPlayer).toEqual(ex.topPlayer)

    const summary = JSON.parse(JSON.stringify(E.getSummaryImageData()))
    expect(summary.pointBreakdownRows).toEqual(ex.pointBreakdownRows)
    expect(summary.playerPlusMinusRows).toEqual(ex.playerPlusMinusRows)
    expect(summary.gameScore).toBe(expected.summary.finalGameScore)
    expect(summary.playerServeReceiveStats).toHaveLength(4)
    expect(summary.flowRows.find(([l]: [string]) => l === '1ポイント目取得率')[1]).toBe(expected.flow.ownOpeningPointRate)

    const share = E.drawSummaryImage(fakeCanvas(), E.getSummaryImageData(), 'share')
    const detail = E.drawSummaryImage(fakeCanvas(), E.getSummaryImageData(), 'detail')
    expect(share.pageCount).toBe(1)
    expect(detail.pageCount).toBe(1)
    expect(detail.contentBottom).toBeLessThan(detail.footerTop)
  })

  it('ほかの試合（途中・1点・延長）でも点数と連続得点が一致する', () => {
    const corpus = JSON.parse(readFileSync(join(dir, 'practice-match-corpus-expected.json'), 'utf8'))
    for (const fixture of corpus.fixtures) {
      const points = rowsToPoints(parseCsv(readFileSync(join(dir, fixture.file), 'utf8')))
      const games = { A: fixture.summary.ownGamesWon, B: fixture.summary.opponentGamesWon }
      E.setState(
        fixtureState(points, games, {
          matchType: fixture.match.type === 'シングルス' ? 'singles' : 'doubles',
          finished: games.A >= 4 || games.B >= 4,
        }),
      )
      const data = E.getAnalysisData()
      const summary = E.getSummaryImageData()
      expect(data.total, fixture.name).toBe(fixture.rowCount)
      expect(data.ownPoints, fixture.name).toBe(fixture.summary.ownPoints)
      expect(data.ownLost, fixture.name).toBe(fixture.summary.opponentPoints)
      expect(summary.gameScore, fixture.name).toBe(fixture.summary.gameScore)
      expect(summary.flowRows.find(([l]: [string]) => l === '最長連続得点')[1]).toBe(fixture.flow.longestOwnStreak?.count || 0)
      expect(summary.flowRows.find(([l]: [string]) => l === '最長連続失点')[1]).toBe(fixture.flow.longestOpponentStreak?.count || 0)
      expect(summary.playerPlusMinusRows).toHaveLength(fixture.match.type === 'シングルス' ? 2 : 4)
    }
  })
})

describe('記録の流れ', () => {
  const fresh = (format = '7') => {
    E.setState(structuredClone(E.defaultState))
    E.startNewMatch({ ...E.matchFormDefaults('new'), matchFormat: format, server: 'A' })
  }

  it('誰のプレー×ショット×得点側から、旧アプリと同じポイント内容になる', () => {
    expect(E.outcomeFor('A', 'A後衛', 'ストローク', '第1サービスで開始')).toBe('ストローク得点')
    expect(E.outcomeFor('A', 'B前衛', 'ボレー', '第1サービスで開始')).toBe('ボレーミス')
    expect(E.outcomeFor('B', 'A後衛', 'レシーブ', '第1サービスで開始')).toBe('レシーブミス')
    expect(E.outcomeFor('B', 'B後衛', 'サービス', '第1サービスで開始')).toBe('サービス得点')
    expect(E.outcomeFor('B', 'A後衛', 'サービス', '第2サービスで開始')).toBe('ダブルフォールト')
    expect(E.outcomeFor('B', '不明', 'ストローク', 'ダブルフォールト')).toBe('ダブルフォールト')
    expect(E.outcomeFor('A', '不明', '不明', '第1サービスで開始')).toBe('不明')
  })

  it('4ポイントでゲーム、サービスは1ゲームごとに交代する', () => {
    fresh()
    for (let i = 0; i < 4; i += 1) E.recordPoint('A')
    const s = E.getState()
    expect(s.games).toEqual({ A: 1, B: 0 })
    expect(s.server).toBe('B')
    expect(s.points[3].gameWonBy).toBe('A')
  })

  it('ファイナルゲームは7ポイント先取、2ポイントごとにサービス交代（競技規則 第20条・第34条）', () => {
    fresh('final')
    const s = () => E.getState()
    expect(E.isFinalGame()).toBe(true)
    E.recordPoint('A')
    expect(s().server).toBe('A')
    E.recordPoint('B')
    expect(s().server).toBe('B')
    for (let i = 0; i < 4; i += 1) E.recordPoint(i % 2 ? 'B' : 'A')
    for (let i = 0; i < 6; i += 1) E.recordPoint(i % 2 ? 'B' : 'A')
    expect(s().gamePoints).toEqual({ A: 6, B: 6 })
    E.recordPoint('A')
    expect(s().finished).toBe(false)
    E.recordPoint('A')
    expect(s().finished).toBe(true)
  })

  it('取り消すと点数とサーバーが戻る', () => {
    fresh()
    E.recordPoint('A')
    E.recordPoint('B')
    E.undoPoint()
    const s = E.getState()
    expect(s.points).toHaveLength(1)
    expect(s.gamePoints).toEqual({ A: 1, B: 0 })
  })

  it('ダブルフォールトを選ぶとサーバーの失点として残る', () => {
    fresh()
    E.updateSelection({ selectedServe: 'ダブルフォールト' })
    const p = E.recordPoint('B')!
    expect(p.outcome).toBe('ダブルフォールト')
    expect(p.player).toBe('A後衛')
    expect(E.getAnalysisData().ownDoubleFaults).toBe(1)
  })

  it('新しい試合を始めると、前の試合は保存済み試合に残る', () => {
    fresh()
    E.recordPoint('A')
    const before = E.loadArchivedMatches().length
    E.startNewMatch(E.matchFormDefaults('new'))
    expect(E.loadArchivedMatches().length).toBeGreaterThanOrEqual(before)
    expect(E.getState().points).toHaveLength(0)
  })

  it('バックアップを書き出して読み込むと、同じ試合に戻る', () => {
    fresh()
    E.recordPoint('A')
    E.recordPoint('A')
    const payload = JSON.stringify(E.createBackupPayload())
    E.startNewMatch(E.matchFormDefaults('new'))
    E.importBackupText(payload)
    expect(E.getState().points).toHaveLength(2)
  })

  it('旧アプリの古い書き方（相手ミス・ダブルフォルト等）も読み替える', () => {
    const s = E.setState({ ...structuredClone(E.defaultState), points: [{ winner: 'A', outcome: 'ダブルフォルト', scoreBefore: { games: { A: 0, B: 0 }, points: { A: 0, B: 0 } } }] })
    expect(s.points[0].outcome).toBe('ダブルフォールト')
  })
})
