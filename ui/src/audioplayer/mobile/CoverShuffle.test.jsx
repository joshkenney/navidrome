import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { CoverShuffle, COVER_MS } from './CoverShuffle'
import { fetchRandomAlbums } from './ipodBrowse'

vi.mock('./ipodBrowse', () => ({ fetchRandomAlbums: vi.fn() }))
vi.mock('../../subsonic', () => ({
  default: { getCoverArtUrl: (album) => `getCoverArt?id=al-${album.id}` },
}))

const srcs = (container) =>
  Array.from(container.querySelectorAll('img')).map((i) =>
    i.getAttribute('src'),
  )

describe('<CoverShuffle />', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("shows the iPod's album covers one after another, the next fading in over the last", async () => {
    vi.useFakeTimers()
    fetchRandomAlbums.mockResolvedValue({
      data: [
        { id: 'a', name: 'A', albumArtist: 'X' },
        { id: 'b', name: 'B', albumArtist: 'X' },
        { id: 'c', name: 'C', albumArtist: 'X' },
      ],
    })
    const { container } = render(<CoverShuffle libraryId={2} />)
    await act(async () => {})
    expect(fetchRandomAlbums).toHaveBeenCalledWith(2)
    // The first, over the last
    expect(srcs(container)[1]).toMatch(/al-a/)
    await act(async () => {
      vi.advanceTimersByTime(COVER_MS)
    })
    expect(srcs(container)).toHaveLength(2)
    expect(srcs(container)[0]).toMatch(/al-a/)
    expect(srcs(container)[1]).toMatch(/al-b/)
    await act(async () => {
      vi.advanceTimersByTime(2 * COVER_MS)
    })
    // Round again
    expect(srcs(container)[1]).toMatch(/al-a/)
  })

  it("shows the song's cover where the albums can't be had", async () => {
    fetchRandomAlbums.mockRejectedValue(new Error('offline'))
    const { container } = render(
      <CoverShuffle libraryId={2} fallback="cover.jpg" />,
    )
    await act(async () => {})
    expect(srcs(container)).toEqual(['cover.jpg'])
  })
})
