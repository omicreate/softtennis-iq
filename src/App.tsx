import { Home } from './shell/Home'
import { useRoute } from './shell/route'
import { Drill } from './tools/drill/Drill'
import { Jinkei } from './tools/jinkei/Jinkei'

// 共有リンク（?layout=）だけで開かれたときは陣形ラボを開く（旧 jinkei-lab の共有リンクの転送先）
const openedWithLayout = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('layout')

export default function App() {
  const [tool, section] = useRoute()

  if (tool === 'drill') {
    const s = section === 'review' || section === 'record' ? section : 'play'
    return <Drill section={s} />
  }
  if (tool === 'jinkei' || (!tool && openedWithLayout)) {
    const s = section === 'setup' || section === 'save' ? section : 'court'
    return <Jinkei section={s} />
  }
  return <Home />
}
