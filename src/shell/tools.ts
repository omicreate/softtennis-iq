export type ToolId = 'drill' | 'jinkei' | 'note'

export interface ToolInfo {
  id: ToolId
  name: string
  lead: string
  /** 'ready' はこのアプリ内で動く。'legacy' は刷新前のため現行版へ案内する */
  status: 'ready' | 'legacy'
  legacyUrl: string
  /** 流入計測で使うアプリ名（旧アプリと同じ名前にして集計を続ける） */
  trackName: string
}

export const tools: ToolInfo[] = [
  {
    id: 'drill',
    name: 'ルールドリル',
    lead: '審判のコールや点数の数え方を、4択10問で確かめる',
    status: 'ready',
    legacyUrl: 'https://omicreate.github.io/soft-tennis-rule-drill/',
    trackName: 'soft-tennis-rule-drill',
  },
  {
    id: 'jinkei',
    name: '陣形ラボ',
    lead: '配置をドラッグして、守備の穴をラケット何本分かで読む',
    status: 'ready',
    legacyUrl: 'https://omicreate.github.io/jinkei-lab/',
    trackName: 'jinkei-lab',
  },
  {
    id: 'note',
    name: '試合ノート',
    lead: '外から試合を記録して、得点とミスの傾向を振り返る',
    status: 'ready',
    legacyUrl: 'https://omicreate.github.io/soft-tennis-note/',
    trackName: 'soft-tennis-note',
  },
]

export const toolById = (id: string) => tools.find((t) => t.id === id)
