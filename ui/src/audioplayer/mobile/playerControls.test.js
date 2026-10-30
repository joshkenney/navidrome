import { describe, it, expect, vi } from 'vitest'
import { makeControls } from './playerControls'

const audio = () => ({
  togglePlay: vi.fn(),
  playNext: vi.fn(),
  playPrev: vi.fn(),
  playByIndex: vi.fn(),
  currentTime: 0,
})

const player = () => ({
  state: {
    audioLists: [{ __PLAYER_KEY__: 'k0' }, { __PLAYER_KEY__: 'k1' }],
  },
  onAudioListsSortEnd: vi.fn(),
  onDeleteAudioLists: vi.fn(() => vi.fn()),
})

describe('makeControls', () => {
  it("uses the audio element's own controls", () => {
    const a = audio()
    const c = makeControls(a, { current: null })
    c.togglePlay()
    c.next()
    c.prev()
    c.playAt(3)
    expect(a.togglePlay).toHaveBeenCalled()
    expect(a.playNext).toHaveBeenCalled()
    expect(a.playPrev).toHaveBeenCalled()
    expect(a.playByIndex).toHaveBeenCalledWith(3)
  })

  it("seeks through the player's own seek, so a paused song stays paused", () => {
    const a = audio()
    const p = { ...player(), onAudioSeeked: vi.fn() }
    const c = makeControls(a, { current: p })
    c.seek(42)
    expect(p.onAudioSeeked).toHaveBeenCalledWith(42)
    c.seek(-3)
    expect(p.onAudioSeeked).toHaveBeenLastCalledWith(0)
  })

  it('seeks the audio itself when the player is not there, never before the start', () => {
    const a = audio()
    const c = makeControls(a, { current: null })
    c.seek(42)
    expect(a.currentTime).toBe(42)
    c.seek(-5)
    expect(a.currentTime).toBe(0)
    c.seek(NaN)
    expect(a.currentTime).toBe(0)
  })

  it('moves songs in the queue through the player, like its own queue panel', () => {
    const p = player()
    const c = makeControls(audio(), { current: p })
    c.move(0, 1)
    expect(p.onAudioListsSortEnd).toHaveBeenCalledWith({
      oldIndex: 0,
      newIndex: 1,
    })
    c.move(1, 1)
    expect(p.onAudioListsSortEnd).toHaveBeenCalledTimes(1)
  })

  it("removes a song by the player's own key for it", () => {
    const p = player()
    const handler = vi.fn()
    p.onDeleteAudioLists.mockReturnValue(handler)
    const c = makeControls(audio(), { current: p })
    c.remove(1)
    expect(p.onDeleteAudioLists).toHaveBeenCalledWith('k1')
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ stopPropagation: expect.any(Function) }),
    )
    c.remove(7)
    expect(p.onDeleteAudioLists).toHaveBeenCalledTimes(1)
  })

  it('does nothing before the player is ready', () => {
    const c = makeControls(null, { current: null })
    expect(() => {
      c.togglePlay()
      c.next()
      c.seek(10)
      c.move(0, 1)
      c.remove(0)
    }).not.toThrow()
  })
})
