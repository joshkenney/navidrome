import { describe, it, expect, beforeEach, vi } from 'vitest'
import { httpClient } from '../dataProvider'
import {
  classifyListen,
  extendRadio,
  noteRadioProgress,
  recordRadioListen,
  fetchIpodRadio,
  getRadioSession,
  playIpodRadio,
  stopRadioSession,
} from './radio'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

const song = (id) => ({ id, title: `Song ${id}`, artist: `Artist ${id}` })

describe('iPod Radio client', () => {
  const dispatch = vi.fn()
  const notify = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    stopRadioSession()
    httpClient.mockResolvedValue({
      status: 200,
      json: {
        seed: song('seed'),
        songs: [song('a'), song('b')],
        reasons: { a: { type: 'sharedIpods', count: 3 } },
      },
    })
  })

  const url = () => decodeURIComponent(httpClient.mock.calls.at(-1)[0])

  it('asks for radio songs, excluding the queued ones', async () => {
    await fetchIpodRadio({ songId: 'x', adventure: 0.5, exclude: ['q1', 'q2'] })
    expect(url()).toContain('songId=x')
    expect(url()).toContain('adventure=0.5')
    expect(url()).toContain('exclude=q1&exclude=q2')
  })

  it('asks for a surprise seed when no song is given', async () => {
    await fetchIpodRadio({})
    expect(url()).not.toContain('songId')
  })

  it('plays the seed followed by the radio songs, and starts a session', async () => {
    await playIpodRadio(dispatch, notify, { songId: 'seed', adventure: 0 })
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe('PLAYER_PLAY_TRACKS')
    expect(Object.keys(action.data)).toEqual(['seed', 'a', 'b'])
    const session = getRadioSession()
    expect(session.seed.id).toBe('seed')
    expect([...session.trackIds]).toEqual(['seed', 'a', 'b'])
    expect(session.reasons.a.count).toBe(3)
  })

  it('queues the radio songs after the current song when asked to keep playing', async () => {
    await playIpodRadio(dispatch, notify, { songId: 'seed', keepPlaying: true })
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe('PLAYER_PLAY_NEXT')
    expect(Object.keys(action.data)).toEqual(['a', 'b'])
  })

  it('warns when there is nothing to play', async () => {
    httpClient.mockResolvedValue({ status: 204 })
    await playIpodRadio(dispatch, notify, { songId: 'seed' })
    expect(notify).toHaveBeenCalledWith('ipods.radio.nothingFound', 'warning')
    expect(dispatch).not.toHaveBeenCalled()
    expect(getRadioSession()).toBeNull()
  })

  it('appends only songs that are not queued yet', async () => {
    await playIpodRadio(dispatch, notify, { songId: 'seed' })
    dispatch.mockClear()
    httpClient.mockResolvedValue({
      status: 200,
      json: { seed: song('seed'), songs: [song('a'), song('c')], reasons: {} },
    })

    await extendRadio(dispatch, ['seed', 'a', 'b'])

    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe('PLAYER_ADD_TRACKS')
    expect(Object.keys(action.data)).toEqual(['c'])
    expect(getRadioSession().trackIds.has('c')).toBe(true)
  })

  it('keeps going from the stand-in seed when the song is on no iPod', async () => {
    httpClient.mockResolvedValue({
      status: 200,
      json: {
        seed: song('seed'),
        radioSeedId: 'stand-in',
        seedFallback: true,
        songs: [song('a')],
        reasons: {},
      },
    })
    await playIpodRadio(dispatch, notify, { songId: 'seed' })
    expect(notify).toHaveBeenCalledWith('ipods.radio.standIn', 'info')
    expect(Object.keys(dispatch.mock.calls[0][0].data)).toEqual(['seed', 'a'])

    await extendRadio(dispatch, ['seed', 'a'])
    expect(url()).toContain('songId=stand-in')
  })

  it('tells listened-through songs from skipped ones', () => {
    expect(classifyListen({ currentTime: 200, duration: 240 })).toBe('listened')
    expect(classifyListen({ currentTime: 10, duration: 240 })).toBe('skipped')
    expect(classifyListen({ currentTime: 60, duration: 240 })).toBe('neutral')
    // A short song left early is a skip only while under half of it was played
    expect(classifyListen({ currentTime: 20, duration: 30 })).toBe('neutral')
    expect(classifyListen(undefined)).toBe('skipped')
  })

  it('drifts towards listened songs, avoids skipped ones and never repeats the session', async () => {
    await playIpodRadio(dispatch, notify, { songId: 'seed' })
    noteRadioProgress('a', 230, 240)
    recordRadioListen('a')
    noteRadioProgress('b', 5, 240)
    recordRadioListen('b')
    expect(getRadioSession().listened).toEqual(['a'])
    expect(getRadioSession().skipped).toEqual(['b'])

    await extendRadio(dispatch, ['b'])
    expect(url()).toContain('songId=seed')
    expect(url()).toContain('drift=a')
    expect(url()).toContain('liked=a')
    expect(url()).toContain('skipped=b')
    // Every song of the session is excluded, not only the ones still queued
    expect(url()).toContain('exclude=seed&exclude=a&exclude=b')
  })

  it('ignores songs that are not part of the radio', async () => {
    await playIpodRadio(dispatch, notify, { songId: 'seed' })
    noteRadioProgress('other', 5, 240)
    recordRadioListen('other')
    expect(getRadioSession().skipped).toEqual([])
  })
})
