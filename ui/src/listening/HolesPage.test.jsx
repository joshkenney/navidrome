import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import httpClient from '../dataProvider/httpClient'
import HolesPage from './HolesPage'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => notify,
  Title: () => null,
}))

const holes = {
  ipods: [
    { id: '2', name: "Bob's iPod", libraryId: 2, total: 200, played: 10 },
  ],
  decades: [{ id: '1990', name: '1990s', total: 50, played: 25 }],
  genres: [{ id: 'g1', name: 'Jazz', total: 12, played: 0 }],
  artists: [{ id: 'ar1', name: 'Pavement', songs: 40 }],
  albums: [
    { id: 'al1', name: 'Wowee Zowee', albumId: 'al1', ipods: 3, libraryId: 2 },
  ],
  forgottenArtists: [
    {
      id: 'ar2',
      name: 'Weezer',
      plays: 80,
      lastPlayed: '2025-01-01T00:00:00Z',
    },
  ],
  forgottenAlbums: [],
  forgottenSongs: [],
  community: [
    { id: 'ar3', name: 'Slint', listeners: ['ann', 'bob'], plays: 30 },
  ],
  gaps: [{ from: '2026-06-02', to: '2026-06-12', days: 11 }],
  summary: {
    firstPlay: '2026-01-01',
    lastPlay: '2026-10-20',
    listeningDays: 120,
    spanDays: 300,
    daysSinceLast: 8,
    forgottenAfterDays: 180,
  },
}

describe('<HolesPage />', () => {
  let history, actions

  beforeEach(() => {
    vi.clearAllMocks()
    httpClient.mockResolvedValue({ json: holes })
    history = createMemoryHistory({ initialEntries: ['/holes'] })
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
          <HolesPage />
        </Router>
      </Provider>,
    )
  })

  it('shows every kind of hole', async () => {
    expect(await screen.findByText('Pavement')).toBeInTheDocument()
    expect(screen.getByText('Wowee Zowee')).toBeInTheDocument()
    expect(screen.getByText('1990s')).toBeInTheDocument()
    expect(screen.getByText('Jazz')).toBeInTheDocument()
    expect(screen.getByText('Weezer')).toBeInTheDocument()
    expect(screen.getByText('Slint')).toBeInTheDocument()
    expect(screen.getAllByText("Bob's iPod").length).toBeGreaterThan(0)
  })

  it('shows a silence on the timeline, with a few days around it', async () => {
    fireEvent.click(await screen.findByText(/listening.timeline.silence/))
    expect(history.location.pathname).toBe('/timeline')
    expect(history.location.search).toBe('?from=2026-05-30&to=2026-06-15')
  })

  it("opens an artist you've never played", async () => {
    fireEvent.click(await screen.findByText('Pavement'))
    expect(history.location.pathname).toBe('/artist/ar1/show')
  })

  it("lists an iPod's albums", async () => {
    fireEvent.click(await screen.findByText("Bob's iPod"))
    expect(actions).toContainEqual(
      expect.objectContaining({ type: 'SET_SELECTED_LIBRARIES', data: [2] }),
    )
    expect(history.location.pathname).toBe('/album')
  })

  it('finds the holes again on demand', async () => {
    await screen.findByText('Pavement')
    fireEvent.click(screen.getByText('listening.holes.refresh'))
    await waitFor(() => expect(httpClient).toHaveBeenCalledTimes(2))
    expect(httpClient.mock.calls[1][0]).toContain('refresh=true')
  })
})
