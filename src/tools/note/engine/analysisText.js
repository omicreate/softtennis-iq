// 分析コメントの文言（旧 soft-tennis-note/app-analysis.js から移植）
import { SOFT_TENNIS_CONFIG } from "./config.js";

const {
  ANALYSIS_COMMENT_RULES: analysisRules,
  ANALYSIS_COMMENT_MESSAGES: analysisMessages
} = SOFT_TENNIS_CONFIG;

function formatAnalysisMessage(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function cleanAnalysisText(text) {
  return String(text).replace(/[。．.]+$/u, "").replace(/。 +/g, "。").trim();
}

function getScoreQualityMessage(data, ownSide) {
  const totalWon = data.ownPoints || 1;
  const attackRate = Math.round((data.ownScoredByPattern / totalWon) * 100);
  const errorRate = Math.round((data.ownPointsByOpponentError / totalWon) * 100);
  let label = analysisMessages.scoreTypeBalancedLabel;
  let text = analysisMessages.scoreTypeBalancedText;

  if (data.ownPoints === 0) {
    label = analysisMessages.scoreTypePendingLabel;
    text = formatAnalysisMessage(analysisMessages.scoreTypePendingText, { ownSide });
  } else if (attackRate >= analysisRules.attackRateHigh) {
    label = analysisMessages.scoreTypeAttackLabel;
    text = formatAnalysisMessage(analysisMessages.scoreTypeAttackText, { ownSide });
  } else if (errorRate >= analysisRules.opponentErrorRateHigh) {
    label = analysisMessages.scoreTypeOpponentErrorLabel;
    text = analysisMessages.scoreTypeOpponentErrorText;
  }

  return { label, text, attackRate, errorRate };
}

function buildQuickCoachItemsFromData(data) {
  if (!data.total) return [analysisMessages.quickNoRecord];
  const notes = [];
  if (data.ownDoubleFaults > 0) notes.push(analysisMessages.quickDoubleFault);
  if (data.ownReceiveMisses > 0) notes.push(analysisMessages.quickReceiveMiss);
  if (data.ownEarlyLost >= analysisRules.earlyLostAlert) notes.push(analysisMessages.quickEarlyLost);
  if (data.openingPointRate !== null && data.openingPointRate < analysisRules.openingRateLow) notes.push(analysisMessages.quickOpeningLow);
  if (data.longestOppStreak >= analysisRules.longLostStreakAlert) notes.push(analysisMessages.quickStopStreak);
  if (data.ownGamePointMissed >= analysisRules.clutchMissAlert || data.ownMatchPointMissed >= analysisRules.clutchMissAlert) notes.push(analysisMessages.quickClutchMiss);
  if (data.rallyRecorded >= analysisRules.rallyRecordedMin && data.rallyShortRate >= analysisRules.shortRallyRateHigh) notes.push(analysisMessages.quickShortRallyHigh);
  if (data.rallyRecorded >= analysisRules.rallyRecordedMin && data.rallyLongRate >= analysisRules.longRallyRateHigh) notes.push(analysisMessages.quickLongRallyHigh);
  if (data.firstServeRate !== null && data.firstServeRate < analysisRules.firstServeLow) notes.push(analysisMessages.quickFirstServeLow);
  if (data.ownScoredByPattern < data.ownPointsByOpponentError) notes.push(analysisMessages.quickOpponentErrorMore);
  if (data.topScore[1] > 0) notes.push(formatAnalysisMessage(analysisMessages.quickTopScore, { topScore: data.topScore[0] }));
  if (!notes.length) notes.push(analysisMessages.quickBalanced);
  return notes.slice(0, analysisRules.quickLimit);
}

function buildSummaryCommentsFromData(data, formatPointDiff) {
  if (!data.total) return [analysisMessages.summaryNoRecord];
  const comments = [];
  const wonTotal = data.ownPoints || 1;
  const attackRate = Math.round((data.ownScoredByPattern / wonTotal) * 100);
  const opponentErrorRate = Math.round((data.ownPointsByOpponentError / wonTotal) * 100);
  const pointDiff = formatPointDiff(data.pointDiff);

  if (data.pointDiff > 0) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryPointDiffPositive, { pointDiff }));
  } else if (data.pointDiff < 0) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryPointDiffNegative, { pointDiff }));
  } else {
    comments.push(formatAnalysisMessage(analysisMessages.summaryPointDiffEven, { pointDiff }));
  }

  if ((data.firstHalfOwnGames || 0) + (data.firstHalfOpponentGames || 0) > 0) {
    if (data.firstHalfOwnGames < data.firstHalfOpponentGames) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryFirstHalfBehind, data));
    } else if (data.firstHalfOwnGames > data.firstHalfOpponentGames) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryFirstHalfAhead, data));
    }
  }

  if (data.openingPointRate !== null && data.openingPointTotal >= 2) {
    if (data.openingPointRate < analysisRules.openingRateLow) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryOpeningLow, data));
    } else if (data.openingPointRate >= analysisRules.openingRateHigh) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryOpeningHigh, data));
    }
  }

  if (data.longestOppStreak >= analysisRules.longLostStreakAlert) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryLostStreak, data));
  }
  if (data.ownGamePointMissed >= analysisRules.clutchMissAlert || data.ownMatchPointMissed >= analysisRules.clutchMissAlert) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryClutchMiss, data));
  }

  if (data.ownLostByOwnError > data.ownScoredByPattern) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryOwnErrorHigh, data));
  } else if (attackRate >= analysisRules.attackRateHigh) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryAttackHigh, { attackRate }));
  } else if (opponentErrorRate >= analysisRules.opponentErrorRateHigh) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryOpponentErrorHigh, { opponentErrorRate }));
  }

  if (data.ownDoubleFaults > 0 || data.ownReceiveMisses > 0) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryServeReceive, data));
  }
  if (data.rallyRecorded >= analysisRules.rallyRecordedMin) {
    if (data.rallyShortRate >= analysisRules.shortRallyRateHigh) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryShortRallyHigh, data));
    } else if (data.rallyLongRate >= analysisRules.longRallyRateHigh) {
      comments.push(formatAnalysisMessage(analysisMessages.summaryLongRallyHigh, data));
    }
  }
  if (data.ownEarlyLost >= analysisRules.earlyLostAlert) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryEarlyLost, data));
  }
  if (data.topScore[1] > 0) {
    comments.push(formatAnalysisMessage(analysisMessages.summaryTopScore, {
      topScore: data.topScore[0],
      topScoreCount: data.topScore[1]
    }));
  }

  return comments.map(cleanAnalysisText).slice(0, analysisRules.summaryLimit);
}

export const SOFT_TENNIS_ANALYSIS = {
  cleanAnalysisText,
  getScoreQualityMessage,
  buildQuickCoachItemsFromData,
  buildSummaryCommentsFromData
};
