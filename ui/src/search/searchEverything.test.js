import { describe, it, expect, beforeEach, vi } from 'vitest'
import httpClient from '../dataProvider/httpClient'
import { normalize, searchEverything, searchServer } from './searchEverything'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const respond = (byResource) =>
  httpClient.mockImplementation((url) => {
    const resource = url.split('?')[0].split('/').pop()
    const result = byResource[resource]
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve({ json: result || (resource === 'search' ? {} : []) })
  })

const now = new Date(2026, 9, 28)

describe('searchEverything', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches every type on every iPod, without the iPod selection', async () => {
    respond({})
    await searchEverything('weezer')
    const urls = httpClient.mock.calls.map(([url]) => url)
    expect(urls).toEqual([
      '/api/search?q=weezer&types=artists%2Calbums%2Csongs%2Cusers%2Clistens&_start=0&_end=5',
      '/api/playlist?_start=0&_end=5&q=weezer',
      '/api/genre?_start=0&_end=5&name=weezer',
    ])
    urls.forEach((url) => expect(url).not.toContain('library_id'))
  })

  it('returns what each request found, and which groups have more', async () => {
    respond({
      search: {
        artists: { items: [{ id: 'ar1', name: 'Weezer' }], more: true },
        albums: {
          items: [{ id: 'al1', name: 'Blue' }],
          matches: { al1: 'label' },
        },
        songs: { items: [], matches: { s1: 'lyrics' } },
      },
      genre: [{ id: 'g1', name: 'Rock' }],
    })
    const found = await searchEverything('wee')
    expect(found.artists).toEqual([{ id: 'ar1', name: 'Weezer' }])
    expect(found.albums).toEqual([{ id: 'al1', name: 'Blue' }])
    expect(found.songs).toEqual([])
    expect(found.users).toEqual([])
    expect(found.genres).toHaveLength(1)
    expect(found.more).toEqual({ artists: true, albums: false, songs: false })
    expect(found.matches).toEqual({ al1: 'label', s1: 'lyrics' })
  })

  it('leaves a group empty when its request fails', async () => {
    respond({
      search: new Error('boom'),
      playlist: [{ id: 'p1', name: 'Mix' }],
    })
    const found = await searchEverything('blue')
    expect(found.songs).toEqual([])
    expect(found.playlists).toHaveLength(1)
  })

  it('matches iPods by name, ignoring case, accents and combined libraries', async () => {
    respond({})
    const found = await searchEverything('ZOE', {
      userLibraries: [
        { id: 1, name: 'Music Library', path: '/music' },
        { id: 2, name: "Zoë's iPod", path: '/music/zoe' },
        { id: 3, name: "Bob's iPod", path: '/music/bob' },
      ],
    })
    expect(found.ipods.map((l) => l.id)).toEqual([2])
  })

  it('matches past iPod radios by song, artist, album or iPod', async () => {
    respond({})
    const radioHistory = [
      { seedId: 's1', title: 'Buddy Holly', artist: 'Weezer' },
      { seedId: 's2', title: 'Other', artist: 'Someone', album: 'Weezer Fans' },
      { seedId: 's3', title: 'Nope', artist: 'Nobody', libraryName: 'Ann' },
    ]
    const found = await searchEverything('weezer', { radioHistory })
    expect(found.radios.map((r) => r.seedId)).toEqual(['s1', 's2'])
  })

  it('understands dates: the listening then, and for years the music released then', async () => {
    respond({})
    const june = await searchEverything('last june', { now })
    expect(june.dates).toEqual([
      expect.objectContaining({
        kind: 'timeline',
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ])
    const year = await searchEverything('1997', { now })
    expect(year.dates.map((d) => d.kind)).toEqual(['timeline', 'released'])
    expect(year.dates[1]).toMatchObject({ yearFrom: 1997, yearTo: 1997 })
    expect((await searchEverything('weezer', { now })).dates).toEqual([])
  })

  it('normalizes accents and case', () => {
    expect(normalize('Beyoncé')).toBe('beyonce')
  })
})

describe('searchServer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the filters and the page', async () => {
    respond({})
    await searchServer('', {
      types: ['albums'],
      libraryIds: [2, 3],
      yearFrom: 1990,
      yearTo: 1999,
      genreId: 'g1',
      played: 'unplayed',
      start: 50,
      end: 100,
    })
    expect(httpClient.mock.calls[0][0]).toBe(
      '/api/search?types=albums&library_id=2&library_id=3&year_from=1990&year_to=1999' +
        '&genre_id=g1&played=unplayed&_start=50&_end=100',
    )
  })
})
