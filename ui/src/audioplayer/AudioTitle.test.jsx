import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
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
    // On its own third line, after the artist and album line
    const line = screen.getByText("Alice's iPod").closest('a > span:last-child')
    expect(line.textContent).toBe("Alice's iPod")
    expect(screen.getByText('Artist').parentElement.textContent).not.toContain(
      "Alice's iPod",
    )
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

  it("selects the song's iPod when the song is clicked", () => {
    const store = createStore(
      (state, action) =>
        action.type === 'SET_SELECTED_LIBRARIES'
          ? { library: { ...state.library, selectedLibraries: action.data } }
          : state,
      {
        library: {
          userLibraries: [
            { id: 1, name: 'One' },
            { id: 3, name: "Alice's iPod" },
          ],
          selectedLibraries: [1],
        },
      },
    )
    const audioInfo = {
      trackId: 'track-1',
      song: { ...baseSong, libraryId: 3, libraryName: "Alice's iPod" },
    }
    render(
      <Provider store={store}>
        <AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />
      </Provider>,
    )
    const link = screen.getByRole('link')
    link.addEventListener('click', (e) => e.preventDefault()) // jsdom can't navigate
    fireEvent.click(link)
    expect(store.getState().library.selectedLibraries).toEqual([1, 3])
  })
})
