// engine.js（旧アプリから移植したJS）の型。画面から使う範囲だけをゆるく定義する
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Side = 'A' | 'B'
export type Score = { A: number; B: number }

export interface NotePoint {
  id: string
  at: string
  winner: Side
  server: Side
  course: string
  outcome: string
  result: string
  serveStart: string
  serverPlayer: string
  receiverPlayer: string
  hand: string
  player: string
  shot: string
  rally: string
  memo: string
  phase: string
  gameNumber: number
  gameWonBy?: Side
  scoreBefore: { games: Score; points: Score }
  scoreAfter?: { games: Score; points: Score }
}

export interface NoteState {
  archiveId: string
  isPracticeMatch: boolean
  matchType: 'doubles' | 'singles'
  teams: { A: string; B: string }
  players: { AFront: string; ARear: string; BFront: string; BRear: string }
  gamesToWin: number
  matchFormat: string
  matchInfo: Record<string, string>
  server: Side
  selectedServe: string
  selectedServerPlayer: string
  selectedReceiverPlayer: string
  selectedPlayer: string
  selectedShot: string
  selectedMemo: string
  selectedRallyLength: string
  selectedRallyLengthManual?: string
  analysisMemos: any[]
  points: NotePoint[]
  gamePoints: Score
  games: Score
  finished: boolean
  [key: string]: any
}

export interface ArchiveEntry {
  id: string
  createdAt?: string
  savedAt: string
  title: string
  pointCount: number
  games: Score
  finished: boolean
  state: NoteState
}

export type MatchForm = Record<string, string>

export const APP_VERSION: string
export const SCORING_OUTCOMES: string[]
export const ERROR_OUTCOMES: string[]
export const defaultState: NoteState

export function getState(): NoteState
export function setState(next: any): NoteState
export function reloadState(): NoteState
export function updateSelection(patch: Partial<NoteState>): void
export function setServicePlayers(patch: Partial<NoteState>): void
export function outcomeFor(winner: Side, player: string, shot: string, serveStart: string): string
export function recordPoint(winner: Side): NotePoint | undefined
export function undoPoint(): NotePoint | undefined
export function saveAnalysisMemo(): any
export function matchFormDefaults(mode?: 'new' | 'edit'): MatchForm
export function startNewMatch(form: MatchForm): void
export function saveMatchInfo(form: MatchForm): void
export function loadSampleMatch(): void
export function editPoint(index: number, patch: Record<string, string>): void
export function filterHistoryPoints(points: NotePoint[], filter?: string): NotePoint[]
export function openArchivedMatch(id: string): boolean
export function removeArchivedMatch(id: string): void
export function importBackupText(text: string): any
export function summaryImageDataUrl(matchState?: NoteState | null, mode?: 'share' | 'detail', nameMode?: string): string
export function summaryFileName(mode?: string): string

export function normalizeState(raw: any): NoteState
export function normalizePlayerKey(player: string): string
export function sideFromPlayerKey(player: string): Side | ''
export function serviceSidePlayerKeys(side: Side): string[]
export function displayName(side: Side): string
export function shortDisplayName(side: Side): string
export function ownDefaultName(): string
export function opponentDefaultName(): string
export function playerLabel(player: string): string
export function pointLabel(side: Side): string
export function matchFormatLabel(): string
export function isFinalGame(): boolean
export function getMatchPointTeams(): Side[]
export function getCompactMatchStatus(): string
export function getWinnerTeam(): Side | ''
export function getRuleNoteText(): string
export function getMatchTimeRange(info?: Record<string, string>): string
export function getAnalysisData(): any
export function getGameOpeningStats(): any
export function buildSummaryComments(data?: any): string[]
export function buildPriorityAdviceItems(data?: any): string[]
export function buildActionPlanRows(data?: any, opts?: { limit?: number }): [string, string, string][]
export function getSideInsightItems(): { ownItems: string[]; opponentItems: string[] }
export function getScoringSituationCounts(): Record<string, number>
export function getLosingSituationCounts(): Record<string, number>
export function countByOutcomeType(type: 'score' | 'error', points?: NotePoint[]): Record<string, number>
export function getRallyLengthStats(points?: NotePoint[]): { short: number; long: number; unknown: number; recorded: number }
export function getMomentumRows(): [string, string, string, string, string][]
export function getPlayerPlusMinus(): any[]
export function getPlayerServeReceiveStats(): any[]
export function buildPlayerReviewItems(item: any): string[]
export function formatContributionDiff(diff: number): string
export function formatPointDiff(diff: number): string
export function formatRate(rate: number | null): string
export function isScoringOutcome(outcome: string): boolean
export function isErrorOutcome(outcome: string): boolean
export function historyGameNumber(point: NotePoint): number
export function historyGameLabel(gameNumber: number): string
export function historyPhaseLabel(point: NotePoint): string
export function getPointEditPlayerOptions(): [string, string][]
export function getSummaryImageData(): any
export function drawSummaryImage(canvas: any, summary: any, mode?: string, nameMode?: string): any
export function buildPointCsvRows(matchState?: NoteState, opts?: any): string[][]
export function buildArchivedCsvRows(archived?: ArchiveEntry[]): string[][]
export function exportCsv(): void
export function exportArchivedCsv(): boolean
export function exportBackupJson(): void
export function createBackupPayload(): any
export function restoreBackupPayload(payload: any): any
export function loadArchivedMatches(): ArchiveEntry[]
export function findArchivedMatch(id: string): ArchiveEntry | undefined
export function filterArchivedMatches(archived: ArchiveEntry[], filters?: any): ArchiveEntry[]
export function sortArchivedMatches(archived: ArchiveEntry[], sort?: string): ArchiveEntry[]
export function getArchiveTournamentName(entry: ArchiveEntry): string
export function getAppStorageUsage(): { archivedCount: number; currentBytes: number; archiveBytes: number; totalBytes: number }
export function formatStorageSize(bytes: number): string
export function matchHasRecordableData(state?: NoteState): boolean
export function createPracticeMatchState(): NoteState
export function rallyLengthModeForOutcome(outcome: string): string
export function rallyBucket(rally: string): string
