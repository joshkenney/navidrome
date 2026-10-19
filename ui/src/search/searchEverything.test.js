import { describe, it, expect, beforeEach, vi } from 'vitest'
import httpClient from '../dataProvider/httpClient'
import { normalize, searchEverything } from './searchEverything'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const respond = (byResource) =>
  httpClient.mockImplementation((url) => {
    const resource = url.split('?')[0].split('/').pop()
    const result = byResource[resource]
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve({ json: result || [] })
  })

describe('searchEverything', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches every type on every iPod, without the iPod selection', async () => {
    respond({})
    await searchEverything('weezer')
    const urls = httpClient.mock.calls.map(([url]) => url)
    expect(urls).toEqual([
      '/api/artist?_start=0&_end=5&name=weezer',
      '/api/album?_start=0&_end=5&name=weezer',
      '/api/song?_start=0&_end=5&title=weezer',
      '/api/playlist?_start=0&_end=5&q=weezer',
      '/api/genre?_start=0&_end=5&name=weezer',
    ])
    urls.forEach((url) => expect(url).not.toContain('library_id'))
  })

  it('returns what each request found', async () => {
    respond({
      artist: [{ id: 'ar1', name: 'Weezer' }],
      album: [{ id: 'al1', name: 'Blue' }],
    })
    const found = await searchEverything('wee')
    expect(found.artists).toEqual([{ id: 'ar1', name: 'Weezer' }])
    expect(found.albums).toEqual([{ id: 'al1', name: 'Blue' }])
    expect(found.songs).toEqual([])
  })

  it('leaves a group empty when its request fails', async () => {
    respond({ song: new Error('boom'), album: [{ id: 'al1', name: 'Blue' }] })
    const found = await searchEverything('blue')
    expect(found.songs).toEqual([])
    expect(found.albums).toHaveLength(1)
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

  it('normalizes accents and case', () => {
    expect(normalize('Beyoncé')).toBe('beyonce')
  })
})
