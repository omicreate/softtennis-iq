// @ts-nocheck
// 試合ノートの記録・分析エンジン（旧 soft-tennis-note/app.js から移植）
// 計算・保存・CSV・バックアップ・サマリー画像の処理を、画面から切り離してほぼそのまま移した。
// 画面（React）は state を読み、ファイル末尾の「操作」関数で書き換える。保存キーは旧アプリと同じ。
import { SOFT_TENNIS_CONFIG } from "./config.js";
import { RULES } from "./rules.js";
import { SOFT_TENNIS_ANALYSIS } from "./analysisText.js";
import { SOFT_TENNIS_STORAGE } from "./storage.js";

const {
  APP_VERSION,
  STORAGE_KEY,
  ARCHIVE_STORAGE_KEY,
  MAX_ARCHIVED_MATCHES,
  SCORING_OUTCOMES,
  ERROR_OUTCOMES,
  ANALYSIS_COMMENT_RULES,
  TRIAL_GUIDES,
  defaultState
} = SOFT_TENNIS_CONFIG;

let state = loadState();
let summaryPreviewMode = "share";
let summaryPreviewNameMode = "role";


const POINT_CSV_HEADERS = [
  "No",
  "日付",
  "時間帯",
  "開始時刻",
  "終了時刻",
  "天気",
  "気温",
  "風",
  "風向き",
  "コート種別",
  "コート状態",
  "種別",
  "相手基本布陣",
  "区分",
  "大会名",
  "開催地／会場",
  "コート",
  "試合形式",
  "得点側",
  "サービスサイド",
  "サーブ選手",
  "レシーブ選手",
  "ゲーム",
  "ポイント",
  "場面",
  "サービスの入り方",
  "ポイント内容",
  "ボールの結果",
  "誰のプレー",
  "ショット",
  "打球面",
  "コース",
  "ラリー数",
  "ゲーム取得",
  "メモ",
  "記録時刻"
];
const ARCHIVE_CSV_PREFIX_HEADERS = ["試合No", "保存ID", "保存日時", "保存タイトル"];
const ARCHIVE_CSV_HEADERS = [...ARCHIVE_CSV_PREFIX_HEADERS, ...POINT_CSV_HEADERS];
const CSV_SCHEMA_VERSION = "point-csv-v2/archive-csv-v1";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return structuredClone(defaultState);
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSideScores(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    A: Number.isFinite(Number(source.A)) ? Number(source.A) : 0,
    B: Number.isFinite(Number(source.B)) ? Number(source.B) : 0
  };
}

function normalizeState(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const saved = {
    ...structuredClone(defaultState),
    ...source,
    teams: { ...defaultState.teams, ...(isPlainObject(source.teams) ? source.teams : {}) },
    players: { ...defaultState.players, ...(isPlainObject(source.players) ? source.players : {}) },
    matchInfo: { ...defaultState.matchInfo, ...(isPlainObject(source.matchInfo) ? source.matchInfo : {}) },
    games: normalizeSideScores(source.games),
    gamePoints: normalizeSideScores(source.gamePoints),
    points: Array.isArray(source.points) ? source.points : [],
    analysisMemos: Array.isArray(source.analysisMemos) ? source.analysisMemos : []
  };
  const outcomeAliases = {
    "相手ミス": "相手の失ポイント",
    "自チームミス": "自チームの失ポイント",
    "エース": "サービス得点",
    "サービスエース": "サービス得点",
    "レシーブエース": "レシーブ得点",
    "相手の失ポイント": "ストロークミス",
    "自チームの失ポイント": "ストロークミス",
    "決定打": "ストローク得点",
    "ウィナー": "ストローク得点",
    "ストローク決定": "ストローク得点",
    "ボレー決定": "ボレー得点",
    "スマッシュ決定": "スマッシュ得点",
    "相手を崩した": "ストローク得点",
    "ダブルフォルト": "ダブルフォールト"
  };
  const courseAliases = {
    "左深": "左奥",
    "中央深": "中央奥",
    "右深": "右奥",
    "逆クロス深": "左奥",
    "センター深": "中央奥",
    "順クロス深": "右奥",
    "逆クロス前": "左前",
    "センター前": "中央前",
    "順クロス前": "右前",
    "サイド側アウト": "右サイドアウト",
    "ベースライン側アウト": "バックアウト",
    "ベースライン奥アウト": "バックアウト"
  };
  const resultAliases = {
    "コート内": "イン",
    "アウト": "バックアウト",
    "ベースライン側アウト": "バックアウト",
    "サイド側アウト": "サイドアウト"
  };

  saved.archiveId = typeof saved.archiveId === "string" ? saved.archiveId : "";
  saved.isPracticeMatch = saved.isPracticeMatch === true;
  saved.recordMode = ["simple", "detail"].includes(saved.recordMode) ? saved.recordMode : defaultState.recordMode;
  saved.selectedOutcome = outcomeAliases[saved.selectedOutcome] || saved.selectedOutcome || defaultState.selectedOutcome;
  saved.selectedCourse = courseAliases[saved.selectedCourse] || saved.selectedCourse || defaultState.selectedCourse;
  saved.selectedResult = resultAliases[saved.selectedResult] || saved.selectedResult || defaultState.selectedResult;
  saved.selectedServe = saved.selectedServe || (saved.firstServeIn === false ? "第2サービスで開始" : defaultState.selectedServe);
  saved.matchType = saved.matchType || defaultState.matchType;
  saved.matchFormat = saved.matchFormat || matchFormatFromGamesToWin(saved.gamesToWin);
  saved.gamesToWin = gamesToWinFromFormat(saved.matchFormat);
  saved.matchInfo = { ...defaultState.matchInfo, ...(saved.matchInfo || {}) };
  saved.selectedHand = saved.selectedHand || defaultState.selectedHand;
  saved.selectedServerPlayer = normalizePlayerKey(saved.selectedServerPlayer || defaultState.selectedServerPlayer);
  saved.selectedReceiverPlayer = normalizePlayerKey(saved.selectedReceiverPlayer || defaultState.selectedReceiverPlayer);
  saved.selectedPlayer = normalizePlayerKey(saved.selectedPlayer || saved.selectedRole || defaultState.selectedPlayer);
  saved.points = (saved.points || []).map((point) => ({
    ...point,
    outcome: outcomeAliases[point.outcome] || point.outcome,
    course: courseAliases[point.course] || point.course,
    result: resultAliases[point.result] || point.result || inferResult(point.outcome),
    serveStart: point.serveStart || getLegacyServeStart(point),
    firstServeIn: point.firstServeIn !== undefined ? point.firstServeIn : getLegacyServeStart(point) === "第1サービスで開始",
    shot: point.shot === "ロブ" ? "ロビング" : point.shot,
    hand: normalizeHand(point.hand),
    serverPlayer: normalizePlayerKey(point.serverPlayer || point.servicePlayer || "不明"),
    receiverPlayer: normalizePlayerKey(point.receiverPlayer || point.receivePlayer || "不明"),
    player: normalizePlayerKey(point.player || point.role || "不明"),
    phase: point.phase || getPhaseLabel(point.scoreBefore?.points || { A: 0, B: 0 })
  }));
  return saved;
}

function normalizePlayerKey(player) {
  const aliases = {
    ARear: "A後衛",
    AFront: "A前衛",
    BRear: "B後衛",
    BFront: "B前衛",
    ASingles: "A選手",
    BSingles: "B選手"
  };
  return aliases[player] || player || "不明";
}

function sideFromPlayerKey(player) {
  const key = normalizePlayerKey(player);
  if (key.startsWith("A")) return "A";
  if (key.startsWith("B")) return "B";
  return "";
}

function playerKeyForSideRole(side, role) {
  if (state.matchType === "singles") return side === "A" ? "A選手" : "B選手";
  return `${side}${role}`;
}

function serviceSidePlayerKeys(side) {
  if (state.matchType === "singles") return [playerKeyForSideRole(side, "選手")];
  return [playerKeyForSideRole(side, "後衛"), playerKeyForSideRole(side, "前衛")];
}

function isSelectableServicePlayer(player, side) {
  const key = normalizePlayerKey(player);
  return key === "不明" || serviceSidePlayerKeys(side).includes(key);
}

function getCurrentGamePointCount(matchState = state) {
  const points = matchState?.gamePoints || { A: 0, B: 0 };
  return (Number(points.A) || 0) + (Number(points.B) || 0);
}

function getCurrentServiceBlockIndex(matchState = state) {
  return Math.floor(getCurrentGamePointCount(matchState) / 2);
}

function getServerSideForServiceBlock(initialServer, blockIndex) {
  return blockIndex % 2 === 0 ? initialServer : RULES.switchSide(initialServer);
}

function inferInitialServerForCurrentGame(matchState = state) {
  const currentServer = ["A", "B"].includes(matchState?.server) ? matchState.server : "A";
  if (!RULES.isFinalGame(matchState)) return currentServer;
  const blockIndex = getCurrentServiceBlockIndex(matchState);
  return blockIndex % 2 === 0 ? currentServer : RULES.switchSide(currentServer);
}

function inferServiceRoleForSide(side, action, matchState = state) {
  if (matchState.matchType === "singles") return "選手";
  const blockIndex = getCurrentServiceBlockIndex(matchState);
  if (!RULES.isFinalGame(matchState)) {
    return blockIndex % 2 === 0 ? "後衛" : "前衛";
  }

  const initialServer = inferInitialServerForCurrentGame(matchState);
  let turnCount = 0;
  for (let block = 0; block <= blockIndex; block += 1) {
    const serverSide = getServerSideForServiceBlock(initialServer, block);
    const targetSide = action === "receive" ? RULES.switchSide(serverSide) : serverSide;
    if (targetSide === side) turnCount += 1;
  }
  return (turnCount - 1) % 2 === 0 ? "後衛" : "前衛";
}

function inferServicePlayers(matchState = state) {
  const serverSide = ["A", "B"].includes(matchState.server) ? matchState.server : "A";
  const receiverSide = RULES.switchSide(serverSide);
  return {
    serverPlayer: playerKeyForSideRole(serverSide, inferServiceRoleForSide(serverSide, "serve", matchState)),
    receiverPlayer: playerKeyForSideRole(receiverSide, inferServiceRoleForSide(receiverSide, "receive", matchState))
  };
}

function getServiceSelectionKey(matchState = state) {
  return [
    matchState.matchType,
    matchState.matchFormat,
    matchState.server,
    matchState.games?.A || 0,
    matchState.games?.B || 0,
    matchState.gamePoints?.A || 0,
    matchState.gamePoints?.B || 0
  ].join(":");
}

function syncServicePlayerSelections({ force = false } = {}) {
  const key = getServiceSelectionKey();
  const inferred = inferServicePlayers();
  const receiverSide = RULES.switchSide(state.server);
  const shouldAutoSelect = force || state.serviceSelectionKey !== key;

  if (shouldAutoSelect || !isSelectableServicePlayer(state.selectedServerPlayer, state.server)) {
    state.selectedServerPlayer = inferred.serverPlayer;
  }
  if (shouldAutoSelect || !isSelectableServicePlayer(state.selectedReceiverPlayer, receiverSide)) {
    state.selectedReceiverPlayer = inferred.receiverPlayer;
  }
  state.serviceSelectionKey = key;
}

function ensureServicePlayerSelections() {
  syncServicePlayerSelections();
}

function normalizeHand(hand) {
  const aliases = {
    "フォア": "フォアハンド",
    "バック": "バックハンド",
    "正面": "正面処理"
  };
  return aliases[hand] || hand || "不明";
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadArchivedMatches() {
  return SOFT_TENNIS_STORAGE.loadArchiveEntries();
}

function saveArchivedMatches(matches) {
  SOFT_TENNIS_STORAGE.saveArchiveEntries(matches);
}

function estimateTextBytes(text) {
  return SOFT_TENNIS_STORAGE.estimateStoredTextBytes(text);
}

function formatStorageSize(bytes) {
  return SOFT_TENNIS_STORAGE.formatStoredByteSize(bytes);
}

function getAppStorageUsage() {
  const currentText = localStorage.getItem(STORAGE_KEY) || "";
  const archiveText = localStorage.getItem(ARCHIVE_STORAGE_KEY) || "";
  const archivedMatches = loadArchivedMatches();
  const currentBytes = estimateTextBytes(currentText);
  const archiveBytes = estimateTextBytes(archiveText);
  return {
    archivedCount: archivedMatches.length,
    currentBytes,
    archiveBytes,
    totalBytes: currentBytes + archiveBytes
  };
}

function matchHasRecordableData(matchState = state) {
  return !!(
    matchState.finished ||
    matchState.points?.length ||
    matchState.analysisMemos?.length ||
    matchState.games?.A ||
    matchState.games?.B
  );
}

function displayNameFromState(matchState, side) {
  if (side === "A") return matchState.matchType === "singles" ? matchState.teams?.A || "自分" : matchState.teams?.A || "自チーム";
  return matchState.matchType === "singles" ? matchState.teams?.B || "相手" : matchState.teams?.B || "相手ペア";
}

function createArchiveId() {
  return crypto.randomUUID?.() || `match-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureCurrentArchiveId() {
  if (!state.archiveId) state.archiveId = createArchiveId();
  return state.archiveId;
}

function archiveSignature(matchState = state) {
  const lastPoint = matchState.points?.at?.(-1) || {};
  return JSON.stringify({
    teams: matchState.teams,
    players: matchState.players,
    matchInfo: matchState.matchInfo,
    games: matchState.games,
    points: matchState.points?.length || 0,
    lastPoint: lastPoint.id || lastPoint.at || ""
  });
}

function buildArchivedMatchTitle(matchState = state) {
  const info = matchState.matchInfo || defaultState.matchInfo;
  const date = info.date || "日付未記録";
  const event = info.tournament || info.event || "";
  const score = `${matchState.games?.A ?? 0}-${matchState.games?.B ?? 0}`;
  return [date, event, `${displayNameFromState(matchState, "A")} vs ${displayNameFromState(matchState, "B")}`, score].filter(Boolean).join(" / ");
}

function archiveCurrentMatch(reason = "auto") {
  if (!matchHasRecordableData(state)) return null;
  const archiveId = ensureCurrentArchiveId();
  const snapshot = normalizeState(structuredClone(state));
  snapshot.archiveId = archiveId;
  const signature = archiveSignature(snapshot);
  const archived = loadArchivedMatches();
  const existing = archived.find((entry) => entry.id === archiveId);
  const entry = {
    id: archiveId,
    createdAt: existing?.createdAt || existing?.savedAt || new Date().toISOString(),
    savedAt: new Date().toISOString(),
    reason,
    signature,
    title: buildArchivedMatchTitle(snapshot),
    pointCount: snapshot.points.length,
    games: { ...snapshot.games },
    finished: snapshot.finished,
    state: snapshot
  };
  saveArchivedMatches([entry, ...archived.filter((archive) => archive.id !== archiveId)]);
  return entry;
}

function syncCurrentArchive(reason = "auto") {
  if (!state.archiveId && !matchHasRecordableData(state)) return null;
  if (!matchHasRecordableData(state)) {
    const archiveId = state.archiveId;
    if (archiveId) saveArchivedMatches(loadArchivedMatches().filter((entry) => entry.id !== archiveId));
    return null;
  }
  return archiveCurrentMatch(reason);
}

function sanitizeFileNamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 28);
}

function getSummaryImageFileName(date = new Date(), mode = summaryPreviewMode) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
  const teams = [sanitizeFileNamePart(displayName("A")), sanitizeFileNamePart(displayName("B"))].filter(Boolean).join("-vs-");
  const modeLabel = mode === "detail" ? "detail" : "share";
  return `soft-tennis-summary-${modeLabel}-${timestamp}${teams ? `-${teams}` : ""}.png`;
}

function getCsvFileName(date = new Date()) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
  const teams = [sanitizeFileNamePart(displayName("A")), sanitizeFileNamePart(displayName("B"))].filter(Boolean).join("-vs-");
  return `soft-tennis-points-${timestamp}${teams ? `-${teams}` : ""}.csv`;
}

function getLegacyServeStart(point) {
  if (point?.outcome === "ダブルフォールト" || point?.outcome === "ダブルフォルト") return "ダブルフォールト";
  return point?.firstServeIn === false ? "第2サービスで開始" : "第1サービスで開始";
}

function gamesToWinFromFormat(format) {
  return RULES.gamesToWinFromFormat(format);
}

function matchFormatFromGamesToWin(gamesToWin) {
  return RULES.matchFormatFromGamesToWin(gamesToWin);
}

function matchFormatLabel() {
  return RULES.matchFormatLabel(state.matchFormat);
}

function isFinalGame() {
  return RULES.isFinalGame(state);
}

function getPointTarget() {
  return RULES.getPointTarget(state);
}

function getPointTargetForRecordedPoint(point) {
  return RULES.getPointTargetForRecordedPoint(point, state);
}

function hasWonUnit(a, b, target) {
  return RULES.hasWonUnit(a, b, target);
}

function winsCurrentGameOnNextPoint(team) {
  return RULES.winsCurrentGameOnNextPoint(state, team);
}

function getMatchPointTeams() {
  return RULES.getMatchPointTeams(state);
}

function pointLabel(team) {
  return RULES.pointLabel(state, team);
}

function displayName(team) {
  return state.teams[team] || (team === "A" ? ownDefaultName() : opponentDefaultName());
}

function shortDisplayName(team) {
  const fallback = team === "A" ? ownDefaultName() : opponentDefaultName();
  const name = (state.teams[team] || fallback).trim();
  if (!name) return fallback;
  if (["自ペア", "自チーム", "自分", "相手", "相手ペア", "相手選手"].includes(name)) return name.replace("選手", "");
  const compact = name.replace(/\s+/g, "").replace(/ペア$/, "").replace(/チーム$/, "");
  return [...compact].slice(0, 4).join("");
}

function shortSideName(team) {
  return team === "A" ? "自" : "相";
}

function ownDefaultName() {
  return state.matchType === "singles" ? "自分" : "自チーム";
}

function opponentDefaultName() {
  return state.matchType === "singles" ? "相手選手" : "相手ペア";
}

function ownSideLabel() {
  return state.matchType === "singles" ? "自分" : "自チーム";
}

function playerLabel(player) {
  const labels = {
    A後衛: state.players.ARear,
    A前衛: state.players.AFront,
    B後衛: state.players.BRear,
    B前衛: state.players.BFront,
    A選手: displayName("A"),
    B選手: displayName("B")
  };
  const key = normalizePlayerKey(player);
  return labels[key] || key || "不明";
}

function playerLabelFromState(matchState, player) {
  const key = normalizePlayerKey(player);
  const players = matchState?.players || defaultState.players;
  const labels = {
    A後衛: players.ARear || defaultState.players.ARear,
    A前衛: players.AFront || defaultState.players.AFront,
    B後衛: players.BRear || defaultState.players.BRear,
    B前衛: players.BFront || defaultState.players.BFront,
    A選手: displayNameFromState(matchState, "A"),
    B選手: displayNameFromState(matchState, "B")
  };
  return labels[key] || key || "不明";
}

function matchFormatLabelFromState(matchState) {
  return RULES.matchFormatLabel(matchState?.matchFormat || matchFormatFromGamesToWin(matchState?.gamesToWin));
}

function getPhaseLabel(points) {
  return RULES.getPhaseLabel(points);
}

function isOpeningPointLoss(point) {
  return RULES.isOpeningPoint(point);
}

function isDeuceOrLaterLoss(point) {
  return RULES.isDeuceOrLater(point, state);
}

function isGamePointAreaLoss(point) {
  return RULES.isGamePointArea(point, state);
}

function getGameNumber(games) {
  return RULES.getGameNumber(games);
}

function switchServer() {
  state.server = RULES.switchSide(state.server);
}

function addPoint(winner) {
  syncServicePlayerSelections();
  const scoreResult = RULES.applyPointToScore(state, winner);
  if (scoreResult.ignored) return;

  const entry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    winner,
    server: state.server,
    course: state.selectedCourse,
    outcome: state.selectedOutcome,
    result: state.selectedResult,
    serveStart: state.selectedServe,
    serverPlayer: state.selectedServerPlayer,
    receiverPlayer: state.selectedReceiverPlayer,
    hand: state.selectedHand,
    player: resolvePointPlayerForSave(winner),
    shot: state.selectedShot || "不明",
    rally: getRallyValueForSave(),
    firstServeIn: state.selectedServe === "第1サービスで開始",
    memo: String(state.selectedMemo || "").trim(),
    phase: getPhaseLabel(state.gamePoints),
    gameNumber: getGameNumber(state.games),
    endTimeBefore: state.matchInfo?.endTime || "",
    scoreBefore: {
      games: { ...state.games },
      points: { ...state.gamePoints }
    }
  };

  state.games = scoreResult.games;
  state.gamePoints = scoreResult.gamePoints;
  state.server = scoreResult.server;
  state.finished = scoreResult.finished;
  if (scoreResult.gameWonBy) entry.gameWonBy = scoreResult.gameWonBy;

  if (state.finished) {
    if (!state.matchInfo.endTime) {
      state.matchInfo.endTime = getCurrentClockTime();
    }
  }

  entry.scoreAfter = {
    games: { ...state.games },
    points: { ...state.gamePoints }
  };
  state.points.push(entry);
  state.selectedMemo = "";
  ensureServicePlayerSelections();
  syncCurrentArchive("auto-point");
  saveState();
  return entry;
}

function undoPoint() {
  const last = state.points.pop();
  if (!last) return;
  state.games = { ...last.scoreBefore.games };
  state.gamePoints = { ...last.scoreBefore.points };
  state.server = last.server;
  state.matchInfo.endTime = last.endTimeBefore || "";
  state.finished = false;
  ensureServicePlayerSelections();
  syncCurrentArchive("auto-undo");
  saveState();
  return last;
}

function getPracticeServicePlayers(matchState) {
  const server = ["A", "B"].includes(matchState.server) ? matchState.server : "A";
  const receiver = RULES.switchSide(server);
  return {
    serverPlayer: `${server}後衛`,
    receiverPlayer: `${receiver}後衛`
  };
}

function appendPracticePoint(matchState, point, index, total) {
  const servicePlayers = getPracticeServicePlayers(matchState);
  const scoreBefore = {
    games: { ...matchState.games },
    points: { ...matchState.gamePoints }
  };
  const scoreResult = RULES.applyPointToScore(matchState, point.winner);
  if (scoreResult.ignored) return;

  const entry = {
    id: crypto.randomUUID(),
    at: new Date(Date.now() - (total - index) * 45000).toISOString(),
    winner: point.winner,
    server: matchState.server,
    course: point.course || "未記録",
    outcome: point.outcome,
    result: point.result || "イン",
    serveStart: point.serveStart || "第1サービスで開始",
    serverPlayer: point.serverPlayer || servicePlayers.serverPlayer,
    receiverPlayer: point.receiverPlayer || servicePlayers.receiverPlayer,
    hand: point.hand || "不明",
    player: point.player || "不明",
    shot: point.shot || "ストローク",
    rally: point.rally || "4",
    firstServeIn: (point.serveStart || "第1サービスで開始") === "第1サービスで開始",
    memo: point.memo || "",
    phase: getPhaseLabel(matchState.gamePoints),
    gameNumber: getGameNumber(matchState.games),
    endTimeBefore: "",
    scoreBefore
  };

  matchState.games = scoreResult.games;
  matchState.gamePoints = scoreResult.gamePoints;
  matchState.server = scoreResult.server;
  matchState.finished = scoreResult.finished;
  if (scoreResult.gameWonBy) entry.gameWonBy = scoreResult.gameWonBy;
  entry.scoreAfter = {
    games: { ...matchState.games },
    points: { ...matchState.gamePoints }
  };
  matchState.points.push(entry);
}

function createPracticeMatchState() {
  const practiceState = structuredClone(defaultState);
  practiceState.archiveId = createArchiveId();
  practiceState.isPracticeMatch = true;
  practiceState.teams = { A: "青葉中 A", B: "白浜中 B" };
  practiceState.players = {
    AFront: "青葉 前衛",
    ARear: "青葉 後衛",
    BFront: "白浜 前衛",
    BRear: "白浜 後衛"
  };
  practiceState.matchInfo = {
    date: new Date().toISOString().slice(0, 10),
    timeOfDay: "午後",
    startTime: "14:00",
    endTime: "",
    weather: "晴れ",
    temperature: "25-29",
    wind: "弱い",
    windSide: "未記録",
    surface: "オムニ",
    courtCondition: "乾いている",
    opponentFormation: "雁行陣",
    event: "練習試合",
    tournament: "初回練習サンプル",
    venueName: "サンプルコート",
    venue: "第1コート"
  };

  const points = [
    { winner: "A", outcome: "サービス得点", player: "A後衛", shot: "サービス", rally: "1", course: "中央奥", memo: "第1サービスから押せた" },
    { winner: "B", outcome: "レシーブ得点", player: "B後衛", shot: "レシーブ", rally: "2", course: "左奥" },
    { winner: "A", outcome: "ボレー得点", player: "A前衛", shot: "ボレー", rally: "3", course: "中央前", memo: "前衛が早く触れた" },
    { winner: "A", outcome: "ストローク得点", player: "A後衛", shot: "ストローク", rally: "6-9", course: "右奥" },
    { winner: "B", outcome: "ストロークミス", player: "A後衛", shot: "ストローク", rally: "4", result: "バックアウト", course: "バックアウト", memo: "深く狙って少し長い" },
    { winner: "A", outcome: "ボレー得点", player: "A前衛", shot: "ボレー", rally: "3", course: "左前", memo: "1ゲーム目を前衛で取り切り" },
    { winner: "B", outcome: "サービス得点", player: "B後衛", shot: "サービス", rally: "1", course: "中央奥" },
    { winner: "A", outcome: "レシーブ得点", player: "A後衛", shot: "レシーブ", rally: "2", course: "右奥", memo: "相手サービスを先に攻めた" },
    { winner: "B", outcome: "スマッシュ得点", player: "B前衛", shot: "スマッシュ", rally: "4", course: "中央前" },
    { winner: "A", outcome: "ストローク得点", player: "A後衛", shot: "ストローク", rally: "6-9", course: "中央奥" }
  ];
  points.forEach((point, index) => appendPracticePoint(practiceState, point, index, points.length));

  practiceState.selectedOutcome = "ストローク得点";
  practiceState.selectedCourse = "未記録";
  practiceState.selectedResult = "不明";
  practiceState.selectedServe = "第1サービスで開始";
  practiceState.selectedRallyLength = "long";
  practiceState.selectedPlayer = "不明";
  practiceState.selectedServerPlayer = getPracticeServicePlayers(practiceState).serverPlayer;
  practiceState.selectedReceiverPlayer = getPracticeServicePlayers(practiceState).receiverPlayer;
  practiceState.serviceSelectionKey = "";
  return normalizeState(practiceState);
}

function rallyLengthModeForOutcome(outcome) {
  if (["ダブルフォールト", "サービス得点", "レシーブ得点", "レシーブミス"].includes(outcome)) return "short";
  return "long";
}

function syncRallyLengthFromOutcome(outcome) {
  state.selectedRallyLength = rallyLengthModeForOutcome(outcome);
}

function setSimpleOutcome(outcome) {
  state.selectedOutcome = outcome;
  applyOutcomePreset(outcome);
  syncRallyLengthFromOutcome(outcome);
}

function getCompactMatchStatus() {
  if (state.finished) return "終了";
  if (state.matchFormat === "final") return "FG";
  return `${state.games.A + state.games.B + 1}G`;
}

function getWinnerTeam() {
  if (!state.finished || state.games.A === state.games.B) return "";
  return state.games.A > state.games.B ? "A" : "B";
}

function getNextStepText() {
  if (state.finished) return "試合終了。分析で要点、履歴で1点ずつ確認できます";
  if (!state.points.length) return `最初は ${displayName(state.server)} のサービス`;
  const latest = state.points[state.points.length - 1];
  return `次は ${displayName(state.server)} のサービス`;
}

function getRuleNoteText() {
  if (state.finished) return "試合終了。分析と履歴でふり返れます。";
  if (!isFinalGame()) return "";

  const total = state.gamePoints.A + state.gamePoints.B;
  const sideChange = total === 2 || (total > 2 && (total - 2) % 4 === 0);
  if (sideChange && total > 0) {
    return "ファイナルゲーム中です。ここでチェンジサイズを確認してください。サービスは2ポイントごとに交替します。";
  }
  return "ファイナルゲーム中です。7ポイント先取、2ポイント差。サービスは2ポイントごとに交替します。";
}

function summarize() {
  const total = state.points.length || 1;
  const ownPoints = state.points.filter((point) => point.winner === "A").length;
  const servePoints = state.points.filter((point) => point.server === "A");
  const firstServeStarts = servePoints.filter((point) => point.serveStart === "第1サービスで開始").length;
  const secondServeStarts = servePoints.filter((point) => point.serveStart === "第2サービスで開始").length;
  const rallyStats = getRallyLengthStats();
  const ownLost = state.points.filter((point) => point.winner === "B");
  const ownScoredByPattern = state.points.filter((point) => point.winner === "A" && isScoringOutcome(point.outcome)).length;
  const ownEarlyLost = ownLost.filter(isOpeningPointLoss).length;
  const ownDoubleFaults = ownLost.filter((point) => point.outcome === "ダブルフォールト" && point.server === "A").length;
  const ownReceiveMisses = ownLost.filter((point) => point.outcome === "レシーブミス" && point.server === "B").length;
  const firstHalf = getFirstHalfGames();

  return [
    ["記録したポイント", state.points.length, "分析のもとになる入力数。少ない時は傾向ではなく参考値として見る"],
    ["取れたポイントの割合", `${Math.round((ownPoints / total) * 100)}%`, "全体の中で自チームが取れた割合。試合の流れを大きく見る"],
    ["前半で取れたゲーム", `${firstHalf.A}-${firstHalf.B}`, "序盤で流れを作れたかを見る。少ない時は1ゲーム目の入り方とサービス/レシーブを確認"],
    ["自分たちで取った点", ownScoredByPattern, "相手ミスではなく、自分たちのプレーで取れた点。次も再現したい形を探す"],
    ["最初の2本で与えた点", ownEarlyLost, "サービス、レシーブ、その次の1本で与えた点。試合中に直しやすい"],
    ["ダブルフォールト", ownDoubleFaults, "自チームのサービスで相手に与えた点。多い時は2ndの安全度を優先"],
    ["第2サービスから始まった点", secondServeStarts, "第1サービスが入らず不利に始まった点。攻める前の安定度を見る"],
    ["レシーブミス", ownReceiveMisses, "相手サービスで返せず相手に与えた点。多い時は返球コースと構えを確認"],
    ["第1サービスで始められた割合", servePoints.length ? `${Math.round((firstServeStarts / servePoints.length) * 100)}%` : "-", "自チームサービスの入り。低い時は威力より確率を優先"],
    ["3本以内のポイント", rallyStats.recorded ? `${rallyStats.short}/${rallyStats.recorded}本` : "-", "サーブを1本目として、早く終わったポイントを見る"],
    ["4本以上のポイント", rallyStats.recorded ? `${rallyStats.long}/${rallyStats.recorded}本` : "-", "ラリーになった時に粘れているかを見る"]
  ];
}

function getAnalysisData() {
  const total = state.points.length;
  const ownWon = state.points.filter((point) => point.winner === "A");
  const ownPoints = ownWon.length;
  const ownLost = state.points.filter((point) => point.winner === "B");
  const ownScoredByPattern = ownWon.filter((point) => isScoringOutcome(point.outcome)).length;
  const ownPointsByOpponentError = ownWon.filter((point) => isErrorOutcome(point.outcome)).length;
  const ownLostByOwnError = ownLost.filter((point) => isErrorOutcome(point.outcome)).length;
  const servePoints = state.points.filter((point) => point.server === "A");
  const firstServeStarts = servePoints.filter((point) => point.serveStart === "第1サービスで開始").length;
  const secondServeStarts = servePoints.filter((point) => point.serveStart === "第2サービスで開始").length;
  const ownDoubleFaults = ownLost.filter((point) => point.outcome === "ダブルフォールト" && point.server === "A").length;
  const ownReceiveMisses = ownLost.filter((point) => point.outcome === "レシーブミス" && point.server === "B").length;
  const ownEarlyLost = ownLost.filter(isOpeningPointLoss).length;
  const firstHalf = getFirstHalfGames();
  const opening = getGameOpeningStats();
  const streaks = getStreakDetails();
  const clutch = getClutchStats();
  const rallyStats = getRallyLengthStats();
  const rallyRecorded = rallyStats.recorded;
  const rallyShortRate = rallyRecorded ? Math.round((rallyStats.short / rallyRecorded) * 100) : 0;
  const rallyLongRate = rallyRecorded ? Math.round((rallyStats.long / rallyRecorded) * 100) : 0;
  return {
    total,
    ownPoints,
    ownScoredByPattern,
    ownPointsByOpponentError,
    ownLostByOwnError,
    ownLost: ownLost.length,
    pointDiff: ownPoints - ownLost.length,
    pointRate: total ? Math.round((ownPoints / total) * 100) : 0,
    firstServeRate: servePoints.length ? Math.round((firstServeStarts / servePoints.length) * 100) : null,
    secondServeStarts,
    ownDoubleFaults,
    ownReceiveMisses,
    ownEarlyLost,
    firstHalfOwnGames: firstHalf.A,
    firstHalfOpponentGames: firstHalf.B,
    firstHalfGamesText: `${firstHalf.A}-${firstHalf.B}`,
    openingPointOwn: opening.own,
    openingPointOpponent: opening.opp,
    openingPointTotal: opening.total,
    openingPointRate: opening.rate,
    longestOwnStreak: streaks.own?.count || 0,
    longestOwnStreakText: formatStreak(streaks.own),
    longestOppStreak: streaks.opp?.count || 0,
    longestOppStreakText: formatStreak(streaks.opp),
    rallyStats,
    rallyShort: rallyStats.short,
    rallyLong: rallyStats.long,
    rallyRecorded,
    rallyShortRate,
    rallyLongRate,
    ownGamePointMissed: clutch.ownGamePointMissed,
    ownMatchPointMissed: clutch.ownMatchPointMissed,
    topError: topEntry(countByOutcomeType("error", ownLost)),
    topScore: topEntry(countByOutcomeType("score", ownWon)),
    topResult: topEntry(countBy("result")),
    topPlayer: topEntry(countByPlayer())
  };
}

function topEntry(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0] || ["なし", 0];
}

function formatPointDiff(diff) {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return String(diff);
  return "±0";
}

function formatContributionDiff(diff) {
  return `貢献差 ${formatPointDiff(diff)}`;
}

function pointDiffTone(diff) {
  if (diff > 0) return "own";
  if (diff < 0) return "opp";
  return "neutral";
}

function buildQuickCoachItems(data = getAnalysisData()) {
  return SOFT_TENNIS_ANALYSIS.buildQuickCoachItemsFromData(data);
}

function uniqueAdviceItems(items) {
  return items.reduce((acc, item) => {
    const text = cleanPriorityText(item);
    if (text && !acc.includes(text)) acc.push(text);
    return acc;
  }, []);
}

function buildPriorityAdviceItems(data = getAnalysisData()) {
  if (!data.total) return ["まだ記録がありません。まずは1ポイント記録してください"];
  return uniqueAdviceItems([...buildQuickCoachItems(data), ...buildPriorityItems()]).slice(0, ANALYSIS_COMMENT_RULES.priorityLimit);
}

function buildActionPlanRows(data = getAnalysisData(), { limit = 6 } = {}) {
  const ownWon = state.points.filter((point) => point.winner === "A");
  const ownLost = state.points.filter((point) => point.winner === "B");
  const opponentError = topEntry(countByOutcomeType("error", ownWon));
  const opponentScore = topEntry(countByOutcomeType("score", ownLost));
  const rallyStats = getRallyLengthStats();
  const rows = [];

  if (!data.total) {
    rows.push(["判断材料を増やす", "まず1ゲーム分を目安に記録し、サービス・レシーブ・誰のプレーかを見る", "neutral"]);
  } else {
    if (data.ownDoubleFaults > 0) rows.push(["サービスで与えた点を減らす", `DF ${data.ownDoubleFaults}本。第2サービスは入れるコースを決めてから打つ`, "opp"]);
    if (data.ownReceiveMisses > 0) rows.push(["レシーブで与えた点を減らす", `レシーブミス ${data.ownReceiveMisses}本。強く返す前に、深さか高さを決める`, "opp"]);
    if (data.openingPointRate !== null && data.openingPointRate < ANALYSIS_COMMENT_RULES.openingRateLow) rows.push(["ゲーム最初の1本を取りにいく", `1ポイント目 ${data.openingPointOwn}/${data.openingPointTotal}本。最初に使う安全な入り方を決める`, "opp"]);
    if (data.longestOppStreak >= ANALYSIS_COMMENT_RULES.longLostStreakAlert) rows.push(["連続で取られた流れを切る", `最長連続失点 ${data.longestOppStreakText}。次の1本はまず返して相手にもう一度打たせる`, "opp"]);
    if (data.ownGamePointMissed > 0 || data.ownMatchPointMissed > 0) rows.push(["ゲームポイント後の1本を整理する", `GP逸失 ${data.ownGamePointMissed}回 / MP逸失 ${data.ownMatchPointMissed}回。決め急がず、先に入れる形を選ぶ`, "opp"]);
    if (data.ownLostByOwnError > data.ownScoredByPattern) rows.push(["与えた点を先に減らす", `ミスで与えた点 ${data.ownLostByOwnError}本が、自分たちで取った点 ${data.ownScoredByPattern}本を上回る`, "opp"]);
    if (rallyStats.recorded >= ANALYSIS_COMMENT_RULES.rallyRecordedMin && data.rallyShortRate >= ANALYSIS_COMMENT_RULES.shortRallyRateHigh) rows.push(["3本以内の入りを確認する", `3本以内 ${rallyStats.short}/${rallyStats.recorded}本。サービス・レシーブ直後の1本で取られた/与えた内容を見る`, "neutral"]);
    if (rallyStats.recorded >= ANALYSIS_COMMENT_RULES.rallyRecordedMin && data.rallyLongRate >= ANALYSIS_COMMENT_RULES.longRallyRateHigh) rows.push(["4本以上の最後を確認する", `4本以上 ${rallyStats.long}/${rallyStats.recorded}本。続いた後に取れた形、取られた形を分ける`, "neutral"]);
    if (opponentScore[1] > 0) rows.push(["相手に取られた形を止める", `相手に取られた主な形は ${opponentScore[0]} ${opponentScore[1]}本。先に打たせない配球を確認`, "opp"]);
    if (opponentError[1] > 0) rows.push(["相手が与えた点を再現する", `相手が与えた主なミスは ${opponentError[0]} ${opponentError[1]}本。そこに至った配球を残す`, "own"]);
    if (data.topScore[1] > 0) rows.push(["取れた形をもう一度使う", `${data.topScore[0]} ${data.topScore[1]}本。次の試合でも同じ入り方を選べるようにする`, "own"]);
  }

  return rows.filter((row, index, allRows) => allRows.findIndex((item) => item[0] === row[0]) === index).slice(0, limit);
}

function getSideInsightItems() {
  const data = getAnalysisData();
  const ownWon = state.points.filter((point) => point.winner === "A");
  const ownLost = state.points.filter((point) => point.winner === "B");
  const opponentError = topEntry(countByOutcomeType("error", ownWon));
  const opponentScore = topEntry(countByOutcomeType("score", ownLost));
  const ownError = topEntry(countByOutcomeType("error", ownLost));
  const ownTopScore = data.topScore;
  const ownItems = [
    `自分たちで取った形 ${data.ownScoredByPattern}本 / 相手ミスで取った ${data.ownPointsByOpponentError}本`,
    `ミスで与えた ${data.ownLostByOwnError}本 / 主なミス ${ownError[1] ? `${ownError[0]} ${ownError[1]}本` : "未記録"}`,
    ownTopScore[1] ? `良い得点形は ${ownTopScore[0]} ${ownTopScore[1]}本` : "良い得点形はまだ未記録"
  ];
  const opponentItems = [
    `相手に取られた形 ${ownLost.filter((point) => isScoringOutcome(point.outcome)).length}本 / こちらが与えた点 ${data.ownLostByOwnError}本`,
    opponentScore[1] ? `相手に取られた主な形は ${opponentScore[0]} ${opponentScore[1]}本` : "相手に取られた形はまだ未記録",
    opponentError[1] ? `相手の主なミスは ${opponentError[0]} ${opponentError[1]}本` : "相手ミスはまだ未記録"
  ];
  return { ownItems, opponentItems };
}

function buildPriorityItems() {
  if (!state.points.length) return ["まだ記録がありません。まずは数ポイント記録して傾向を確認"];

  const ownLost = state.points.filter((point) => point.winner === "B");
  const ownWon = state.points.filter((point) => point.winner === "A");
  const opponentServePoints = state.points.filter((point) => point.server === "B");
  const opponentFirstServe = opponentServePoints.filter((point) => point.serveStart === "第1サービスで開始").length;
  const opponentReceiveMissGain = state.points.filter((point) => point.winner === "B" && point.outcome === "レシーブミス" && point.server === "B").length;
  const opponentByPattern = ownLost.filter((point) => isScoringOutcome(point.outcome)).length;
  const ownError = topEntry(countByOutcomeType("error", ownLost));
  const opponentError = topEntry(countByOutcomeType("error", ownWon));
  const targetPlayer = topEntry(countByPlayer(ownWon.filter((point) => isErrorOutcome(point.outcome))));
  const phaseCounts = getPhaseCounts();
  const firstServeRate = opponentServePoints.length ? Math.round((opponentFirstServe / opponentServePoints.length) * 100) : null;
  const items = [];

  if (ownError[1] > 0) {
    items.push(`相手に与えた形で最も多いのは「${ownError[0]}」 ${ownError[1]}本`);
  }
  if (phaseCounts["最初の2本で失点"] > 0) {
    items.push(`最初の2本で取られた/与えた点 ${phaseCounts["最初の2本で失点"]}本。ゲームの入りで相手に流れを渡している`);
  }
  if (phaseCounts["ゲームポイント付近で失点"] > 0 || phaseCounts["デュース以降で失点"] > 0) {
    items.push(`勝負所で取られた/与えた点 ${phaseCounts["ゲームポイント付近で失点"] + phaseCounts["デュース以降で失点"]}本。終盤の判断材料`);
  }
  if (opponentError[1] > 0) {
    const target = targetPlayer[1] > 0 && targetPlayer[0] !== "不明" ? ` 対象は ${targetPlayer[0]} が最多` : "";
    items.push(`相手の主なミスは「${opponentError[0]}」 ${opponentError[1]}本。${target}`);
  }
  const rallyStats = getRallyLengthStats();
  if (rallyStats.recorded >= ANALYSIS_COMMENT_RULES.rallyRecordedMin) {
    const shortRate = Math.round((rallyStats.short / rallyStats.recorded) * 100);
    const longRate = Math.round((rallyStats.long / rallyStats.recorded) * 100);
    if (shortRate >= ANALYSIS_COMMENT_RULES.shortRallyRateHigh) {
      items.push(`3本以内のポイント ${rallyStats.short}/${rallyStats.recorded}本。サービス・レシーブ直後を最優先で確認`);
    } else if (longRate >= ANALYSIS_COMMENT_RULES.longRallyRateHigh) {
      items.push(`4本以上のポイント ${rallyStats.long}/${rallyStats.recorded}本。続いた後に取れた形、取られた形を確認`);
    }
  }
  if (opponentReceiveMissGain > 0) {
    items.push(`相手サービス時にレシーブミスで与えた点 ${opponentReceiveMissGain}本`);
  } else if (firstServeRate !== null && firstServeRate < ANALYSIS_COMMENT_RULES.firstServeLow) {
    items.push(`相手の第1サービス開始率 ${firstServeRate}%`);
  }
  if (opponentByPattern > 0) {
    items.push(`相手に取られた点 ${opponentByPattern}本`);
  }
  if (!items.length) items.push("大きな偏りはまだ見えていません。記録を続けて傾向確認");

  return items.map(cleanPriorityText).slice(0, ANALYSIS_COMMENT_RULES.priorityLimit);
}

function cleanPriorityText(text) {
  return SOFT_TENNIS_ANALYSIS.cleanAnalysisText(text);
}

function buildSummaryComments(data = getAnalysisData()) {
  return SOFT_TENNIS_ANALYSIS.buildSummaryCommentsFromData(data, formatPointDiff);
}

function rallyValue(rally) {
  if (rally === "6-9") return 7.5;
  if (rally === "10+") return 10;
  return Number(rally || 0);
}

function rallyBucket(rally) {
  const value = rallyValue(rally);
  if (!value) return "unknown";
  return value <= 3 ? "short" : "long";
}

function getRallyLengthStats(points = state.points) {
  return points.reduce((acc, point) => {
    const bucket = rallyBucket(point.rally);
    if (bucket === "short") acc.short += 1;
    else if (bucket === "long") acc.long += 1;
    else acc.unknown += 1;
    acc.recorded = acc.short + acc.long;
    return acc;
  }, { short: 0, long: 0, unknown: 0, recorded: 0 });
}

function inferRallyValueForCurrentPoint() {
  const outcome = state.selectedOutcome;
  if (state.selectedServe === "ダブルフォールト" || outcome === "ダブルフォールト") return "1";
  if (outcome === "サービス得点") return "1";
  if (outcome === "レシーブ得点" || outcome === "レシーブミス") return "2";
  return "4";
}

function getRallyValueForSave() {
  const mode = state.selectedRallyLength || rallyLengthModeForOutcome(state.selectedOutcome);
  if (mode === "short") return "3";
  if (mode === "long") return "4";
  return inferRallyValueForCurrentPoint();
}

function getRallyLengthLabel() {
  const value = getRallyValueForSave();
  return rallyBucket(value) === "short" ? "3本以内" : "4本以上";
}

function getFirstHalfGames() {
  const maxGames = state.gamesToWin * 2 - 1;
  const firstHalfLimit = Math.floor(maxGames / 2);
  return state.points.reduce((acc, point) => {
    const gameNumber = point.gameNumber || getGameNumber(point.scoreBefore?.games || { A: 0, B: 0 });
    if (point.gameWonBy && gameNumber <= firstHalfLimit) {
      acc[point.gameWonBy] += 1;
    }
    return acc;
  }, { A: 0, B: 0 });
}

function countBy(key, points = state.points) {
  return points.reduce((acc, point) => {
    const value = point[key] || "未設定";
    if (value === "未記録" || value === "不明") return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function isScoringOutcome(outcome) {
  return SCORING_OUTCOMES.includes(outcome);
}

function isErrorOutcome(outcome) {
  return ERROR_OUTCOMES.includes(outcome);
}

function resolvePointPlayerForSave() {
  return state.selectedPlayer !== "不明" ? state.selectedPlayer : "不明";
}

function inferResult(outcome) {
  if (outcome === "ダブルフォールト" || String(outcome).includes("ミス")) return "不明";
  return "イン";
}

function inferResultFromCourse(course, presetResult = "") {
  const value = String(course || "");
  if (presetResult === "ネット" || value === "ネット") return "ネット";
  if (presetResult === "サイドアウト" || value.includes("サイドアウト")) return "サイドアウト";
  if (presetResult === "バックアウト" || value.includes("バックアウト")) return "バックアウト";
  return "イン";
}

function countByOutcomeType(type, points = state.points) {
  const outcomes = type === "score" ? SCORING_OUTCOMES : ERROR_OUTCOMES;
  return points.reduce((acc, point) => {
    if (!outcomes.includes(point.outcome)) return acc;
    acc[point.outcome] = (acc[point.outcome] || 0) + 1;
    return acc;
  }, {});
}

function applyOutcomePreset(outcome) {
  const shotByOutcome = {
    "ダブルフォールト": "サービス",
    "サービス得点": "サービス",
    "レシーブ得点": "レシーブ",
    "レシーブミス": "レシーブ",
    "ボレーミス": "ボレー",
    "ボレー得点": "ボレー",
    "スマッシュミス": "スマッシュ",
    "スマッシュ得点": "スマッシュ",
    "ストロークミス": "ストローク",
    "ストローク得点": "ストローク",
    "ロビング得点": "ロビング"
  };
  if (shotByOutcome[outcome]) {
    state.selectedShot = shotByOutcome[outcome];
  }
  if (outcome === "ダブルフォールト") {
    state.selectedServe = "ダブルフォールト";
    state.selectedCourse = "未記録";
    state.selectedResult = "不明";
    return;
  }
  if (isScoringOutcome(outcome)) {
    state.selectedResult = state.selectedCourse === "未記録" ? "不明" : "イン";
  } else if (state.selectedResult === "イン") {
    state.selectedResult = "ネット";
  }
}

function getPhaseCounts() {
  const ownLost = state.points.filter((point) => point.winner === "B");
  return {
    "最初の2本で失点": ownLost.filter(isOpeningPointLoss).length,
    "ゲームポイント付近で失点": ownLost.filter(isGamePointAreaLoss).length,
    "デュース以降で失点": ownLost.filter(isDeuceOrLaterLoss).length,
    "サービス/レシーブ失点": ownLost.filter((point) => ["ダブルフォールト", "レシーブミス"].includes(point.outcome)).length
  };
}

function getScoringSituationCounts() {
  const ownWon = state.points.filter((point) => point.winner === "A");
  return {
    "自チーム得点パターン": ownWon.filter((point) => isScoringOutcome(point.outcome)).length,
    "相手ミスで得点": ownWon.filter((point) => isErrorOutcome(point.outcome)).length,
    "サービス/レシーブで得点": ownWon.filter((point) => ["サービス得点", "レシーブ得点", "ダブルフォールト", "レシーブミス"].includes(point.outcome)).length,
    "最初の2本で得点": ownWon.filter((point) => {
      const before = point.scoreBefore?.points || { A: 0, B: 0 };
      return (before.A || 0) + (before.B || 0) <= 1;
    }).length
  };
}

function getLosingSituationCounts() {
  const ownLost = state.points.filter((point) => point.winner === "B");
  return {
    "自チームミスで失点": ownLost.filter((point) => isErrorOutcome(point.outcome)).length,
    "相手得点パターン": ownLost.filter((point) => isScoringOutcome(point.outcome)).length,
    "サービス/レシーブ失点": ownLost.filter((point) => ["ダブルフォールト", "レシーブミス", "サービス得点", "レシーブ得点"].includes(point.outcome)).length,
    "最初の2本で失点": ownLost.filter(isOpeningPointLoss).length,
    "勝負どころで失点": ownLost.filter((point) => isGamePointAreaLoss(point) || isDeuceOrLaterLoss(point)).length
  };
}

function countByPlayer(points = state.points) {
  return points.reduce((acc, point) => {
    const label = playerLabel(point.player);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function getPlayerPlusMinusRosterItems() {
  return state.matchType === "singles"
    ? [
        { key: "A選手", label: displayName("A"), side: "A" },
        { key: "B選手", label: displayName("B"), side: "B" }
      ]
    : [
        { key: "A後衛", label: playerLabel("A後衛"), side: "A" },
        { key: "A前衛", label: playerLabel("A前衛"), side: "A" },
        { key: "B後衛", label: playerLabel("B後衛"), side: "B" },
        { key: "B前衛", label: playerLabel("B前衛"), side: "B" }
      ];
}

function playerSortOrder(labelOrKey) {
  const items = getPlayerPlusMinusRosterItems();
  const index = items.findIndex((item) => item.key === labelOrKey || item.label === labelOrKey);
  return index === -1 ? 99 : index;
}

function getPlayerPlusMinusRoster() {
  return getPlayerPlusMinusRosterItems().map((item) => item.label);
}

function playerSideFromKey(key) {
  return String(key || "").startsWith("A") ? "A" : String(key || "").startsWith("B") ? "B" : "";
}

function getPlayerPlusMinus() {
  const emptyStats = (item) => ({ ...item, plus: 0, minus: 0, outcomes: {}, shots: {} });
  const roster = getPlayerPlusMinusRosterItems();
  const counts = Object.fromEntries(roster.map((item) => [item.key, emptyStats(item)]));
  state.points.forEach((point) => {
    const key = normalizePlayerKey(point.player || "不明");
    if (!key || key === "不明" || key === "未設定" || key === "未記録") return;
    const rosterItem = roster.find((item) => item.key === key) || { key, label: playerLabel(key), side: playerSideFromKey(key) };
    if (!rosterItem.label || rosterItem.label === "不明" || rosterItem.label === "未設定" || rosterItem.label === "未記録") return;
    counts[key] = counts[key] || emptyStats(rosterItem);
    if (isScoringOutcome(point.outcome)) counts[key].plus += 1;
    if (isErrorOutcome(point.outcome)) counts[key].minus += 1;
    const outcome = point.outcome || "内容不明";
    counts[key].outcomes[outcome] = (counts[key].outcomes[outcome] || 0) + 1;
    const shot = point.shot && point.shot !== "不明" ? point.shot : "";
    if (shot) counts[key].shots[shot] = (counts[key].shots[shot] || 0) + 1;
  });

  return Object.values(counts)
    .map((value) => {
      const outcomeEntries = Object.entries(value.outcomes || {})
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
      const shotEntries = Object.entries(value.shots || {})
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
      return {
        key: value.key,
        label: value.label,
        side: value.side,
        plus: value.plus,
        minus: value.minus,
        diff: value.plus - value.minus,
        outcomes: outcomeEntries,
        shots: shotEntries
      };
    })
    .sort((a, b) => playerSortOrder(a.key) - playerSortOrder(b.key) || b.plus + b.minus - (a.plus + a.minus));
}

function getTopPlayerPlusMinusLabel() {
  const entries = getPlayerPlusMinus();
  if (!entries.length || entries.every((entry) => entry.plus === 0 && entry.minus === 0)) return "未記録";
  const top = [...entries].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.plus + b.minus - (a.plus + a.minus))[0];
  return `${top.label} +${top.plus} / -${top.minus} / ${formatContributionDiff(top.diff)}`;
}

function getPlayerPlusMinusRows() {
  return getPlayerPlusMinus().map((entry) => [entry.label, `+${entry.plus} / -${entry.minus} / ${formatContributionDiff(entry.diff)}`, entry.diff > 0 ? "own" : entry.diff < 0 ? "opp" : "neutral"]);
}

function getPlayerPlayRows(limit = 5) {
  return getPlayerPlusMinus().map((entry) => {
    const total = entry.outcomes.reduce((sum, [, value]) => sum + value, 0);
    if (!total) return [entry.label, "記録なし", "neutral"];
    const top = entry.outcomes.slice(0, limit).map(([label, value]) => `${label} ${value}本`);
    const rest = entry.outcomes.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    if (rest) top.push(`ほか ${rest}本`);
    return [entry.label, top.join(" / "), entry.diff > 0 ? "own" : entry.diff < 0 ? "opp" : "neutral"];
  });
}

function getPlayerReviewRows() {
  const serveReceiveByPlayer = Object.fromEntries(getPlayerServeReceiveStats().map((item) => [item.player, item]));
  return getPlayerPlusMinus().map((item) => {
    const decorated = { ...item, serveReceive: serveReceiveByPlayer[item.key] };
    const tone = item.diff > 0 ? "own" : item.diff < 0 ? "opp" : "neutral";
    return [item.label, buildPlayerReviewItems(decorated).join(" / "), tone];
  });
}

function formatPointLocation(point) {
  if (!point) return "場面なし";
  const before = point.scoreBefore?.points || { A: 0, B: 0 };
  return `${gameNumberLabel(historyGameNumber(point))} ${before.A || 0}-${before.B || 0}`;
}

function inferScoreAfterPoints(point) {
  const before = point?.scoreBefore?.points || { A: 0, B: 0 };
  const after = { A: before.A || 0, B: before.B || 0 };
  if (point?.winner === "A" || point?.winner === "B") {
    after[point.winner] += 1;
  }
  return after;
}

function formatPointEndLocation(point) {
  if (!point) return "場面なし";
  const afterGames = point.scoreAfter?.games || point.scoreBefore?.games || { A: 0, B: 0 };
  const after = point.scoreAfter?.points || inferScoreAfterPoints(point);
  return `${gameNumberLabel(getGameNumber(afterGames))} ${after.A || 0}-${after.B || 0}`;
}

function formatPointLocations(points = [], limit = 3) {
  const locations = points.map(formatPointLocation);
  const unique = [...new Set(locations)].filter(Boolean);
  if (!unique.length) return "該当なし";
  const visible = unique.slice(0, limit).join("、");
  return unique.length > limit ? `${visible}、ほか${unique.length - limit}件` : visible;
}

function getGameOpeningStats() {
  const openings = state.points.filter((point) => {
    const before = point.scoreBefore?.points || { A: 0, B: 0 };
    return (before.A || 0) === 0 && (before.B || 0) === 0;
  });
  const ownPoints = openings.filter((point) => point.winner === "A");
  const oppPoints = openings.filter((point) => point.winner === "B");
  return { own: ownPoints.length, opp: oppPoints.length, total: openings.length, rate: openings.length ? Math.round((ownPoints.length / openings.length) * 100) : null, ownPoints, oppPoints, points: openings };
}

function getStreakDetails() {
  const streaks = [];
  let current = null;
  state.points.forEach((point, index) => {
    if (!current || current.side !== point.winner) {
      if (current) streaks.push(current);
      current = { side: point.winner, count: 1, start: index + 1, end: index + 1, points: [point], outcomes: [point.outcome || "内容不明"] };
    } else {
      current.count += 1;
      current.end = index + 1;
      current.points.push(point);
      current.outcomes.push(point.outcome || "内容不明");
    }
  });
  if (current) streaks.push(current);
  const bySide = (side) => streaks.filter((streak) => streak.side === side).sort((a, b) => b.count - a.count || a.start - b.start)[0] || null;
  return { own: bySide("A"), opp: bySide("B"), all: streaks };
}

function formatStreakRange(streak) {
  if (!streak) return "該当なし";
  const start = formatPointLocation(streak.points[0]);
  const end = formatPointEndLocation(streak.points[streak.points.length - 1]);
  return start === end ? start : `${start}→${end}`;
}

function formatStreak(streak) {
  if (!streak) return "0本";
  const topOutcome = topEntry(streak.outcomes.reduce((acc, outcome) => {
    acc[outcome] = (acc[outcome] || 0) + 1;
    return acc;
  }, {}));
  const range = formatStreakRange(streak);
  return `${streak.count}本 (${range} / ${topOutcome[0]})`;
}

function oppositeSide(side) {
  return side === "A" ? "B" : "A";
}

function isGamePointOpportunity(point, side) {
  const before = point.scoreBefore?.points || { A: 0, B: 0 };
  const target = getPointTargetForRecordedPoint(point);
  return RULES.winsCurrentGameOnNextPoint({ ...state, gamePoints: before }, side) || ((before[side] || 0) >= target - 1 && (before[side] || 0) - (before[oppositeSide(side)] || 0) >= 1);
}

function isMatchPointOpportunity(point, side) {
  if (!isGamePointOpportunity(point, side)) return false;
  const beforeGames = point.scoreBefore?.games || { A: 0, B: 0 };
  const gamesToWin = state.gamesToWin || gamesToWinFromFormat(state.matchFormat);
  return (beforeGames[side] || 0) >= gamesToWin - 1;
}

function getClutchStats() {
  return state.points.reduce((acc, point) => {
    ["A", "B"].forEach((side) => {
      const missed = point.winner !== side;
      const matchPoint = isMatchPointOpportunity(point, side);
      const gamePoint = isGamePointOpportunity(point, side);
      if (gamePoint && !matchPoint && missed) {
        if (side === "A") {
          acc.ownGamePointMissed += 1;
          acc.ownGamePointMissedPoints.push(point);
        } else {
          acc.oppGamePointMissed += 1;
          acc.oppGamePointMissedPoints.push(point);
        }
      }
      if (matchPoint && missed) {
        if (side === "A") {
          acc.ownMatchPointMissed += 1;
          acc.ownMatchPointMissedPoints.push(point);
        } else {
          acc.oppMatchPointMissed += 1;
          acc.oppMatchPointMissedPoints.push(point);
        }
      }
    });
    return acc;
  }, { ownGamePointMissed: 0, oppGamePointMissed: 0, ownMatchPointMissed: 0, oppMatchPointMissed: 0, ownGamePointMissedPoints: [], oppGamePointMissedPoints: [], ownMatchPointMissedPoints: [], oppMatchPointMissedPoints: [] });
}

function getMomentumRows() {
  const opening = getGameOpeningStats();
  const streaks = getStreakDetails();
  const clutch = getClutchStats();
  return [
    ["1ポイント目取得", opening.rate === null ? "-" : `${opening.own}/${opening.total}本 (${opening.rate}%)`, "own", "各ゲームの入りを確認", `取った: ${formatPointLocations(opening.ownPoints)} / 取られた: ${formatPointLocations(opening.oppPoints)}`],
    ["最長連続得点", formatStreak(streaks.own), "own", "連続して取れた場面", streaks.own ? `発生: ${formatStreakRange(streaks.own)}` : "発生: 該当なし"],
    ["最長連続失点", formatStreak(streaks.opp), "opp", "連続して取られた場面", streaks.opp ? `発生: ${formatStreakRange(streaks.opp)}` : "発生: 該当なし"],
    ["ゲームポイント逸失", `${clutch.ownGamePointMissed}回`, clutch.ownGamePointMissed ? "opp" : "neutral", "ゲームを取れる場面で与えた数", `発生: ${formatPointLocations(clutch.ownGamePointMissedPoints)}`],
    ["マッチポイント逸失", `${clutch.ownMatchPointMissed}回`, clutch.ownMatchPointMissed ? "opp" : "neutral", "試合を終わらせる場面で与えた数", `発生: ${formatPointLocations(clutch.ownMatchPointMissedPoints)}`]
  ];
}

function getServeReceiveRows() {
  const rows = [];
  const addSide = (side, label) => {
    const servePoints = state.points.filter((point) => point.server === side);
    const firstServe = servePoints.filter((point) => point.serveStart === "第1サービスで開始").length;
    const doubleFaults = servePoints.filter((point) => point.outcome === "ダブルフォールト" && point.winner !== side).length;
    const receiveMisses = state.points.filter((point) => point.server !== side && point.outcome === "レシーブミス" && point.winner !== side).length;
    rows.push([`${label} 第1サービス`, servePoints.length ? `${firstServe}/${servePoints.length}本 (${Math.round((firstServe / servePoints.length) * 100)}%)` : "-"]);
    rows.push([`${label} DF`, `${doubleFaults}本`]);
    rows.push([`${label} レシーブミス`, `${receiveMisses}本`]);
  };
  addSide("A", displayName("A"));
  addSide("B", displayName("B"));
  rows.push(...getPlayerServeReceiveRows());
  return rows;
}

function getPlayerServeReceiveStats() {
  const roster = getPlayerPlusMinusRosterItems();
  const plusMinusByKey = Object.fromEntries(getPlayerPlusMinus().map((entry) => [entry.key, entry]));

  return roster.map((item) => {
    const player = item.key;
    const side = item.side;
    const label = item.label;
    const servePoints = state.points.filter((point) => normalizePlayerKey(point.serverPlayer) === player);
    const receivePoints = state.points.filter((point) => normalizePlayerKey(point.receiverPlayer) === player);
    const firstServe = servePoints.filter((point) => point.serveStart === "第1サービスで開始").length;
    const doubleFaults = servePoints.filter((point) => point.outcome === "ダブルフォールト" && point.winner !== side).length;
    const serveScores = servePoints.filter((point) => point.outcome === "サービス得点" && point.winner === side).length;
    const receiveMisses = receivePoints.filter((point) => point.outcome === "レシーブミス" && point.winner !== side).length;
    const receiveScores = receivePoints.filter((point) => point.outcome === "レシーブ得点" && point.winner === side).length;
    const receiveKeep = receivePoints.length ? receivePoints.length - receiveMisses : 0;
    const firstServeRate = servePoints.length ? Math.round((firstServe / servePoints.length) * 100) : null;
    const receiveKeepRate = receivePoints.length ? Math.round((receiveKeep / receivePoints.length) * 100) : null;
    const plusMinus = plusMinusByKey[player] || { plus: 0, minus: 0, diff: 0 };
    return {
      player,
      label,
      side,
      tone: side === "A" ? "own" : "opp",
      servePoints: servePoints.length,
      firstServe,
      firstServeRate,
      doubleFaults,
      serveScores,
      receivePoints: receivePoints.length,
      receiveKeep,
      receiveKeepRate,
      receiveScores,
      receiveMisses,
      plus: plusMinus.plus,
      minus: plusMinus.minus,
      diff: plusMinus.diff
    };
  });
}

function getPlayerServeReceiveRows() {
  return getPlayerServeReceiveStats().map((item) => {
    const serveText = item.servePoints
      ? `第1サービス ${item.firstServe}/${item.servePoints}本 (${item.firstServeRate}%)・DF ${item.doubleFaults}本・サーブ得点 ${item.serveScores}本`
      : "S 未記録";
    const receiveText = item.receivePoints
      ? `レシーブ成功 ${item.receiveKeep}/${item.receivePoints}本 (${item.receiveKeepRate}%)・レシーブ得点 ${item.receiveScores}本・レシーブミス ${item.receiveMisses}本`
      : "R 未記録";
    return [item.label, `${serveText} / ${receiveText}`, item.tone];
  });
}

function getTopPlayerServeReceiveLabel() {
  const rows = getPlayerServeReceiveRows();
  const recorded = rows.filter(([, value]) => value !== "S 未記録 / R 未記録");
  if (!recorded.length) return "未記録";
  return recorded.slice(0, 2).map(([label, value]) => `${label}: ${value}`).join(" / ");
}

function buildPlayerAnalysisMemoItems(limit = 8) {
  const serveReceiveByPlayer = Object.fromEntries(getPlayerServeReceiveStats().map((item) => [item.player, item]));
  const entries = getPlayerPlusMinus()
    .map((item) => ({ ...item, serveReceive: serveReceiveByPlayer[item.key] }))
    .filter((item) => {
      const sr = item.serveReceive || {};
      return item.plus + item.minus > 0 || (sr.servePoints || 0) + (sr.receivePoints || 0) > 0;
    })
    .sort((a, b) => {
      const aSr = (a.serveReceive?.servePoints || 0) + (a.serveReceive?.receivePoints || 0);
      const bSr = (b.serveReceive?.servePoints || 0) + (b.serveReceive?.receivePoints || 0);
      return (Math.abs(b.diff) + bSr) - (Math.abs(a.diff) + aSr);
    });

  const items = entries.flatMap((item) => {
    const label = item.label;
    return buildPlayerReviewItems(item).slice(0, 2).map((text) => `${label}: ${text}`);
  });
  const uniqueItems = uniqueAdviceItems(items).slice(0, limit);
  return uniqueItems.length ? uniqueItems : ["まだ個人別コメントはありません。プレイヤー付きで記録すると保存できます"];
}

function saveAnalysisMemo() {
  const items = buildPlayerAnalysisMemoItems();
  const memo = {
    at: new Date().toISOString(),
    pointCount: state.points.length,
    games: { ...state.games },
    points: { ...state.gamePoints },
    quickItems: items,
    reviewItems: [],
    items
  };
  state.analysisMemos = [memo, ...(state.analysisMemos || [])].slice(0, 12);
  syncCurrentArchive("auto-analysis");
  saveState();
  return memo;
}

function buildPlayerReviewItems(item) {
  const serveReceive = item.serveReceive || {};
  const scoring = item.outcomes.filter(([label]) => isScoringOutcome(label))[0] || ["", 0];
  const error = item.outcomes.filter(([label]) => isErrorOutcome(label))[0] || ["", 0];
  const shot = item.shots[0] || ["", 0];
  const total = item.plus + item.minus;
  const items = [];
  const isOwn = item.side === "A";

  if (!total && !(serveReceive.servePoints || serveReceive.receivePoints)) {
    return ["記録なし。まだ傾向は判断しない"];
  }

  if (item.diff < 0) {
    items.push(isOwn
      ? `+${item.plus}/-${item.minus}。この選手の記録では、相手に与えた点が${Math.abs(item.diff)}本多い`
      : `+${item.plus}/-${item.minus}。この相手選手の記録では、自チームが取った点が${Math.abs(item.diff)}本多い`);
  } else if (item.diff > 0) {
    items.push(isOwn
      ? `+${item.plus}/-${item.minus}。この選手の記録では、自チームが取った点が${item.diff}本多い`
      : `+${item.plus}/-${item.minus}。この相手選手の記録では、自チームが取られた点が${item.diff}本多い`);
  } else if (total) {
    items.push(`+${item.plus}/-${item.minus}。取った点と与えた点は同数`);
  }

  if (error[1] > 0) {
    items.push(isOwn
      ? `主に相手へ与えた形は、${error[0]} ${error[1]}本`
      : `この相手選手が主に自チームへ与えた形は、${error[0]} ${error[1]}本`);
  }
  if (scoring[1] > 0) {
    items.push(isOwn
      ? `主に取れた形は、${scoring[0]} ${scoring[1]}本`
      : `この相手選手に主に取られた形は、${scoring[0]} ${scoring[1]}本`);
  }
  if (serveReceive.doubleFaults > 0) {
    items.push(isOwn ? `サーブではDFで${serveReceive.doubleFaults}本与えた` : `この相手選手はDFで${serveReceive.doubleFaults}本与えた`);
  }
  if (serveReceive.receiveMisses > 0) {
    items.push(isOwn ? `レシーブではミスで${serveReceive.receiveMisses}本与えた` : `この相手選手はレシーブミスで${serveReceive.receiveMisses}本与えた`);
  }
  if (serveReceive.servePoints >= 2 && serveReceive.firstServeRate !== null) {
    items.push(`第1サービス ${serveReceive.firstServe}/${serveReceive.servePoints}本 (${serveReceive.firstServeRate}%)`);
  }
  if (serveReceive.receivePoints >= 2 && serveReceive.receiveKeepRate !== null) {
    items.push(`レシーブ成功 ${serveReceive.receiveKeep}/${serveReceive.receivePoints}本 (${serveReceive.receiveKeepRate}%)`);
  }
  if (shot[1] > 0 && items.length < 4) {
    items.push(`${shot[0]} ${shot[1]}本が多いプレー`);
  }
  if (!items.length) items.push("大きな偏りはまだ見えません。記録を続けて確認");
  return uniqueAdviceItems(items).slice(0, 4);
}

function buildPlayerInvolvementComment(item) {
  const total = item.plus + item.minus;
  const serveReceive = item.serveReceive || {};
  const scoring = item.outcomes.filter(([label]) => isScoringOutcome(label))[0] || ["", 0];
  const error = item.outcomes.filter(([label]) => isErrorOutcome(label))[0] || ["", 0];
  const srTotal = (serveReceive.servePoints || 0) + (serveReceive.receivePoints || 0);
  const isOwn = item.side === "A";
  const parts = [];

  if (!total && !srTotal) return "記録なし。役割評価ではなく、まず関わった本数を増やして確認する";

  parts.push(`関与 ${total}本（+${item.plus}/-${item.minus}/${formatContributionDiff(item.diff)}）`);
  if (item.diff > 0) parts.push(isOwn ? "この選手の記録では、自チームが取った点が多い" : "この相手選手の記録では、自チームが取られた点が多い");
  if (item.diff < 0) parts.push(isOwn ? "この選手の記録では、相手に与えた点が多い" : "この相手選手の記録では、自チームが取った点が多い");
  if (item.diff === 0 && total) parts.push("取った点と与えた点は同数");
  if (scoring[1] > 0) parts.push(isOwn ? `主に取れた形は${scoring[0]} ${scoring[1]}本` : `この相手選手に主に取られた形は${scoring[0]} ${scoring[1]}本`);
  if (error[1] > 0) parts.push(isOwn ? `主に相手へ与えた形は${error[0]} ${error[1]}本` : `この相手選手が主に自チームへ与えた形は${error[0]} ${error[1]}本`);
  if (srTotal) parts.push(`S/R関与 ${srTotal}本`);
  return parts.slice(0, 5).join("。") || "大きな偏りはまだ見えません";
}

function getPlayerInvolvementItems() {
  const serveReceiveByPlayer = Object.fromEntries(getPlayerServeReceiveStats().map((item) => [item.player, item]));
  return getPlayerPlusMinus().map((item) => {
    const decorated = { ...item, serveReceive: serveReceiveByPlayer[item.key] };
    return {
      ...decorated,
      tone: item.diff > 0 ? "own" : item.diff < 0 ? "opp" : "neutral",
      comment: buildPlayerInvolvementComment(decorated)
    };
  });
}

function formatRate(rate) {
  return rate === null ? "-" : `${rate}%`;
}

function historyFilterLabel(value) {
  return {
    all: "すべて",
    own: "自チーム得点",
    opp: "相手得点",
    errors: "ミスだけ",
    late: "ゲーム終盤"
  }[value] || "すべて";
}

function isLateGamePoint(point) {
  return point.phase === "ゲーム終盤" || isGamePointAreaLoss(point) || isDeuceOrLaterLoss(point);
}

function historyPhaseLabel(point) {
  if (isDeuceOrLaterLoss(point)) return "デュース以降";
  if (isGamePointAreaLoss(point)) return "ゲームポイント付近";
  return point.phase || "場面不明";
}

function historyGameNumber(point) {
  if (point.gameNumber) return point.gameNumber;
  const games = point.scoreBefore?.games || { A: 0, B: 0 };
  return (games.A || 0) + (games.B || 0) + 1;
}

function historyGameLabel(gameNumber) {
  return state.matchFormat === "final" ? "FG" : `${gameNumber}G`;
}

function getPointEditPlayerOptions() {
  if (state.matchType === "singles") {
    return [
      ["A選手", playerLabel("A選手")],
      ["B選手", playerLabel("B選手")],
      ["不明", "不明"]
    ];
  }
  return [
    ["A後衛", playerLabel("A後衛")],
    ["A前衛", playerLabel("A前衛")],
    ["B後衛", playerLabel("B後衛")],
    ["B前衛", playerLabel("B前衛")],
    ["不明", "不明"]
  ];
}

function buildPointCsvRow(matchState, point = null, index = "") {
  const normalized = normalizeState(matchState || defaultState);
  const info = normalized.matchInfo || defaultState.matchInfo;
  const beforeGames = point?.scoreBefore?.games || { A: 0, B: 0 };
  const beforePoints = point?.scoreBefore?.points || { A: 0, B: 0 };
  return [
    index,
    info.date,
    info.timeOfDay,
    info.startTime,
    info.endTime,
    info.weather,
    info.temperature,
    info.wind,
    info.windSide,
    info.surface,
    info.courtCondition,
    normalized.matchType === "singles" ? "シングルス" : "ダブルス",
    info.opponentFormation,
    info.event,
    info.tournament,
    info.venueName,
    info.venue,
    matchFormatLabelFromState(normalized),
    point ? displayNameFromState(normalized, point.winner) : "",
    point ? displayNameFromState(normalized, point.server) : "",
    point ? playerLabelFromState(normalized, point.serverPlayer) : "",
    point ? playerLabelFromState(normalized, point.receiverPlayer) : "",
    point ? `${beforeGames.A || 0}-${beforeGames.B || 0}` : "",
    point ? `${beforePoints.A || 0}-${beforePoints.B || 0}` : "",
    point?.phase || "",
    point?.serveStart || "",
    point?.outcome || "",
    point?.result || "",
    point ? playerLabelFromState(normalized, point.player) : "",
    point?.shot || "",
    point?.hand || "",
    point?.course || "",
    point?.rally || "",
    point?.gameWonBy ? displayNameFromState(normalized, point.gameWonBy) : "",
    point?.memo || "",
    point?.at || ""
  ];
}

function buildPointCsvRows(matchState = state, { includeEmptyMatchRow = false } = {}) {
  const normalized = normalizeState(matchState || defaultState);
  const pointRows = normalized.points.map((point, index) => buildPointCsvRow(normalized, point, index + 1));
  if (!pointRows.length && includeEmptyMatchRow) {
    pointRows.push(buildPointCsvRow(normalized, null, ""));
  }
  return [POINT_CSV_HEADERS, ...pointRows];
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function downloadCsvRows(rows, fileName) {
  const blob = new Blob([`\ufeff${rowsToCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  downloadCsvRows(buildPointCsvRows(state), getCsvFileName());
}

function getArchivedCsvFileName(date = new Date()) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
  return `soft-tennis-archive-points-${timestamp}.csv`;
}

function buildArchivedCsvRows(archived = loadArchivedMatches()) {
  const rows = [ARCHIVE_CSV_HEADERS];
  archived.forEach((entry, matchIndex) => {
    const normalized = normalizeState(entry.state || defaultState);
    const pointRows = buildPointCsvRows(normalized, { includeEmptyMatchRow: true }).slice(1);
    const prefix = [matchIndex + 1, entry.id || "", entry.savedAt || "", entry.title || buildArchivedMatchTitle(normalized)];
    pointRows.forEach((row) => rows.push([...prefix, ...row]));
  });
  return rows;
}

function exportArchivedCsv() {
  const archived = loadArchivedMatches();
  if (!archived.length) return false;
  downloadCsvRows(buildArchivedCsvRows(archived), getArchivedCsvFileName());
  return true;
}

function getBackupFileName(date = new Date()) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
  return `soft-tennis-backup-${timestamp}.json`;
}

function createBackupPayload() {
  return {
    app: "soft-tennis-note",
    schemaVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    state: normalizeState(structuredClone(state)),
    archivedMatches: loadArchivedMatches().map((entry) => ({
      ...entry,
      state: normalizeState(structuredClone(entry.state || defaultState))
    }))
  };
}

function restoreBackupPayload(payload) {
  if (!isPlainObject(payload) || payload.app !== "soft-tennis-note") {
    throw new Error("このアプリの試合データではありません。");
  }
  const restoredState = normalizeState(payload.state || defaultState);
  const restoredArchived = Array.isArray(payload.archivedMatches)
    ? payload.archivedMatches.map((entry) => ({
        ...entry,
        id: entry.id || crypto.randomUUID?.() || `${Date.now()}`,
        savedAt: entry.savedAt || new Date().toISOString(),
        title: entry.title || buildArchivedMatchTitle(normalizeState(entry.state || defaultState)),
        pointCount: Number.isFinite(Number(entry.pointCount)) ? Number(entry.pointCount) : normalizeState(entry.state || defaultState).points.length,
        finished: !!entry.finished,
        state: normalizeState(entry.state || defaultState)
      }))
    : [];

  state = restoredState;
  saveArchivedMatches(restoredArchived);
  saveState();
  return { state: restoredState, archivedMatches: restoredArchived };
}

function exportBackupJson() {
  const json = JSON.stringify(createBackupPayload(), null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getBackupFileName();
  link.click();
  URL.revokeObjectURL(url);
}

function getGamePointScoreRows() {
  const rows = [];
  const byGame = state.points.reduce((acc, point) => {
    const gameNumber = point.gameNumber || getGameNumber(point.scoreBefore?.games || { A: 0, B: 0 });
    if (!acc.has(gameNumber)) acc.set(gameNumber, []);
    acc.get(gameNumber).push(point);
    return acc;
  }, new Map());

  [...byGame.entries()].sort((a, b) => a[0] - b[0]).forEach(([gameNumber, points]) => {
    const last = points[points.length - 1];
    const before = last.scoreBefore?.points || { A: 0, B: 0 };
    const finalPoints = { A: before.A || 0, B: before.B || 0 };
    finalPoints[last.winner] += 1;
    rows.push([gameNumberLabel(gameNumber), `${finalPoints.A}-${finalPoints.B}`]);
  });

  const currentGameNumber = getGameNumber(state.games);
  if (!state.finished && !byGame.has(currentGameNumber)) {
    rows.push([gameNumberLabel(currentGameNumber), `${state.gamePoints.A}-${state.gamePoints.B}`]);
  }

  return rows.length ? rows : [[gameNumberLabel(currentGameNumber), "0-0"]];
}

function gameNumberLabel(gameNumber) {
  return state.matchFormat === "final" ? "FG" : `${gameNumber}G`;
}

function getCurrentTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "夜";
  if (hour < 9) return "朝";
  if (hour < 12) return "午前";
  if (hour < 13) return "昼";
  if (hour < 17) return "午後";
  if (hour < 19) return "夕方";
  return "夜";
}

function getCurrentClockTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getMatchTimeRange(info = state.matchInfo || defaultState.matchInfo) {
  const start = info.startTime || "";
  const end = info.endTime || "";
  if (start && end) return `${start}-${end}`;
  if (start) return `${start}開始`;
  if (end) return `${end}終了`;
  return "";
}

function getSummaryImageData() {
  const data = getAnalysisData();
  const phaseCounts = getPhaseCounts();
  const info = state.matchInfo || defaultState.matchInfo;
  const typeLabel = state.matchType === "singles" ? "シングルス" : "ダブルス";
  const opponentError = topEntry(countByOutcomeType("error", state.points.filter((point) => point.winner === "A")));
  const latestMemo = (state.analysisMemos || [])[0];
  const latestMemoDate = latestMemo ? new Date(latestMemo.at) : null;
  const latestMemoTime =
    latestMemoDate && !Number.isNaN(latestMemoDate.getTime())
      ? `${String(latestMemoDate.getHours()).padStart(2, "0")}:${String(latestMemoDate.getMinutes()).padStart(2, "0")}`
      : "";
  const latestMemoScore = latestMemo
    ? `G ${latestMemo.games?.A ?? 0}-${latestMemo.games?.B ?? 0} / P ${latestMemo.points?.A ?? 0}-${latestMemo.points?.B ?? 0}`
    : "";
  const winner = getWinnerTeam();
  const matchResultLabel = state.finished
    ? winner
      ? `${displayName(winner)}の勝ち`
      : "試合終了"
    : "試合中";
  const weather = [info.weather, info.temperature ? `${info.temperature}℃` : "", info.wind !== "未記録" ? `風:${info.wind}` : ""]
    .filter(Boolean)
    .filter((item) => item !== "未記録")
    .join(" / ");
  const court = [info.surface !== "未記録" ? info.surface : "", info.courtCondition !== "未記録" ? info.courtCondition : ""].filter(Boolean).join(" / ");
  const tournament = info.tournament && info.tournament !== "未記録" ? info.tournament : "";
  const venueName = info.venueName && info.venueName !== "未記録" ? info.venueName : "";
  const timeRange = getMatchTimeRange(info);
  const playerRows =
    state.matchType === "singles"
      ? [
          ["自分", displayName("A")],
          ["相手", displayName("B")]
        ]
      : [
          ["自チーム後衛", playerLabel("A後衛")],
          ["自チーム前衛", playerLabel("A前衛")],
          ["相手後衛", playerLabel("B後衛")],
          ["相手前衛", playerLabel("B前衛")]
        ];
  const conditionRows = [
    ["日時", [info.date || "日付未記録", info.timeOfDay !== "未記録" ? info.timeOfDay : "", timeRange].filter(Boolean).join(" / ")],
    ["大会名", tournament || "未記録"],
    ["開催地／会場", venueName || "未記録"],
    ["区分", info.event && info.event !== "未記録" ? info.event : "未記録"],
    ["天候・気温", [info.weather !== "未記録" ? info.weather : "", info.temperature ? `${info.temperature}℃` : ""].filter(Boolean).join(" / ") || "未記録"],
    ["風", info.wind !== "未記録" ? info.wind : "未記録"],
    ["コート", [info.venue && info.venue !== "未記録" ? info.venue : "", court].filter(Boolean).join(" / ") || "未記録"],
    ["相手布陣", state.matchType === "singles" ? "シングルス" : info.opponentFormation || "不明"]
  ];

  const openingStats = getGameOpeningStats();
  const streakStats = getStreakDetails();
  const clutchStats = getClutchStats();
  const playerPlusMinusRows = getPlayerPlusMinusRows();
  const playerPlayRows = getPlayerPlayRows(5);
  const playerReviewRows = getPlayerReviewRows();
  const playerInvolvementRows = getPlayerInvolvementItems().map((item) => [item.label, item.comment, item.tone, formatContributionDiff(item.diff)]);
  const playerServeReceiveStats = getPlayerServeReceiveStats().map((item) => ({
    label: item.label,
    tone: item.tone,
    plus: item.plus,
    minus: item.minus,
    diff: item.diff,
    servePoints: item.servePoints,
    firstServe: item.firstServe,
    firstServeRate: item.firstServeRate,
    doubleFaults: item.doubleFaults,
    serveScores: item.serveScores,
    receivePoints: item.receivePoints,
    receiveKeep: item.receiveKeep,
    receiveKeepRate: item.receiveKeepRate,
    receiveScores: item.receiveScores,
    receiveMisses: item.receiveMisses
  }));
  const pointBreakdownRows = [
    ["自分たちで取った", data.ownScoredByPattern, "own", "攻めて取れた点"],
    ["相手ミスで取った", data.ownPointsByOpponentError, "own", "相手のミスで取れた点"],
    ["ミスで与えた", data.ownLostByOwnError, "opp", "自分たちのミスで与えた点"]
  ];
  const openingTone = openingStats.total ? (openingStats.own >= openingStats.opp ? "own" : "opp") : "neutral";
  const openingMetric = openingStats.total ? `${openingStats.own}/${openingStats.total}本` : "未記録";
  const rallyStats = getRallyLengthStats();
  const rallyTotal = Math.max(1, rallyStats.recorded);
  const rallyTrendText = rallyStats.recorded ? `3本以内 ${rallyStats.short}/${rallyStats.recorded}本・4本以上 ${rallyStats.long}/${rallyStats.recorded}本` : "未記録";
  const flowRows = [
    ["1ポイント目取得率", openingStats.rate === null ? 0 : openingStats.rate, "own", openingStats.rate === null ? "記録なし" : `${openingStats.own}/${openingStats.total}`],
    ["最長連続得点", streakStats.own?.count || 0, "own", formatStreak(streakStats.own)],
    ["最長連続失点", streakStats.opp?.count || 0, "opp", formatStreak(streakStats.opp)],
    ["GP逸失", clutchStats.ownGamePointMissed, clutchStats.ownGamePointMissed ? "opp" : "neutral", `${clutchStats.ownGamePointMissed}回`],
    ["MP逸失", clutchStats.ownMatchPointMissed, clutchStats.ownMatchPointMissed ? "opp" : "neutral", `${clutchStats.ownMatchPointMissed}回`]
  ];
  const uniqueActionPlanRows = buildActionPlanRows(data, { limit: 6 });

  return {
    title: "ソフトテニスIQ｜試合ノート",
    subtitle: `${typeLabel} / ${matchFormatLabel()}`,
    teams: `${displayName("A")}  vs  ${displayName("B")}`,
    playerRows,
    playerPlusMinusRows,
    playerPlayRows,
    playerReviewRows,
    playerInvolvementRows,
    playerServeReceiveStats,
    pointBreakdownRows,
    flowRows,
    actionPlanRows: uniqueActionPlanRows,
    gameScore: `${state.games.A}-${state.games.B}`,
    currentPointScore: state.finished ? "終了" : `${pointLabel("A")}-${pointLabel("B")}`,
    gameScoreRows: getGamePointScoreRows(),
    conditionRows,
    meta: [
      info.date || "日付未記録",
      info.timeOfDay !== "未記録" ? info.timeOfDay : "",
      timeRange,
      weather,
      court,
      info.event !== "未記録" ? info.event : "",
      tournament,
      venueName,
      info.venue !== "未記録" ? info.venue : ""
    ].filter(Boolean),
    summaryRows: [
      ["ゲーム最初の1本", openingMetric, openingTone],
      ["ミスで与えた", data.ownLostByOwnError, "opp"],
      ["自分たちで取った", data.ownScoredByPattern, "own"],
      ["相手ミスで取った", data.ownPointsByOpponentError, "own"],
      ["記録ポイント", data.total, "neutral"],
      ["選手別 貢献差", getTopPlayerPlusMinusLabel(), "neutral"],
      ["選手別S/R", getTopPlayerServeReceiveLabel(), "neutral"],
      ["最長連続得点", streakStats.own ? `${streakStats.own.count}本` : "0本", "own"],
      ["最長連続失点", streakStats.opp ? `${streakStats.opp.count}本` : "0本", "opp"],
      ["3本以内", rallyStats.recorded ? `${rallyStats.short}/${rallyStats.recorded}本` : "未記録", "neutral"],
      ["4本以上", rallyStats.recorded ? `${rallyStats.long}/${rallyStats.recorded}本` : "未記録", "neutral"]
    ],
    resultRows: [
      ["試合結果", matchResultLabel],
      ["ゲームスコア", state.finished ? `${state.games.A}-${state.games.B}` : `途中 ${state.games.A}-${state.games.B}`],
      ["現在ポイント", state.finished ? "終了" : `${pointLabel("A")}-${pointLabel("B")}`],
      ["各ゲーム", getGamePointScoreRows().slice(0, 9).map(([label, score]) => `${label} ${score}`).join(" / ")]
    ],
    analysisComments: buildSummaryComments(data),
    quickTitle: latestMemo ? `次に活かすポイント ${[latestMemoTime, latestMemoScore].filter(Boolean).join(" ")}` : "次に活かすポイント",
    quickItems: latestMemo ? (latestMemo.quickItems || []) : buildQuickCoachItems(data),
    reviewTitle: "",
    reviewItems: latestMemo ? (latestMemo.reviewItems || latestMemo.items || []) : buildPriorityItems(),
    analysisMemoTitle: latestMemo ? `保存した分析 ${[latestMemoTime, latestMemoScore].filter(Boolean).join(" ")}` : "次に活かすポイント",
    analysisMemoItems: latestMemo ? [...(latestMemo.quickItems || []), ...(latestMemo.reviewItems || latestMemo.items || [])].slice(0, 4) : [...buildQuickCoachItems(data), ...buildPriorityItems()].slice(0, 4),
    priorityItems: latestMemo ? [...(latestMemo.quickItems || []), ...(latestMemo.reviewItems || latestMemo.items || [])].slice(0, 4) : buildPriorityItems(),
    detailRows: [
      ["主な得点パターン", `${data.topScore[0]} ${data.topScore[1]}`],
      ["相手の主なミス", `${opponentError[0]} ${opponentError[1]}`],
      ["主な失点ミス", `${data.topError[0]} ${data.topError[1]}`],
      ["第1サービス開始率", data.firstServeRate === null ? "-" : `${data.firstServeRate}%`],
      ["ダブルフォールト", data.ownDoubleFaults],
      ["レシーブミス", data.ownReceiveMisses],
      ["選手別S/R", getTopPlayerServeReceiveLabel()],
      ["1ポイント目取得率", openingStats.rate === null ? "-" : `${openingStats.rate}% (${openingStats.own}/${openingStats.total})`],
      ["最長連続得点", formatStreak(streakStats.own)],
      ["最長連続失点", formatStreak(streakStats.opp)],
      ["ゲームポイント逸失", `${clutchStats.ownGamePointMissed}回`],
      ["マッチポイント逸失", `${clutchStats.ownMatchPointMissed}回`],
      ["ラリーの長さ", rallyTrendText],
      ["3本以内率", rallyStats.recorded ? `${Math.round((rallyStats.short / rallyTotal) * 100)}% (${rallyStats.short}/${rallyStats.recorded})` : "-"],
      ["最初の2本で失点", data.ownEarlyLost]
    ],
    phaseRows: Object.entries(phaseCounts).filter(([, value]) => value > 0)
  };
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = [...String(text)];
  let line = "";
  let cursorY = y;
  chars.forEach((char) => {
    const nextLine = line + char;
    if (line && ctx.measureText(nextLine).width > maxWidth) {
      ctx.fillText(line, x, cursorY);
      line = char;
      cursorY += lineHeight;
    } else {
      line = nextLine;
    }
  });
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

function fitText(ctx, text, maxWidth) {
  const suffix = "...";
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  const chars = [...value];
  while (chars.length && ctx.measureText(`${chars.join("")}${suffix}`).width > maxWidth) {
    chars.pop();
  }
  return `${chars.join("")}${suffix}`;
}

function drawClampedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 1) {
  const chars = [...String(text ?? "")];
  const lines = [];
  let line = "";

  for (const char of chars) {
    const nextLine = line + char;
    if (line && ctx.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else {
      line = nextLine;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (chars.join("") !== lines.join("")) {
    lines[lines.length - 1] = fitText(ctx, lines[lines.length - 1], maxWidth);
  }

  lines.slice(0, maxLines).forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 2) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  roundedRect(ctx, x, y, width, height, radius);
  ctx.stroke();
}

function drawSummaryImage(canvas, summary, mode = "detail", nameMode = "role") {
  let ctx = canvas.getContext("2d");
  const width = 1080;
  const isShareMode = mode === "share";
  const pageHeight = isShareMode ? 1800 : 1500;
  const pageCount = isShareMode ? 1 : 6;
  const height = pageHeight * pageCount;
  const ownColor = "#1f6b4f"; // 自チーム＝コートの緑（明るい紙の上で読める濃さ）
  const oppColor = "#c2413a"; // 相手・失点＝赤
  const neutralColor = "#0e1a2b"; // ナイター（ブランドの濃紺）
  const inkColor = "#0e1a2b";
  const mutedColor = "#4d5d70";
  const lineColor = "#d5ddd6";
  const softLineColor = "#e9eee9";
  const paperColor = "#ffffff";
  const paperStrongColor = "#f6fadf"; // ボールの黄緑をうすく
  const appBgColor = "#eef2ec";
  const ownSoftColor = "#e8f3ec";
  const oppSoftColor = "#fbeceb";
  const neutralSoftColor = "#eef1f5";
  const pageMargin = 56;
  const contentWidth = width - pageMargin * 2;
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = appBgColor;
  ctx.fillRect(0, 0, width, height);

  const textColor = (tone) => (tone === "own" ? ownColor : tone === "opp" ? oppColor : tone === "neutral" ? neutralColor : inkColor);
  const badgeColor = (tone) => (tone === "own" ? ownColor : tone === "opp" ? oppColor : inkColor);
  const softColor = (tone) => (tone === "own" ? ownSoftColor : tone === "opp" ? oppSoftColor : neutralSoftColor);
  const setFont = (size, weight = 800) => {
    ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif`;
  };
  const drawText = (text, x, y, options = {}) => {
    const size = options.size || 28;
    const weight = options.weight || 800;
    const lineHeight = options.lineHeight || Math.round(size * 1.45);
    const maxLines = options.maxLines || 1;
    const maxWidth = options.maxWidth || contentWidth;
    ctx.fillStyle = options.color || inkColor;
    setFont(size, weight);
    return drawClampedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) + (options.after || 0);
  };
  const drawWhiteBadge = (text, x, y, w, h, tone = "neutral", size = 22) => {
    fillRoundedRect(ctx, x, y, w, h, Math.min(18, h / 2), badgeColor(tone));
    strokeRoundedRect(ctx, x, y, w, h, Math.min(18, h / 2), "rgba(255,255,255,0.82)", 2);
    drawText(text, x + 12, y + Math.round(h * 0.66), { size, weight: 1000, color: "#ffffff", maxWidth: w - 24 });
  };
  const plusMinusValueParts = (value) => {
    const text = String(value || "");
    return {
      plus: text.match(/\+\d+/)?.[0] || "+0",
      minus: text.match(/-\d+/)?.[0] || "-0",
      total: text.split("/").map((part) => part.trim()).at(-1) || text
    };
  };
  const sections = [];
  const pageTop = (pageIndex) => pageIndex * pageHeight;
  const pageFooter = (pageIndex) => {
    const base = pageTop(pageIndex);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageMargin, base + pageHeight - 110);
    ctx.lineTo(width - pageMargin, base + pageHeight - 110);
    ctx.stroke();
    ctx.fillStyle = mutedColor;
    setFont(22, 800);
    const footer = ["端末内で画像生成。開発者や管理者へ送られません。", `${pageIndex + 1}/${pageCount}`].join(" / ");
    drawClampedText(ctx, footer, pageMargin, base + pageHeight - 72, contentWidth, 30, 1);
  };
  const pageHeader = (pageIndex, title, subtitle = "") => {
    const base = pageTop(pageIndex);
    ctx.fillStyle = paperColor;
    ctx.fillRect(24, base + 24, width - 48, pageHeight - 48);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    roundedRect(ctx, 24, base + 24, width - 48, pageHeight - 48, 18);
    ctx.stroke();
    fillRoundedRect(ctx, pageMargin, base + 48, contentWidth, 8, 4, neutralColor);
    fillRoundedRect(ctx, pageMargin, base + 48, contentWidth * 0.34, 8, 4, ownColor);
    fillRoundedRect(ctx, pageMargin + contentWidth * 0.68, base + 48, contentWidth * 0.32, 8, 4, oppColor);
    let y = base + 82;
    y = drawText(title, pageMargin, y, { size: 42, weight: 900, lineHeight: 52, after: 4 });
    if (subtitle) y = drawText(subtitle, pageMargin, y, { size: 24, weight: 800, color: mutedColor, lineHeight: 32, after: 8 });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageMargin, y + 4);
    ctx.lineTo(width - pageMargin, y + 4);
    ctx.stroke();
    return y + 38;
  };
  const heading = (text, y) => {
    sections.push(text);
    fillRoundedRect(ctx, pageMargin, y - 28, 9, 34, 5, neutralColor);
    return drawText(text, pageMargin + 22, y, { size: 32, weight: 900, lineHeight: 42, after: 10 });
  };
  const paragraph = (text, y, tone = "neutral") => drawText(text, pageMargin, y, { size: 25, weight: 800, lineHeight: 36, color: textColor(tone), maxLines: 3, after: 10 });
  const bullet = (text, y, tone = "neutral", maxLines = 1) => {
    fillRoundedRect(ctx, pageMargin + 14, y - 21, 10, 10, 5, textColor(tone));
    return drawText(text, pageMargin + 40, y, { size: 25, lineHeight: 34, maxLines, color: textColor(tone), after: 4 });
  };
  const drawRows = (rows, y, options = {}) => {
    rows.forEach(([label, value, tone]) => {
      y = bullet(`${label}: ${value}`, y, tone || "neutral", options.maxLinesByLabel?.[label] || 1);
    });
    return y;
  };
  const drawItems = (items, y, limit, maxLines = 2) => {
    items.slice(0, limit).forEach((item) => {
      y = bullet(item, y, "neutral", maxLines);
    });
    return y;
  };
  const drawPanel = (title, note, y, tone = "neutral") => {
    fillRoundedRect(ctx, pageMargin, y, contentWidth, 136, 14, paperColor);
    strokeRoundedRect(ctx, pageMargin, y, contentWidth, 136, 14, lineColor, 2);
    fillRoundedRect(ctx, pageMargin + 18, y + 20, 8, 96, 4, textColor(tone));
    drawText(title, pageMargin + 42, y + 40, { size: 29, weight: 900, color: textColor(tone), maxWidth: contentWidth - 66 });
    drawText(note, pageMargin + 42, y + 78, { size: 23, weight: 800, color: mutedColor, lineHeight: 30, maxWidth: contentWidth - 66, maxLines: 2 });
    return y + 158;
  };
  const drawActionPlan = (rows, y) => {
    const actionRows = rows.length ? rows : [["まず記録を増やす", "数ポイント記録すると、確認できる傾向が表示されます", "neutral"]];
    actionRows.slice(0, 6).forEach(([title, note, tone], index) => {
      y = drawPanel(`${index + 1}. ${title}`, note, y, tone || "neutral");
    });
    return y;
  };
  const drawHorizontalBar = (label, value, total, y, tone = "neutral", note = "") => {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeValue = Math.max(0, Number(value) || 0);
    const rate = Math.min(1, safeValue / safeTotal);
    const barX = pageMargin + 250;
    const barY = y - 24;
    const barW = contentWidth - 370;
    drawText(label, pageMargin, y, { size: 24, weight: 900, maxWidth: 220, color: textColor(tone) });
    fillRoundedRect(ctx, barX, barY, barW, 24, 12, "#e5e7eb");
    fillRoundedRect(ctx, barX, barY, Math.max(8, barW * rate), 24, 12, textColor(tone));
    drawText(String(value), barX + barW + 18, y, { size: 24, weight: 900, maxWidth: 80, color: textColor(tone) });
    if (note) drawText(note, barX, y + 28, { size: 20, weight: 800, color: mutedColor, maxWidth: barW + 90 });
    return y + 64;
  };
  const drawStackedBar = (rows, y) => {
    const total = Math.max(1, rows.reduce((sum, [, value]) => sum + (Number(value) || 0), 0));
    let x = pageMargin;
    const barW = contentWidth;
    rows.forEach(([label, value, tone]) => {
      const segmentWidth = Math.max(value > 0 ? 10 : 0, barW * ((Number(value) || 0) / total));
      if (segmentWidth > 0) {
        fillRoundedRect(ctx, x, y, segmentWidth, 42, 10, textColor(tone));
        x += segmentWidth;
      }
    });
    y += 80;
    rows.forEach(([label, value, tone, note]) => {
      y = drawHorizontalBar(label, value, total, y, tone, note);
    });
    return y;
  };
  const drawScoreBoard = (y) => {
    sections.push("試合結果");
    fillRoundedRect(ctx, pageMargin, y, contentWidth, 210, 16, paperStrongColor);
    strokeRoundedRect(ctx, pageMargin, y, contentWidth, 210, 14, lineColor, 2);
    fillRoundedRect(ctx, pageMargin + 22, y + 22, 8, 166, 4, neutralColor);
    drawText(summary.teams, pageMargin + 44, y + 42, { size: 29, weight: 900, maxWidth: contentWidth - 66 });
    drawText(`ゲーム ${summary.gameScore}　ポイント ${summary.currentPointScore}`, pageMargin + 44, y + 92, { size: 42, weight: 900, color: inkColor, maxWidth: contentWidth - 66 });
    drawText(summary.resultRows.find(([label]) => label === "各ゲーム")?.[1] || "各ゲーム 未記録", pageMargin + 44, y + 146, { size: 24, weight: 800, color: mutedColor, maxWidth: contentWidth - 66, maxLines: 2, lineHeight: 32 });
    return y + 286;
  };
  const drawPlayerImpact = (y) => {
    const playByPlayer = Object.fromEntries((summary.playerPlayRows || []).map(([label, value]) => [label, value]));
    const reviewByPlayer = Object.fromEntries((summary.playerReviewRows || []).map(([label, value]) => [label, value]));
    const involvementByPlayer = Object.fromEntries((summary.playerInvolvementRows || []).map(([label, value]) => [label, value]));
    const max = Math.max(1, ...summary.playerPlusMinusRows.map(([, value]) => {
      const plus = Number(String(value).match(/\+(\d+)/)?.[1] || 0);
      const minus = Number(String(value).match(/-(\d+)/)?.[1] || 0);
      return Math.max(plus, minus);
    }));
    summary.playerPlusMinusRows.forEach(([label, value, tone]) => {
      const plus = Number(String(value).match(/\+(\d+)/)?.[1] || 0);
      const minus = Number(String(value).match(/-(\d+)/)?.[1] || 0);
      const totalText = plusMinusValueParts(value).total;
      const labelW = 220;
      const barX = pageMargin + labelW + 28;
      const barW = contentWidth - labelW - 300;
      fillRoundedRect(ctx, pageMargin, y, contentWidth, 222, 14, paperColor);
      strokeRoundedRect(ctx, pageMargin, y, contentWidth, 222, 12, lineColor, 2);
      fillRoundedRect(ctx, pageMargin + 16, y + 18, 7, 184, 4, textColor(tone));
      drawText(label, pageMargin + 36, y + 38, { size: 24, weight: 900, maxWidth: labelW - 12 });
      fillRoundedRect(ctx, barX, y + 22, barW, 18, 9, "#e5e7eb");
      fillRoundedRect(ctx, barX, y + 22, Math.max(plus > 0 ? 8 : 0, barW * (plus / max)), 18, 9, ownColor);
      drawText(`+${plus}`, barX + barW + 14, y + 39, { size: 22, weight: 900, color: ownColor, maxWidth: 72 });
      fillRoundedRect(ctx, barX, y + 56, barW, 18, 9, "#e5e7eb");
      fillRoundedRect(ctx, barX, y + 56, Math.max(minus > 0 ? 8 : 0, barW * (minus / max)), 18, 9, oppColor);
      drawText(`-${minus}`, barX + barW + 14, y + 73, { size: 22, weight: 900, color: oppColor, maxWidth: 72 });
      drawWhiteBadge(totalText, pageMargin + contentWidth - 188, y + 28, 164, 48, tone, 22);
      drawText(`内容: ${playByPlayer[label] || "記録なし"}`, pageMargin + 36, y + 104, { size: 19, weight: 800, color: mutedColor, maxWidth: contentWidth - 58, maxLines: 2, lineHeight: 25 });
      drawText(`関わり: ${involvementByPlayer[label] || reviewByPlayer[label] || "まだ傾向は判断しない"}`, pageMargin + 36, y + 154, { size: 19, weight: 900, color: textColor(tone), maxWidth: contentWidth - 58, maxLines: 2, lineHeight: 25 });
      y += 238;
    });
    return y;
  };
  const drawServeReceiveRow = (title, primary, secondary, tertiary, x, y, w, tone) => {
    fillRoundedRect(ctx, x + 18, y, w - 36, 64, 12, "rgba(255,253,247,0.92)");
    drawText(title, x + 32, y + 26, { size: 18, weight: 900, color: textColor(tone), maxWidth: 92 });
    drawText(primary, x + 124, y + 25, { size: 23, weight: 900, color: inkColor, maxWidth: w - 230 });
    drawText(secondary, x + 124, y + 51, { size: 17, weight: 800, color: mutedColor, maxWidth: w - 230 });
    drawText(tertiary, x + w - 100, y + 41, { size: 20, weight: 900, color: textColor(tone), maxWidth: 78 });
  };
  const drawServeReceiveCard = (item, x, y, w) => {
    fillRoundedRect(ctx, x, y, w, 250, 14, softColor(item.tone));
    strokeRoundedRect(ctx, x, y, w, 250, 14, lineColor, 2);
    fillRoundedRect(ctx, x + 16, y + 16, 7, 218, 4, textColor(item.tone));
    drawText(item.label, x + 34, y + 38, { size: 26, weight: 900, color: textColor(item.tone), maxWidth: w - 52 });
    drawText(`+${item.plus}`, x + 34, y + 82, { size: 22, weight: 900, color: ownColor, maxWidth: 64 });
    drawText(`-${item.minus}`, x + 102, y + 82, { size: 22, weight: 900, color: oppColor, maxWidth: 64 });
    drawWhiteBadge(formatContributionDiff(item.diff), x + 170, y + 50, 124, 42, item.tone, 18);
    const firstServe = item.servePoints ? `${item.firstServe}/${item.servePoints}本 (${formatRate(item.firstServeRate)})` : "未記録";
    const receiveKeep = item.receivePoints ? `${item.receiveKeep}/${item.receivePoints}本 (${formatRate(item.receiveKeepRate)})` : "未記録";
    drawServeReceiveRow("サーブ", `第1 ${firstServe}`, `DF ${item.doubleFaults}本`, `得点 ${item.serveScores}本`, x, y + 94, w, item.tone);
    drawServeReceiveRow("レシーブ", `成功 ${receiveKeep}`, `ミス ${item.receiveMisses}本`, `得点 ${item.receiveScores}本`, x, y + 168, w, item.tone);
  };
  const drawServeReceiveGrid = (y) => {
    const cardW = (contentWidth - 20) / 2;
    summary.playerServeReceiveStats.forEach((item, index) => {
      const x = pageMargin + (index % 2) * (cardW + 20);
      const rowY = y + Math.floor(index / 2) * 272;
      drawServeReceiveCard(item, x, rowY, cardW);
    });
    return y + Math.ceil(summary.playerServeReceiveStats.length / 2) * 272 + 8;
  };
  const rowValue = (rows, label, fallback = "-") => rows.find(([rowLabel]) => rowLabel === label)?.[1] ?? fallback;
  const shareNameMode = ["role", "team", "full"].includes(nameMode) ? nameMode : "role";
  const shareNameModeLabel = { role: "役割のみ", team: "チーム名あり", full: "名前あり" }[shareNameMode];
  const getTeamShareTitle = () => {
    if (shareNameMode === "role") return state.matchType === "singles" ? "自分 vs 相手" : "自チーム vs 相手ペア";
    return summary.teams;
  };
  const shareSafeText = (text) => {
    let value = String(text ?? "");
    if (shareNameMode === "full") return value;
    (summary.playerRows || []).forEach(([role, name]) => {
      if (name) value = value.split(name).join(role);
    });
    if (shareNameMode === "role") {
      value = value.split(displayName("A")).join(state.matchType === "singles" ? "自分" : "自チーム");
      value = value.split(displayName("B")).join("相手");
    }
    return value;
  };
  const sharePlayerLabel = (label) => {
    if (shareNameMode === "full") return label;
    const matched = (summary.playerRows || []).find(([, value]) => value === label);
    if (matched) return matched[0];
    return shareSafeText(label);
  };

  const drawSocialMetric = (label, value, x, y, w, tone = "neutral") => {
    fillRoundedRect(ctx, x, y, w, 118, 18, tone === "own" ? ownSoftColor : tone === "opp" ? oppSoftColor : neutralSoftColor);
    strokeRoundedRect(ctx, x, y, w, 118, 18, tone === "own" ? "#b9dcc9" : tone === "opp" ? "#f1c2bd" : "#d5ddd6", 2);
    fillRoundedRect(ctx, x + 16, y + 18, 7, 82, 4, textColor(tone));
    drawText(label, x + 34, y + 36, { size: 20, weight: 900, color: mutedColor, maxWidth: w - 54 });
    drawText(value, x + 34, y + 82, { size: 35, weight: 900, color: textColor(tone), maxWidth: w - 54 });
  };
  const drawSocialPlayerCard = ([label, value, tone], index, y) => {
    const parts = plusMinusValueParts(value);
    const cardW = (contentWidth - 18) / 2;
    const x = pageMargin + (index % 2) * (cardW + 18);
    const rowY = y + Math.floor(index / 2) * 138;
    fillRoundedRect(ctx, x, rowY, cardW, 122, 16, "rgba(255,253,247,0.94)");
    strokeRoundedRect(ctx, x, rowY, cardW, 122, 16, tone === "own" ? "#b9dcc9" : tone === "opp" ? "#f1c2bd" : lineColor, 2);
    fillRoundedRect(ctx, x + 16, rowY + 18, 7, 86, 4, textColor(tone));
    drawText(sharePlayerLabel(label), x + 34, rowY + 36, { size: 22, weight: 900, color: inkColor, maxWidth: cardW - 54 });
    drawText(parts.plus, x + 34, rowY + 83, { size: 27, weight: 900, color: ownColor, maxWidth: 66 });
    drawText(parts.minus, x + 102, rowY + 83, { size: 27, weight: 900, color: oppColor, maxWidth: 66 });
    drawWhiteBadge(parts.total, x + 172, rowY + 54, Math.min(132, cardW - 192), 46, tone, 22);
  };
  const drawSocialShareCard = () => {
    const sections = ["チーム共有サマリー", "試合結果", "試合から分かったこと", "次に活かすポイント", "主な数字", "選手別 貢献差"];
    const result = rowValue(summary.resultRows, "試合結果", summary.currentPointScore === "終了" ? "試合終了" : "試合中");
    const games = rowValue(summary.resultRows, "ゲームスコア", summary.gameScore);
    const gamePoints = rowValue(summary.resultRows, "各ゲーム", "各ゲーム 未記録");
    const opening = rowValue(summary.summaryRows, "ゲーム最初の1本", "-");
    const ownScore = rowValue(summary.summaryRows, "自分たちで取った", "0");
    const opponentMiss = rowValue(summary.summaryRows, "相手ミスで取った", "0");
    const ownMiss = rowValue(summary.summaryRows, "ミスで与えた", "0");
    const sr = rowValue(summary.detailRows, "選手別S/R", rowValue(summary.summaryRows, "選手別S/R", "-"));
    const rallyTrend = rowValue(summary.detailRows, "ラリーの長さ", "-");
    const insightItems = summary.analysisComments.filter(Boolean).slice(0, 2);
    const actionItems = [...summary.quickItems, ...summary.reviewItems].filter(Boolean).slice(0, 2);

    const gradient = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, width, pageHeight) : null;
    if (gradient) {
      gradient.addColorStop(0, "#eef6e6");
      gradient.addColorStop(0.42, appBgColor);
      gradient.addColorStop(1, "#f6fadf");
    }
    ctx.fillStyle = gradient || appBgColor;
    ctx.fillRect(0, 0, width, pageHeight);
    fillRoundedRect(ctx, 34, 34, width - 68, pageHeight - 68, 34, "rgba(255,253,247,0.94)");
    strokeRoundedRect(ctx, 34, 34, width - 68, pageHeight - 68, 34, "rgba(23,32,51,0.12)", 3);
    fillRoundedRect(ctx, pageMargin, 54, contentWidth, 8, 4, neutralColor);
    fillRoundedRect(ctx, pageMargin, 54, contentWidth * 0.34, 8, 4, ownColor);
    fillRoundedRect(ctx, pageMargin + contentWidth * 0.68, 54, contentWidth * 0.32, 8, 4, oppColor);

    fillRoundedRect(ctx, pageMargin, 82, 238, 44, 22, neutralColor);
    drawText("TEAM SHARE", pageMargin + 22, 112, { size: 19, weight: 900, color: "#ffffff", maxWidth: 200 });
    drawText(summary.title, pageMargin, 164, { size: 42, weight: 900, color: inkColor, lineHeight: 52, maxWidth: contentWidth });
    drawText(`${summary.subtitle} / ${shareNameModeLabel}`, pageMargin, 206, { size: 23, weight: 900, color: neutralColor, maxWidth: contentWidth });
    // チーム名は1〜2行に伸びるため、実際の高さを測ってから結果ボックスを配置する。
    // 1行に収まる場合は従来と同じ位置(300)になり、2行のときだけ下げて重なりを防ぐ。
    const teamsTitleBottom = drawText(getTeamShareTitle(), pageMargin, 250, { size: 28, weight: 900, color: inkColor, maxWidth: contentWidth, lineHeight: 36, maxLines: 2 });
    const resultBoxTop = Math.max(300, Math.round(teamsTitleBottom) + 8);
    fillRoundedRect(ctx, pageMargin, resultBoxTop, contentWidth, 218, 24, "#0e1a2b");
    fillRoundedRect(ctx, pageMargin + 22, resultBoxTop + 24, 8, 170, 4, "#d8f04a");
    drawText(shareSafeText(result), pageMargin + 44, resultBoxTop + 54, { size: 31, weight: 900, color: "#ffffff", maxWidth: contentWidth - 72 });
    drawText(`ゲーム ${games}`, pageMargin + 44, resultBoxTop + 124, { size: 58, weight: 900, color: "#ffffff", maxWidth: contentWidth - 72 });
    drawText(gamePoints, pageMargin + 44, resultBoxTop + 178, { size: 22, weight: 800, color: "#e2e8f0", maxWidth: contentWidth - 72, maxLines: 2, lineHeight: 30 });

    let y = resultBoxTop + 268;
    y = heading("試合から分かったこと", y);
    if (insightItems.length === 0) {
      y = bullet("記録を続けると、試合の傾向が表示されます", y, "neutral", 1);
    } else {
      insightItems.forEach((item) => {
        y = bullet(shareSafeText(item), y, "neutral", 1);
      });
    }

    y = heading("次に活かすポイント", y + 6);
    if (actionItems.length === 0) {
      y = bullet("まずはサービス・レシーブとミスの本数を確認", y, "neutral", 1);
    } else {
      actionItems.forEach((item, index) => {
        y = bullet(`${index + 1}. ${shareSafeText(item)}`, y, index === 0 ? "own" : "neutral", 1);
      });
    }

    y += 10;
    y = heading("主な数字", y);
    drawSocialMetric("試合の入り", opening, pageMargin, y, (contentWidth - 22) / 2, "neutral");
    drawSocialMetric("自分たちで取った", `${ownScore}本`, pageMargin + (contentWidth + 22) / 2, y, (contentWidth - 22) / 2, "own");
    drawSocialMetric("相手ミスで取った", `${opponentMiss}本`, pageMargin, y + 138, (contentWidth - 22) / 2, "own");
    drawSocialMetric("ミスで与えた", `${ownMiss}本`, pageMargin + (contentWidth + 22) / 2, y + 138, (contentWidth - 22) / 2, "opp");
    y += 286;

    y = heading("選手別 貢献差", y);
    summary.playerPlusMinusRows.slice(0, 4).forEach((row, index) => drawSocialPlayerCard(row, index, y));
    y += Math.ceil(Math.min(summary.playerPlusMinusRows.length, 4) / 2) * 138 + 12;

    fillRoundedRect(ctx, pageMargin, y, contentWidth, 108, 18, paperStrongColor);
    strokeRoundedRect(ctx, pageMargin, y, contentWidth, 108, 18, lineColor, 2);
    drawText(`サーブ・レシーブ: ${shareSafeText(sr)}`, pageMargin + 24, y + 42, { size: 23, weight: 900, color: neutralColor, maxWidth: contentWidth - 48 });
    drawText(`ラリー: ${rallyTrend}`, pageMargin + 24, y + 76, { size: 23, weight: 900, color: neutralColor, maxWidth: contentWidth - 48 });
    y += 124;

    ctx.fillStyle = mutedColor;
    setFont(20, 800);
    drawClampedText(ctx, shareNameMode === "full" ? "名前あり。共有前に公開範囲を確認してください。" : "端末内で画像生成。共有前に名前や大会名の表示を確認してください。", pageMargin, pageHeight - 70, contentWidth, 28, 1);
    return { contentBottom: y, footerTop: pageHeight - 112, height, mode, sections, pageCount };
  };

  const drawFlowTimeline = (rows, y) => {
    const max = Math.max(1, ...rows.map(([, value]) => Number(value) || 0));
    rows.forEach(([label, value, tone, note], index) => {
      const x = pageMargin + index * (contentWidth / rows.length);
      const w = contentWidth / rows.length - 12;
      fillRoundedRect(ctx, x, y, w, 160, 14, softColor(tone));
      strokeRoundedRect(ctx, x, y, w, 160, 14, lineColor, 2);
      fillRoundedRect(ctx, x + 18, y + 22, Math.max(12, (w - 36) * ((Number(value) || 0) / max)), 14, 7, textColor(tone));
      drawText(label, x + 18, y + 66, { size: 18, weight: 900, color: textColor(tone), maxWidth: w - 36, maxLines: 2, lineHeight: 24 });
      drawText(note, x + 18, y + 112, { size: 17, weight: 800, color: mutedColor, maxWidth: w - 36, maxLines: 2, lineHeight: 24 });
    });
    return y + 188;
  };

  if (isShareMode) return drawSocialShareCard();

  // 振り返り用（detail）は、固定ページではなく中身の高さに合わせた連続1枚にする。
  // 旧実装は6ページ固定(各1500px)で空白が多く「お粗末」に見えたため、空白を排して
  // 1枚の縦長カードへ流し込む。高さは計測パスで先に求めてからキャンバスを確定する。
  const detailTop = 84;
  const sectionHeader = (title, subtitle, yy) => {
    sections.push(title);
    fillRoundedRect(ctx, pageMargin, yy, contentWidth, 8, 4, neutralColor);
    fillRoundedRect(ctx, pageMargin, yy, contentWidth * 0.34, 8, 4, ownColor);
    fillRoundedRect(ctx, pageMargin + contentWidth * 0.68, yy, contentWidth * 0.32, 8, 4, oppColor);
    let cursor = yy + 44;
    cursor = drawText(title, pageMargin, cursor, { size: 40, weight: 900, lineHeight: 50, after: 4 });
    if (subtitle) cursor = drawText(subtitle, pageMargin, cursor, { size: 23, weight: 800, color: mutedColor, lineHeight: 30, after: 8 });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageMargin, cursor + 2);
    ctx.lineTo(width - pageMargin, cursor + 2);
    ctx.stroke();
    return cursor + 34;
  };
  const sectionGap = (yy) => {
    const lineY = yy + 26;
    ctx.strokeStyle = softLineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageMargin, lineY);
    ctx.lineTo(width - pageMargin, lineY);
    ctx.stroke();
    return lineY + 36;
  };
  const renderDetailBody = (startY) => {
    let cy = startY;
    cy = sectionHeader("試合後の振り返りノート", `${summary.title} / ${summary.subtitle}`, cy);
    cy = drawScoreBoard(cy);
    cy = heading("試合から分かったこと", cy);
    cy = paragraph("数字から見えた試合の流れを、親子・コーチで同じ画面を見ながら確認します。", cy, "neutral");
    cy = drawItems(summary.analysisComments, cy, ANALYSIS_COMMENT_RULES.detailSummaryComments, 2);
    cy += 8;
    cy = heading("次に活かすポイント", cy);
    cy = drawItems(summary.actionPlanRows.map(([title, note]) => `${title}: ${note}`), cy, 3, 2);

    cy = sectionGap(cy);
    cy = sectionHeader("優先して確認すること", "数字から次に確認することを整理する", cy);
    cy = drawActionPlan(summary.actionPlanRows, cy);

    cy = sectionGap(cy);
    cy = sectionHeader("選手別の関わり", "役割を決めつけず、記録された事実から見る", cy);
    cy = paragraph("+は得点として記録されたプレー、-はミスとして記録されたプレーです。後衛・前衛の良し悪しは決めつけず、関与本数と結果を確認します。", cy, "neutral");
    cy = drawPlayerImpact(cy);

    cy = sectionGap(cy);
    cy = sectionHeader("選手別 サーブ・レシーブ", "何本中何本できたかを先に確認する", cy);
    cy = paragraph("選手ごとにサーブとレシーブを分け、成功・得点・ミスを確認します。", cy, "neutral");
    cy = drawServeReceiveGrid(cy);

    cy = sectionGap(cy);
    cy = sectionHeader("試合の流れと得点内訳", "流れと点の中身を次に活かす材料へつなげる", cy);
    cy = heading("流れと勝負所", cy);
    cy = paragraph("試合の入り、連続得点・連続失点、ゲームポイント/マッチポイントの逸失を確認します。", cy, "neutral");
    cy = drawFlowTimeline(summary.flowRows, cy);
    cy += 10;
    cy = heading("得点と失点の内訳", cy);
    cy = drawPanel("どの点で試合が動いたか", "青は自チームの得点要素、赤は相手に与えた点。次に活かす材料です。", cy, "neutral");
    cy = drawStackedBar(summary.pointBreakdownRows, cy);

    cy = sectionGap(cy);
    cy = sectionHeader("基本情報と根拠データ", "あとで同じ日の試合と混ざらないように残す", cy);
    cy = heading("基本情報", cy);
    cy = bullet(summary.teams, cy, "neutral", 1);
    summary.playerRows.forEach(([label, value]) => {
      cy = bullet(`${label}: ${value}`, cy, "neutral", 1);
    });
    cy += 8;
    cy = heading("試合条件", cy);
    cy = drawRows(summary.conditionRows.slice(0, 5), cy, { maxLinesByLabel: { "開催地／会場": 2, コート: 2 } });
    cy += 8;
    cy = heading("根拠データ", cy);
    cy = drawRows(
      [...summary.summaryRows, ...summary.detailRows, ...summary.phaseRows].filter(([label]) => label !== "記録ポイント").slice(0, 14),
      cy,
      { maxLinesByLabel: { "選手別S/R": 2, 最長連続得点: 2, 最長連続失点: 2 } }
    );
    return cy;
  };

  // 計測パス: 使い捨てキャンバスに流し込み、必要な高さを求める。
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = width;
  measureCanvas.height = 12000;
  const realCtx = ctx;
  ctx = measureCanvas.getContext("2d");
  const measuredBottom = renderDetailBody(detailTop);
  ctx = realCtx;

  const totalHeight = Math.ceil(measuredBottom + 116);
  canvas.width = width;
  canvas.height = totalHeight;
  ctx.fillStyle = appBgColor;
  ctx.fillRect(0, 0, width, totalHeight);
  fillRoundedRect(ctx, 24, 24, width - 48, totalHeight - 48, 18, paperColor);
  strokeRoundedRect(ctx, 24, 24, width - 48, totalHeight - 48, 18, lineColor, 2);

  sections.length = 0;
  const contentBottom = renderDetailBody(detailTop);

  const footerLineY = totalHeight - 84;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pageMargin, footerLineY);
  ctx.lineTo(width - pageMargin, footerLineY);
  ctx.stroke();
  ctx.fillStyle = mutedColor;
  setFont(22, 800);
  drawClampedText(ctx, "端末内で画像生成。開発者や管理者へ送られません。", pageMargin, footerLineY + 38, contentWidth, 30, 1);

  return { contentBottom, footerTop: footerLineY, height: totalHeight, mode, sections, pageCount: 1 };
}

function createSummaryImageDataUrl(matchState = state, mode = summaryPreviewMode, nameMode = summaryPreviewNameMode) {
  const canvas = document.createElement("canvas");
  const originalState = state;
  state = normalizeState(structuredClone(matchState));
  try {
    drawSummaryImage(canvas, getSummaryImageData(), mode, nameMode);
  } finally {
    state = originalState;
  }
  return canvas.toDataURL("image/png");
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function findArchivedMatch(id) {
  return loadArchivedMatches().find((entry) => entry.id === id);
}

function archiveSearchText(entry) {
  const matchState = entry.state || {};
  const info = matchState.matchInfo || {};
  const players = matchState.players || {};
  return [
    entry.title,
    entry.savedAt,
    info.date,
    info.tournament,
    info.event,
    info.venueName,
    info.venue,
    matchState.teams?.A,
    matchState.teams?.B,
    players.ARear,
    players.AFront,
    players.BRear,
    players.BFront
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getArchiveTournamentName(entry) {
  const tournament = String(entry?.state?.matchInfo?.tournament || "").trim();
  return tournament && tournament !== "未記録" ? tournament : "";
}

function getArchiveResult(entry) {
  if (!entry?.finished) return "unfinished";
  const games = entry.state?.games || entry.games || {};
  if ((games.A || 0) > (games.B || 0)) return "own-win";
  if ((games.B || 0) > (games.A || 0)) return "opponent-win";
  return "unfinished";
}

function hasActiveArchiveFilter(filters = {}) {
  return Boolean(
    String(filters.query || "").trim() ||
      (filters.date && filters.date !== "all") ||
      (filters.matchType && filters.matchType !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.result && filters.result !== "all") ||
      (filters.tournament && filters.tournament !== "all")
  );
}

function getArchiveEntryDate(entry) {
  const matchDate = entry?.state?.matchInfo?.date;
  const dateText = matchDate || entry?.savedAt || "";
  if (!dateText) return null;
  const date = new Date(dateText);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isArchiveDateInRange(entry, dateFilter) {
  if (!dateFilter || dateFilter === "all") return true;
  const date = getArchiveEntryDate(entry);
  if (!date) return false;
  if (dateFilter === "dated") return true;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entryStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - entryStart) / 86400000);
  if (dateFilter === "today") return diffDays === 0;
  if (dateFilter === "week") return diffDays >= 0 && diffDays <= 7;
  if (dateFilter === "month") return diffDays >= 0 && diffDays <= 30;
  return true;
}

function filterArchivedMatches(archived, filters = "") {
  const normalizedFilters = typeof filters === "string" ? { query: filters } : filters || {};
  const normalizedQuery = String(normalizedFilters.query || "").trim().toLowerCase();
  return archived.filter((entry) => {
    const matchState = entry.state || {};
    if (normalizedQuery && !archiveSearchText(entry).includes(normalizedQuery)) return false;
    if (!isArchiveDateInRange(entry, normalizedFilters.date || "all")) return false;
    if (normalizedFilters.matchType && normalizedFilters.matchType !== "all" && matchState.matchType !== normalizedFilters.matchType) return false;
    if (normalizedFilters.status === "finished" && !entry.finished) return false;
    if (normalizedFilters.status === "unfinished" && entry.finished) return false;
    if (normalizedFilters.result && normalizedFilters.result !== "all" && getArchiveResult(entry) !== normalizedFilters.result) return false;
    if (normalizedFilters.tournament && normalizedFilters.tournament !== "all" && getArchiveTournamentName(entry) !== normalizedFilters.tournament) return false;
    return true;
  });
}

function sortArchivedMatches(archived, sortType = "newest") {
  const sorted = archived.slice();
  if (sortType === "oldest") {
    return sorted.sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0));
  }
  if (sortType === "title") {
    return sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ja"));
  }
  return sorted.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}

// ---------------------------------------------------------------------------
// 画面から使う操作（旧アプリではダイアログやボタンの処理に埋め込まれていたもの）
// ---------------------------------------------------------------------------

export function getState() {
  return state;
}

/** テストや保存済み試合のプレビューで、別の試合を state にする */
export function setState(next) {
  state = normalizeState(next);
  syncServicePlayerSelections();
  return state;
}

export function reloadState() {
  state = loadState();
  syncServicePlayerSelections();
  return state;
}

/** 記録画面の入力（選手・ショット・サービスの入りなど）を書き換えて保存する */
export function updateSelection(patch) {
  Object.assign(state, patch);
  if ("server" in patch) syncServicePlayerSelections({ force: true });
  saveState();
}

/** サーブ・レシーブ選手の手動指定（自動推定を上書き） */
export function setServicePlayers(patch) {
  state.serviceSelectionKey = getServiceSelectionKey();
  Object.assign(state, patch);
  saveState();
}

const OUTCOME_BY_SHOT = {
  ストローク: ["ストローク得点", "ストロークミス"],
  ボレー: ["ボレー得点", "ボレーミス"],
  スマッシュ: ["スマッシュ得点", "スマッシュミス"],
  サービス: ["サービス得点", "ダブルフォールト"],
  レシーブ: ["レシーブ得点", "レシーブミス"],
  ロビング: ["ロビング得点", "ストロークミス"]
};

/**
 * 誰のプレー×ショット×得点側から、旧アプリと同じ outcome（ポイント内容）を決める。
 * プレーした選手が得点側なら「〇〇得点」、相手側なら「〇〇ミス」。
 */
export function outcomeFor(winner, player, shot, serveStart) {
  if (serveStart === "ダブルフォールト") return "ダブルフォールト";
  if (!shot || shot === "不明") return "不明";
  const playerSide = sideFromPlayerKey(player);
  const scored = playerSide ? playerSide === winner : true;
  const pair = OUTCOME_BY_SHOT[shot];
  if (!pair) return scored ? "ストローク得点" : "その他";
  return scored ? pair[0] : pair[1];
}

/** 取った（A）／取られた（B）を記録する */
export function recordPoint(winner) {
  syncServicePlayerSelections();
  const outcome = outcomeFor(winner, state.selectedPlayer, state.selectedShot, state.selectedServe);
  state.selectedOutcome = outcome;
  if (outcome === "ダブルフォールト") {
    state.selectedShot = "サービス";
    if (state.selectedPlayer === "不明") state.selectedPlayer = state.selectedServerPlayer;
  }
  if (!["short", "long"].includes(state.selectedRallyLengthManual || "")) {
    state.selectedRallyLength = rallyLengthModeForOutcome(outcome);
  } else {
    state.selectedRallyLength = state.selectedRallyLengthManual;
  }
  state.selectedResult = outcome === "ダブルフォールト" || isErrorOutcome(outcome) ? "不明" : "イン";
  const entry = addPoint(winner);
  // 次のポイントに向けて、選んだ選手・ショット・ラリーの指定を戻す
  state.selectedPlayer = "不明";
  state.selectedShot = "不明";
  state.selectedServe = "第1サービスで開始";
  state.selectedRallyLengthManual = "";
  saveState();
  return entry;
}

export { undoPoint, saveAnalysisMemo };

export function matchFormDefaults(mode = "new") {
  const info = state.matchInfo || defaultState.matchInfo;
  const isEdit = mode === "edit";
  return {
    matchType: state.matchType || "doubles",
    teamA: state.teams.A,
    teamB: state.teams.B,
    AFront: state.players.AFront,
    ARear: state.players.ARear,
    BFront: state.players.BFront,
    BRear: state.players.BRear,
    opponentFormation: info.opponentFormation || "雁行陣",
    matchFormat: state.matchFormat || matchFormatFromGamesToWin(state.gamesToWin),
    server: "A",
    date: info.date || new Date().toISOString().slice(0, 10),
    timeOfDay: info.timeOfDay && info.timeOfDay !== "未記録" ? info.timeOfDay : getCurrentTimeOfDay(),
    startTime: isEdit ? info.startTime || "" : getCurrentClockTime(),
    endTime: isEdit ? info.endTime || "" : "",
    weather: info.weather || "未記録",
    temperature: info.temperature || "",
    wind: info.wind || "未記録",
    surface: info.surface || "未記録",
    courtCondition: info.courtCondition || "未記録",
    event: info.event || "未記録",
    tournament: info.tournament || "",
    venueName: info.venueName || "",
    venue: info.venue || "未記録"
  };
}

function applyMatchForm(form, { resetMatch }) {
  if (resetMatch) {
    state = structuredClone(defaultState);
  }
  state.matchType = form.matchType === "singles" ? "singles" : "doubles";
  state.teams.A = String(form.teamA || "").trim() || ownDefaultName();
  state.teams.B = String(form.teamB || "").trim() || opponentDefaultName();
  state.players.AFront = String(form.AFront || "").trim() || "自前衛";
  state.players.ARear = String(form.ARear || "").trim() || "自後衛";
  state.players.BFront = String(form.BFront || "").trim() || "相手前衛";
  state.players.BRear = String(form.BRear || "").trim() || "相手後衛";
  if (resetMatch) {
    state.selectedPlayer = "不明";
    state.selectedShot = "不明";
    state.analysisMemos = [];
    state.points = [];
    state.gamePoints = { A: 0, B: 0 };
    state.games = { A: 0, B: 0 };
    state.finished = false;
    state.server = form.server === "B" ? "B" : "A";
  }
  state.matchFormat = form.matchFormat || "7";
  state.gamesToWin = gamesToWinFromFormat(state.matchFormat);
  state.matchInfo = {
    date: form.date || "",
    timeOfDay: form.timeOfDay || "未記録",
    startTime: form.startTime || (resetMatch ? getCurrentClockTime() : state.matchInfo.startTime || ""),
    endTime: form.endTime || "",
    weather: form.weather || "未記録",
    temperature: form.temperature || "",
    wind: form.wind || "未記録",
    windSide: "未記録",
    surface: form.surface || "未記録",
    courtCondition: form.courtCondition || "未記録",
    opponentFormation: state.matchType === "singles" ? "不明" : form.opponentFormation || "雁行陣",
    event: form.event || "未記録",
    tournament: String(form.tournament || "").trim(),
    venueName: String(form.venueName || "").trim(),
    venue: form.venue || "未記録"
  };
  syncServicePlayerSelections({ force: true });
  syncCurrentArchive(resetMatch ? "auto-new-info" : "auto-info");
  saveState();
}

/** 新しい試合を始める（今の試合は保存済み試合に残す） */
export function startNewMatch(form) {
  archiveCurrentMatch("new-match");
  applyMatchForm(form, { resetMatch: true });
}

export function saveMatchInfo(form) {
  applyMatchForm(form, { resetMatch: false });
}

/** サンプル試合を読み込む（今の試合は保存済み試合に残す） */
export function loadSampleMatch() {
  if (matchHasRecordableData(state)) archiveCurrentMatch("before-practice");
  state = createPracticeMatchState();
  ensureServicePlayerSelections();
  saveState();
  syncCurrentArchive("practice");
}

/** 履歴から1点の詳細を補足する */
export function editPoint(index, patch) {
  const point = state.points[index];
  if (!point) return;
  point.player = normalizePlayerKey(patch.player || "不明");
  point.outcome = patch.outcome || point.outcome;
  point.shot = patch.shot || point.shot;
  point.rally = patch.rally || point.rally || "0";
  point.hand = patch.hand || "不明";
  point.course = patch.course || "未記録";
  point.result = patch.result || "不明";
  point.memo = String(patch.memo || "").trim();
  syncCurrentArchive("auto-detail");
  saveState();
}

export function filterHistoryPoints(points, filter = "all") {
  if (filter === "own") return points.filter((point) => point.winner === "A");
  if (filter === "opp") return points.filter((point) => point.winner === "B");
  if (filter === "errors") return points.filter((point) => isErrorOutcome(point.outcome));
  if (filter === "late") return points.filter(isLateGamePoint);
  return points;
}

/** 保存済み試合を開く（今の試合は保存済み試合に残す） */
export function openArchivedMatch(id) {
  const archived = findArchivedMatch(id);
  if (!archived?.state) return false;
  archiveCurrentMatch("before-restore");
  state = normalizeState(structuredClone(archived.state));
  state.archiveId = archived.id;
  ensureServicePlayerSelections();
  saveState();
  return true;
}

export function removeArchivedMatch(id) {
  saveArchivedMatches(loadArchivedMatches().filter((entry) => entry.id !== id));
}

export function importBackupText(text) {
  return restoreBackupPayload(JSON.parse(text));
}

/** サマリー画像（PNG の data URL）。保存済み試合の state を渡すとその試合で作る */
export function summaryImageDataUrl(matchState, mode = "share", nameMode = "role") {
  return createSummaryImageDataUrl(matchState || state, mode, nameMode);
}

export function summaryFileName(mode = "share") {
  return getSummaryImageFileName(new Date(), mode);
}

export {
  APP_VERSION,
  SCORING_OUTCOMES,
  ERROR_OUTCOMES,
  defaultState,
  normalizeState,
  normalizePlayerKey,
  sideFromPlayerKey,
  serviceSidePlayerKeys,
  displayName,
  shortDisplayName,
  ownDefaultName,
  opponentDefaultName,
  playerLabel,
  pointLabel,
  matchFormatLabel,
  isFinalGame,
  getMatchPointTeams,
  getCompactMatchStatus,
  getWinnerTeam,
  getRuleNoteText,
  getMatchTimeRange,
  getAnalysisData,
  getGameOpeningStats,
  buildSummaryComments,
  buildPriorityAdviceItems,
  buildActionPlanRows,
  getSideInsightItems,
  getScoringSituationCounts,
  getLosingSituationCounts,
  countByOutcomeType,
  getRallyLengthStats,
  getMomentumRows,
  getPlayerPlusMinus,
  getPlayerServeReceiveStats,
  buildPlayerReviewItems,
  formatContributionDiff,
  formatPointDiff,
  formatRate,
  isScoringOutcome,
  isErrorOutcome,
  historyGameNumber,
  historyGameLabel,
  historyPhaseLabel,
  getPointEditPlayerOptions,
  getSummaryImageData,
  drawSummaryImage,
  buildPointCsvRows,
  buildArchivedCsvRows,
  exportCsv,
  exportArchivedCsv,
  exportBackupJson,
  createBackupPayload,
  restoreBackupPayload,
  loadArchivedMatches,
  findArchivedMatch,
  filterArchivedMatches,
  sortArchivedMatches,
  getArchiveTournamentName,
  getAppStorageUsage,
  formatStorageSize,
  matchHasRecordableData,
  createPracticeMatchState,
  rallyLengthModeForOutcome,
  rallyBucket
};

// 起動時に、今の点数からサーブ・レシーブ選手を推定しておく（旧アプリは初回描画で行っていた）
syncServicePlayerSelections();
