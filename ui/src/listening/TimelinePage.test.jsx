import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import httpClient from '../dataProvider/httpClient'
import TimelinePage from './TimelinePage'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) =>
    opts?.smart_count !== undefined ? `${key}:${opts.smart_count}` : key,
  useNotify: () => notify,
  Title: () => null,
}))

const play = (id, time, extra = {}) => ({
  id,
  title: `Song ${id}`,
  artist: 'Weezer',
  album: 'Blue',
  albumId: 'al1',
  submissionTime: time,
  libraryId: 2,
  libraryName: "Bob's iPod",
  ...extra,
})

const timeline = {
  days: [
    { date: '2026-06-01', plays: 2, seconds: 400 },
    { date: '2026-06-08', plays: 1, seconds: 200 },
  ],
  totals: { plays: 3, seconds: 600, songs: 2, albums: 1, artists: 1 },
  topArtists: [{ id: 'ar1', name: 'Weezer', plays: 3 }],
  topAlbums: [
    { id: 'al1', name: 'Blue', albumId: 'al1', plays: 3, libraryId: 2 },
  ],
  topSongs: [{ id: 's1', name: 'Song s1', plays: 2 }],
  topIpods: [{ id: '2', name: "Bob's iPod", libraryId: 2, plays: 3 }],
  plays: [
    play('s2', '2026-06-08T22:00:00Z'),
    play('s1', '2026-06-01T10:00:00Z'),
    play('s1', '2026-06-01T09:00:00Z'),
  ],
  gaps: [{ from: '2026-06-02', to: '2026-06-07', days: 6 }],
  first: '2026-06-01T09:00:00Z',
  user: { id: 'me', username: 'me' },
}

describe('<TimelinePage />', () => {
  let history, actions

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('userId', 'me')
    httpClient.mockImplementation((url) =>
      Promise.resolve({
        json: url.startsWith('/api/listening/users')
          ? [
              { id: 'me', username: 'me' },
              { id: 'friend', username: 'friend', name: 'Friend' },
            ]
          : timeline,
      }),
    )
  })

  const renderPage = (url = '/timeline?from=2026-06-01&to=2026-06-30') => {
    history = createMemoryHistory({ initialEntries: [url] })
    actions = []
    const store = createStore(
      (state, action) => {
        actions.push(action)
        return state
      },
      { library: { userLibraries: [], selectedLibraries: [] } },
    )
    render(
      <Provider store={store}>
        <Router history={history}>
          <TimelinePage />
        </Router>
      </Provider>,
    )
  }

  const timelineCalls = () =>
    httpClient.mock.calls
      .map(([url]) => url)
      .filter((u) => u.includes('/timeline'))

  it('loads the days in the address, in the local time zone', async () => {
    renderPage()
    await screen.findByText('listening.timeline.plays')
    const url = new URL(timelineCalls()[0], 'http://x')
    expect(url.searchParams.get('from')).toBe('2026-06-01')
    expect(url.searchParams.get('to')).toBe('2026-06-30')
    expect(url.searchParams.get('tz')).toBe(
      String(-new Date().getTimezoneOffset()),
    )
  })

  it('shows the totals, favourites, silences and plays by day', async () => {
    renderPage()
    expect(
      await screen.findByText('listening.timeline.topArtists'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Weezer').length).toBeGreaterThan(0)
    expect(screen.getByText(/listening.timeline.silence:6/)).toBeInTheDocument()
    expect(screen.getAllByText('Song s1 — Weezer')).toHaveLength(2)
    // One bar per day of June
    expect(
      screen.getAllByRole('listitem', { hidden: true }).length,
    ).toBeGreaterThanOrEqual(30)
  })

  it('jumps to a typed date', async () => {
    renderPage()
    await screen.findByText('listening.timeline.plays')
    const input = screen.getByLabelText('listening.timeline.jumpPlaceholder')
    fireEvent.change(input, { target: { value: '2025-03-14' } })
    fireEvent.submit(input.closest('form'))
    expect(history.location.search).toBe('?from=2025-03-14&to=2025-03-14')
  })

  it('says when a typed date is not understood', async () => {
    renderPage()
    await screen.findByText('listening.timeline.plays')
    const input = screen.getByLabelText('listening.timeline.jumpPlaceholder')
    fireEvent.change(input, { target: { value: 'whenever' } })
    fireEvent.submit(input.closest('form'))
    expect(screen.getByText('listening.timeline.jumpError')).toBeInTheDocument()
  })

  it('zooms in on a day from the chart', async () => {
    renderPage()
    await screen.findByText('listening.timeline.plays')
    fireEvent.click(screen.getByLabelText(/Jun 8, 2026/))
    expect(history.location.search).toBe('?from=2026-06-08&to=2026-06-08')
  })

  it('replays the days in the order they were played', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('listening.timeline.replay'))
    const action = actions.find((a) => a.type === 'PLAYER_PLAY_TRACKS')
    expect(Object.keys(action.data)).toEqual(['s1', 's2'])
  })

  it("shows another listener's timeline", async () => {
    renderPage('/timeline?user=friend')
    await waitFor(() => expect(timelineCalls()[0]).toContain('user=friend'))
  })

  it('says when nothing was played', async () => {
    httpClient.mockImplementation((url) =>
      Promise.resolve({
        json: url.startsWith('/api/listening/users')
          ? []
          : {
              ...timeline,
              totals: { plays: 0 },
              days: [],
              plays: [],
              gaps: [],
            },
      }),
    )
    renderPage()
    expect(
      await screen.findByText('listening.timeline.emptyRange'),
    ).toBeInTheDocument()
  })
})
