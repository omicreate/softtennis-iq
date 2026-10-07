import { Home } from './shell/Home'
import { useRoute } from './shell/route'
import { Drill } from './tools/drill/Drill'
import { Jinkei } from './tools/jinkei/Jinkei'
import { Note } from './tools/note/Note'
import { Quiz } from './tools/quiz/Quiz'
import type { NoteSection } from './tools/note/Note'

// 共有リンク（?layout=）だけで開かれたときは陣形ラボを開く（旧 jinkei-lab の共有リンクの転送先）
const openedWithLayout = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('layout')

export default function App() {
  const [tool, section, sub] = useRoute()

  if (tool === 'quiz') {
    const s = section === 'archive' || section === 'record' ? section : 'today'
    return <Quiz section={s} id={s === 'archive' ? sub : undefined} />
  }

  if (tool === 'drill') {
    const s = section === 'review' || section === 'record' ? section : 'play'
    return <Drill section={s} />
  }
  if (tool === 'jinkei' || (!tool && openedWithLayout)) {
    const s = section === 'setup' || section === 'save' ? section : 'court'
    return <Jinkei section={s} />
  }
  if (tool === 'note') {
    const allowed: NoteSection[] = ['analysis', 'history', 'menu', 'new', 'edit', 'archive', 'summary']
    const s = allowed.includes(section as NoteSection) ? (section as NoteSection) : 'record'
    return <Note section={s} />
  }
  return <Home />
}
