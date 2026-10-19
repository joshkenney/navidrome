import { describe, it, expect } from 'vitest'
import { withoutCombinedLibraries } from './combinedLibraries'

describe('withoutCombinedLibraries', () => {
  it('leaves out libraries containing other libraries', () => {
    const libs = [
      { id: 1, path: '/music' },
      { id: 2, path: '/music/alice' },
      { id: 3, path: '/music/bob/' },
      { id: 4, path: '/other' },
    ]
    expect(withoutCombinedLibraries(libs).map((l) => l.id)).toEqual([2, 3, 4])
  })

  it('does not confuse folders sharing a name prefix', () => {
    const libs = [
      { id: 1, path: '/music/ipod' },
      { id: 2, path: '/music/ipod2' },
    ]
    expect(withoutCombinedLibraries(libs)).toEqual(libs)
  })

  it('keeps libraries without a path', () => {
    const libs = [{ id: 1 }, { id: 2, path: '/music' }]
    expect(withoutCombinedLibraries(libs)).toEqual(libs)
  })
})
