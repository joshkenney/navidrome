import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { httpClient } from '../dataProvider'
import {
  FACTS_URL,
  NETWORK_URL,
  clearIpodDataCache,
  fetchIpodData,
  getCachedIpodData,
  prefetchIpodData,
  schedulePrefetch,
} from './ipodDataCache'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

describe('iPod data cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearIpodDataCache()
    httpClient.mockImplementation((url) =>
      Promise.resolve({ json: { url, value: 1 } }),
    )
  })

  afterEach(() => vi.useRealTimers())

  it('prefetches the facts and the network', async () => {
    await prefetchIpodData()
    expect(httpClient.mock.calls.map(([url]) => url)).toEqual([
      FACTS_URL,
      NETWORK_URL,
    ])
    expect(getCachedIpodData(NETWORK_URL)).toEqual({
      url: NETWORK_URL,
      value: 1,
    })
  })

  it('returns the cached copy itself when nothing changed', async () => {
    const first = await fetchIpodData(NETWORK_URL)
    expect(await fetchIpodData(NETWORK_URL)).toBe(first)

    httpClient.mockResolvedValue({ json: { value: 2 } })
    const changed = await fetchIpodData(NETWORK_URL)
    expect(changed).not.toBe(first)
    expect(getCachedIpodData(NETWORK_URL)).toBe(changed)
  })

  it('keeps going when one of them fails', async () => {
    httpClient.mockImplementation((url) =>
      url === FACTS_URL
        ? Promise.reject(new Error('down'))
        : Promise.resolve({ json: { ok: true } }),
    )
    await prefetchIpodData()
    expect(getCachedIpodData(FACTS_URL)).toBeUndefined()
    expect(getCachedIpodData(NETWORK_URL)).toEqual({ ok: true })
  })

  it('prefetches after a delay, unless cancelled', () => {
    vi.useFakeTimers()
    const cancel = schedulePrefetch(1000)
    vi.advanceTimersByTime(999)
    expect(httpClient).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    vi.runAllTimers()
    expect(httpClient).toHaveBeenCalledTimes(2)

    vi.clearAllMocks()
    schedulePrefetch(1000)()
    vi.runAllTimers()
    expect(httpClient).not.toHaveBeenCalled()
    cancel()
  })
})
