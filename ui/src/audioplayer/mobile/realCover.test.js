import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { forgetCovers, isRealCover } from './realCover'

const response = (placeholder) => ({
  headers: {
    get: (h) => (h === 'x-nd-placeholder' && placeholder ? 'true' : null),
  },
})

describe('isRealCover', () => {
  beforeEach(() => forgetCovers())
  afterEach(() => vi.unstubAllGlobals())

  it("tells the server's placeholder from a real cover, asking once per address", async () => {
    const fetch = vi.fn((url) =>
      Promise.resolve(response(url.includes('none'))),
    )
    vi.stubGlobal('fetch', fetch)
    expect(await isRealCover('/rest/getCoverArt?id=al-none')).toBe(false)
    expect(await isRealCover('/rest/getCoverArt?id=al-1')).toBe(true)
    expect(await isRealCover('/rest/getCoverArt?id=al-1')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("takes a cover as real where it can't be asked, and no address as none", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    expect(await isRealCover('/rest/getCoverArt?id=al-2')).toBe(true)
    expect(await isRealCover(undefined)).toBe(false)
  })
})
