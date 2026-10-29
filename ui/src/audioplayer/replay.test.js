import { describe, it, expect, beforeEach, vi } from 'vitest'
import { refreshView } from 'react-admin'
import { httpClient } from '../dataProvider'
import { addToReplay, reachedReplay } from './replay'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

describe('reachedReplay', () => {
  const info = { trackId: 's1', duration: 200 }

  it('is reached at 85% of a song', () => {
    expect(reachedReplay({ ...info, currentTime: 169 })).toBe(false)
    expect(reachedReplay({ ...info, currentTime: 170 })).toBe(true)
    expect(reachedReplay({ ...info, currentTime: 200 })).toBe(true)
  })

  it('ignores radio streams and songs without a known length', () => {
    expect(reachedReplay({ ...info, currentTime: 190, isRadio: true })).toBe(
      false,
    )
    expect(
      reachedReplay({ trackId: 's1', currentTime: 190, duration: NaN }),
    ).toBe(false)
    expect(reachedReplay({ currentTime: 190, duration: 200 })).toBe(false)
  })
})

describe('addToReplay', () => {
  const dispatch = vi.fn()

  beforeEach(() => {
    dispatch.mockReset()
    httpClient.mockReset()
    window.location.hash = '#/album/al1/show'
  })

  it('posts the song to the Replay endpoint', async () => {
    httpClient.mockResolvedValue({ json: { added: true, playlistId: 'p1' } })
    await addToReplay(dispatch, 's1')
    expect(httpClient).toHaveBeenCalledWith('/api/replay/s1', {
      method: 'POST',
    })
  })

  it('refreshes the page when the Replay playlist was just created, to show it in the menu', async () => {
    httpClient.mockResolvedValue({
      json: { created: true, added: true, playlistId: 'p1' },
    })
    await addToReplay(dispatch, 's1')
    expect(dispatch).toHaveBeenCalledWith(refreshView())
  })

  it('refreshes the Replay playlist when it is on screen', async () => {
    window.location.hash = '#/playlist/p1/show'
    httpClient.mockResolvedValue({ json: { added: true, playlistId: 'p1' } })
    await addToReplay(dispatch, 's1')
    expect(dispatch).toHaveBeenCalledWith(refreshView())
  })

  it("doesn't refresh other pages when a song is added", async () => {
    httpClient.mockResolvedValue({ json: { added: true, playlistId: 'p1' } })
    await addToReplay(dispatch, 's1')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('ignores errors', async () => {
    httpClient.mockRejectedValue(new Error('offline'))
    await expect(addToReplay(dispatch, 's1')).resolves.toBeUndefined()
  })
})
