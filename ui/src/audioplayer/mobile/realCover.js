import { useEffect, useState } from 'react'

// Whether a cover is a real picture, or the server's placeholder for a song or album with none
// (it says so in a header, see GetCoverArt): asked once per address. The picture fetched is the
// one the screen then shows, from the browser's cache. Where it can't be asked, it is taken as
// real

const known = new Map()

export const isRealCover = (url) => {
  if (!url) return Promise.resolve(false)
  if (!known.has(url)) {
    known.set(
      url,
      fetch(url)
        .then((r) => r.headers.get('x-nd-placeholder') !== 'true')
        .catch(() => true),
    )
  }
  return known.get(url)
}

// The answer as it comes: null until known, then true or false
export const useRealCover = (url) => {
  const [real, setReal] = useState(null)
  useEffect(() => {
    let live = true
    setReal(null)
    if (!url) {
      setReal(false)
      return undefined
    }
    isRealCover(url).then((ok) => live && setReal(ok))
    return () => {
      live = false
    }
  }, [url])
  return real
}

// For tests
export const forgetCovers = () => known.clear()
