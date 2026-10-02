import { useEffect, useState } from 'react'

/** ハッシュで画面を切り替える（GitHub Pages でもリロードで404にならない）。例: #/drill/review */
export function parseRoute(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const href = (...parts: string[]) => `#/${parts.join('/')}`
