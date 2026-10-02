// 点数の数え方（旧 soft-tennis-note/app-rules.js から移植。競技規則 第20条・第34条に対応）
function normalizeSideScoresForRules(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    A: Number.isFinite(Number(source.A)) ? Number(source.A) : 0,
    B: Number.isFinite(Number(source.B)) ? Number(source.B) : 0
  };
}

function gamesToWinFromFormat(format) {
  if (format === "5") return 3;
  if (format === "9") return 5;
  if (format === "final") return 1;
  return 4;
}

function matchFormatFromGamesToWin(gamesToWin) {
  if (gamesToWin === 3) return "5";
  if (gamesToWin === 5) return "9";
  if (gamesToWin === 1) return "final";
  return "7";
}

function matchFormatLabel(format) {
  return format === "final" ? "ファイナルゲームのみ" : `${format || "7"}ゲームマッチ`;
}

function getGamesToWin(matchState) {
  const gamesToWin = Number(matchState?.gamesToWin);
  return Number.isFinite(gamesToWin) && gamesToWin > 0 ? gamesToWin : gamesToWinFromFormat(matchState?.matchFormat);
}

function isFinalGame(matchState) {
  if (matchState?.matchFormat === "final") return true;
  const games = normalizeSideScoresForRules(matchState?.games);
  const gamesToWin = getGamesToWin(matchState);
  return games.A === gamesToWin - 1 && games.B === gamesToWin - 1;
}

function getPointTarget(matchState) {
  return isFinalGame(matchState) ? 7 : 4;
}

function getPointTargetForRecordedPoint(point, matchState) {
  if (matchState?.matchFormat === "final") return 7;
  const games = normalizeSideScoresForRules(point?.scoreBefore?.games);
  const gamesToWin = getGamesToWin(matchState);
  return games.A === gamesToWin - 1 && games.B === gamesToWin - 1 ? 7 : 4;
}

function hasWonUnit(a, b, target) {
  return a >= target && a - b >= 2;
}

function switchSide(side) {
  return side === "A" ? "B" : "A";
}

function winsCurrentGameOnNextPoint(matchState, team) {
  if (!["A", "B"].includes(team)) return false;
  const gamePoints = normalizeSideScoresForRules(matchState?.gamePoints);
  const opponent = switchSide(team);
  return hasWonUnit(gamePoints[team] + 1, gamePoints[opponent], getPointTarget(matchState));
}

function getMatchPointTeams(matchState) {
  if (matchState?.finished) return [];
  const games = normalizeSideScoresForRules(matchState?.games);
  const gamesToWin = getGamesToWin(matchState);
  return ["A", "B"].filter((team) => winsCurrentGameOnNextPoint(matchState, team) && games[team] + 1 >= gamesToWin);
}

function pointLabel(matchState, team) {
  const target = getPointTarget(matchState);
  const gamePoints = normalizeSideScoresForRules(matchState?.gamePoints);
  const own = gamePoints[team] || 0;
  const other = gamePoints[switchSide(team)] || 0;
  if (own >= target - 1 && other >= target - 1 && own === other) return `${own} D`;
  if (own >= target && own === other + 1) return `${own} A`;
  return String(own);
}

function getPhaseLabel(points) {
  const scores = normalizeSideScoresForRules(points);
  const total = scores.A + scores.B;
  if (total <= 1) return "ゲーム序盤";
  if (total <= 3) return "ゲーム中盤";
  return "ゲーム終盤";
}

function isOpeningPoint(point) {
  const points = normalizeSideScoresForRules(point?.scoreBefore?.points);
  return points.A + points.B <= 1;
}

function isDeuceOrLater(point, matchState) {
  const target = getPointTargetForRecordedPoint(point, matchState);
  const points = normalizeSideScoresForRules(point?.scoreBefore?.points);
  return points.A >= target - 1 && points.B >= target - 1;
}

function isGamePointArea(point, matchState) {
  if (isDeuceOrLater(point, matchState)) return false;
  const target = getPointTargetForRecordedPoint(point, matchState);
  const points = normalizeSideScoresForRules(point?.scoreBefore?.points);
  return points.A >= target - 1 || points.B >= target - 1;
}

function getGameNumber(games) {
  const scores = normalizeSideScoresForRules(games);
  return scores.A + scores.B + 1;
}

function applyPointToScore(matchState, winner) {
  if (!["A", "B"].includes(winner) || matchState?.finished) {
    return { ignored: true };
  }

  const loser = switchSide(winner);
  const games = normalizeSideScoresForRules(matchState.games);
  let gamePoints = normalizeSideScoresForRules(matchState.gamePoints);
  let server = ["A", "B"].includes(matchState.server) ? matchState.server : "A";
  const gamesToWin = getGamesToWin(matchState);
  const finalGameBeforePoint = isFinalGame(matchState);
  const target = finalGameBeforePoint ? 7 : 4;
  let gameWonBy = "";

  gamePoints[winner] += 1;

  if (hasWonUnit(gamePoints[winner], gamePoints[loser], target)) {
    games[winner] += 1;
    gamePoints = { A: 0, B: 0 };
    gameWonBy = winner;
    server = switchSide(server);
  } else if (finalGameBeforePoint && (gamePoints.A + gamePoints.B) % 2 === 0) {
    server = switchSide(server);
  }

  return {
    ignored: false,
    games,
    gamePoints,
    server,
    finished: games[winner] >= gamesToWin,
    gameWonBy,
    target,
    finalGameBeforePoint
  };
}

export const RULES = {
  gamesToWinFromFormat,
  matchFormatFromGamesToWin,
  matchFormatLabel,
  isFinalGame,
  getPointTarget,
  getPointTargetForRecordedPoint,
  hasWonUnit,
  winsCurrentGameOnNextPoint,
  getMatchPointTeams,
  pointLabel,
  getPhaseLabel,
  isOpeningPoint,
  isDeuceOrLater,
  isGamePointArea,
  getGameNumber,
  switchSide,
  applyPointToScore
};
