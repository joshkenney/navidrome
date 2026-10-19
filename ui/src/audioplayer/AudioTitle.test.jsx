import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AudioTitle from './AudioTitle'

vi.mock('@material-ui/core', async () => {
  const actual = await import('@material-ui/core')
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  }
})

vi.mock('react-router-dom', () => ({
  // eslint-disable-next-line react/display-name
  Link: React.forwardRef(({ to, children, ...props }, ref) => (
    <a href={to} ref={ref} {...props}>
      {children}
    </a>
  )),
}))

vi.mock('react-dnd', () => ({
  useDrag: vi.fn(() => [null, () => {}]),
}))

describe('<AudioTitle />', () => {
  const baseSong = {
    id: 'song-1',
    albumId: 'album-1',
    playlistId: 'playlist-1',
    title: 'Test Song',
    artist: 'Artist',
    album: 'Album',
    year: '2020',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links to playlist when playlistId is provided', () => {
    const audioInfo = { trackId: 'track-1', song: baseSong }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/playlist/playlist-1/show')
  })

  it('falls back to album link when no playlistId', () => {
    const audioInfo = {
      trackId: 'track-1',
      song: { ...baseSong, playlistId: undefined },
    }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/album/album-1/show')
  })

  it('shows the iPod the song comes from, with the iPod logo', () => {
    const audioInfo = {
      trackId: 'track-1',
      song: { ...baseSong, libraryId: 3, libraryName: "Alice's iPod" },
    }
    const { container } = render(
      <AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />,
    )
    expect(screen.getByText("Alice's iPod")).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('shows the iPod on its own line on mobile', () => {
    const audioInfo = {
      trackId: 'track-1',
      song: { ...baseSong, libraryName: "Bob's iPod" },
    }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={true} />)
    expect(screen.getByText("Bob's iPod")).toBeInTheDocument()
  })

  it('shows no iPod for internet radio streams', () => {
    const audioInfo = {
      trackId: 'radio-1',
      isRadio: true,
      song: { ...baseSong, libraryName: "Alice's iPod" },
    }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />)
    expect(screen.queryByText("Alice's iPod")).toBeNull()
  })
})
