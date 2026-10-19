import { describe, it, expect } from 'vitest'
import { artistKey, uniqueArtists } from './artistKey'

describe('artistKey', () => {
  it.each([
    ['The Spill Canvas', 'Spill Canvas'],
    ['the spill canvas', 'SPILL CANVAS'],
    ['Panic! At The Disco', 'Panic at the Disco'],
    ['Simon & Garfunkel', 'Simon and Garfunkel'],
    ['Florence + The Machine', 'Florence and the Machine'],
    ["Guns N' Roses", 'Guns N Roses'],
    ['Beyoncé', 'Beyonce'],
  ])('matches %s and %s', (a, b) => {
    expect(artistKey(a)).toBe(artistKey(b))
  })

  it('keeps names made of punctuation', () => {
    expect(artistKey('!!!')).toBe('!!!')
  })
})

describe('uniqueArtists', () => {
  it('keeps one artist per spelling', () => {
    const artists = [
      { id: '1', name: 'The Spill Canvas' },
      { id: '2', name: 'Spill Canvas' },
      { id: '3', name: 'Something Corporate' },
    ]
    expect(uniqueArtists(artists).map((a) => a.id)).toEqual(['1', '3'])
  })
})
