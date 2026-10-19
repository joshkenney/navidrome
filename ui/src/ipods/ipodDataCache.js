import { httpClient } from '../dataProvider'

export const FACTS_URL = '/api/ipods/facts'
export const NETWORK_URL = '/api/ipods/network'
const PREFETCH_DELAY = 5000

// The iPod Facts and Network, fetched in the background after the app loads, so their dialogs
// open at once. The server computes them over every iPod's songs, which takes a while after it
// restarted or the music changed. The dialogs show the cached copy, then refresh it
const cache = new Map()

export const getCachedIpodData = (url) => cache.get(url)

// Fetches and caches the data. When it didn't change, the cached copy itself is returned, so the
// dialogs don't redraw (the network graph would lay itself out again)
export const fetchIpodData = (url) =>
  httpClient(url).then(({ json }) => {
    const cached = cache.get(url)
    if (cached && JSON.stringify(cached) === JSON.stringify(json)) return cached
    cache.set(url, json)
    return json
  })

export const prefetchIpodData = () =>
  Promise.allSettled([fetchIpodData(FACTS_URL), fetchIpodData(NETWORK_URL)])

// Prefetches once the app has loaded and the browser is idle. Returns a function cancelling it
export const schedulePrefetch = (delay = PREFETCH_DELAY) => {
  let idle
  const timer = setTimeout(() => {
    if (window.requestIdleCallback) {
      idle = window.requestIdleCallback(() => prefetchIpodData())
    } else {
      prefetchIpodData()
    }
  }, delay)
  return () => {
    clearTimeout(timer)
    if (idle && window.cancelIdleCallback) window.cancelIdleCallback(idle)
  }
}

export const clearIpodDataCache = () => cache.clear()
