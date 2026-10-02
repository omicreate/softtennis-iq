export interface Choice {
  id: string
  text: string
}

export interface Question {
  id: string
  category: string
  level: string
  prompt: string
  choices: Choice[]
  answerId: string
  officialTerm: string
  plainExplanation: string
  sourceRefs: string[]
  sourceRank: string
  effectiveFrom: string
  scopeNote: string
  lastVerified: string
  tags: string[]
  reviewStatus: string
}

export interface Source {
  id: string
  rank: string
  title: string
  publisher: string
  url: string
  publishedAt: string
  checkedAt: string
  scopeNote: string
}

export interface AnswerRecord {
  attempts: number
  correct: number
  wrongCount: number
  lastAnsweredAt: string
  mastered: boolean
}

/** 端末内の学習記録。キーと形は旧ルールドリル（同じオリジン）と共通にして、記録を引き継ぐ */
export interface Progress {
  answers: Record<string, AnswerRecord>
  streak: number
  bestStreak: number
  totalAnswered: number
  totalCorrect: number
  lastStudyAt: string
  reviewQueue: string[]
  drillSeenIds: string[]
  drillSeenKeys: string[]
}
