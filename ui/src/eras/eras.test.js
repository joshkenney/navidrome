import { describe, it, expect, beforeEach, vi } from 'vitest'
import httpClient from '../dataProvider/httpClient'
import {
  biggestDecade,
  eraName,
  playEra,
  shiftEra,
  toDecades,
  yearBars,
} from './eras'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const years = [
  { year: 1967, songs: 10, played: 2 },
  { year: 1969, songs: 5, played: 0 },
  { year: 1971, songs: 30, played: 3 },
]

describe('eras', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups years into decades', () => {
    expect(toDecades(years)).toEqual([
      { decade: 1960, from: 1960, to: 1969, songs: 15, played: 2 },
      { decade: 1970, from: 1970, to: 1979, songs: 30, played: 3 },
    ])
    expect(biggestDecade(years).decade).toBe(1970)
    expect(biggestDecade([])).toBeNull()
  })

  it('names eras', () => {
    expect(eraName(1970, 1979)).toBe('1970s')
    expect(eraName(1977, 1977)).toBe('1977')
    expect(eraName(1965, 1972)).toBe('1965–1972')
  })

  it('moves to the era before or after', () => {
    expect(shiftEra(1970, 1979, -1)).toEqual({ from: 1960, to: 1969 })
    expect(shiftEra(1977, 1977, 1)).toEqual({ from: 1978, to: 1978 })
  })

  it('has a bar for every year, with or without music', () => {
    expect(yearBars(years).map((b) => [b.from, b.plays])).toEqual([
      [1967, 10],
      [1968, 0],
      [1969, 5],
      [1970, 0],
      [1971, 30],
    ])
    expect(yearBars([])).toEqual([])
  })

  it('plays the songs of an era', async () => {
    httpClient.mockResolvedValue({ json: [{ id: 's1' }, { id: 's2' }] })
    const dispatch = vi.fn()
    const count = await playEra(dispatch, {
      from: 1970,
      to: 1979,
      mode: 'journey',
      unplayed: true,
    })
    expect(count).toBe(2)
    expect(httpClient.mock.calls[0][0]).toBe(
      '/api/eras/play?from=1970&to=1979&mode=journey&unplayed=true&count=60',
    )
    expect(dispatch.mock.calls[0][0].type).toBe('PLAYER_PLAY_TRACKS')
  })

  it('plays nothing when the era has no songs', async () => {
    httpClient.mockResolvedValue({ json: [] })
    const dispatch = vi.fn()
    expect(await playEra(dispatch, { from: 1900, to: 1909 })).toBe(0)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
