import { Home } from './shell/Home'
import { useRoute } from './shell/route'
import { Drill } from './tools/drill/Drill'

export default function App() {
  const [tool, section] = useRoute()

  if (tool === 'drill') {
    const s = section === 'review' || section === 'record' ? section : 'play'
    return <Drill section={s} />
  }
  return <Home />
}
