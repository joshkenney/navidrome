import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import httpClient from '../dataProvider/httpClient'
import SearchPage from './SearchPage'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => notify,
  Title: () => null,
}))

const songs = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${from + i}`,
    title: `Song ${from + i}`,
    artist: 'Weezer',
    libraryId: 2,
    playCount: i === 0 ? 0 : 3,
  }))

describe('<SearchPage />', () => {
  let history

  beforeEach(() => {
    vi.clearAllMocks()
    httpClient.mockImplementation((url) => {
      if (url.startsWith('/api/genre'))
        return Promise.resolve({ json: [{ id: 'g1', name: 'Rock' }] })
      const start = Number(new URL(url, 'http://x').searchParams.get('_start'))
      return Promise.resolve({
        json: {
          songs: {
            items: songs(start ? 2 : 50, start),
            more: !start,
            matches: { s1: 'lyrics' },
          },
        },
      })
    })
  })

  const renderPage = (url) => {
    history = createMemoryHistory({ initialEntries: [url] })
    render(
      <Provider
        store={createStore(() => ({
          library: {
            userLibraries: [
              { id: 2, name: "Bob's iPod", path: '/m/bob' },
              { id: 3, name: "Ann's iPod", path: '/m/ann' },
            ],
          },
        }))}
      >
        <Router history={history}>
          <SearchPage />
        </Router>
      </Provider>,
    )
  }

  const searchCalls = () =>
    httpClient.mock.calls
      .map(([url]) => url)
      .filter((u) => u.startsWith('/api/search'))
      .map((u) => new URL(u, 'http://x').searchParams)

  it('searches with the query and filters in the address', async () => {
    renderPage(
      '/search?q=blue&type=songs&library_id=2&year_from=1990&played=unplayed',
    )
    await screen.findByText('Song 0')
    const p = searchCalls()[0]
    expect(p.get('q')).toBe('blue')
    expect(p.get('types')).toBe('songs')
    expect(p.getAll('library_id')).toEqual(['2'])
    expect(p.get('year_from')).toBe('1990')
    expect(p.get('played')).toBe('unplayed')
  })

  it('marks songs never played and where they matched', async () => {
    renderPage('/search?q=blue')
    await screen.findByText('Song 0')
    expect(screen.getByText('search.neverPlayed')).toBeInTheDocument()
    expect(screen.getByText('search.matchedIn.lyrics')).toBeInTheDocument()
  })

  it('shows more results', async () => {
    renderPage('/search?q=blue')
    await screen.findByText('Song 49')
    fireEvent.click(screen.getByText('search.page.more'))
    await screen.findByText('Song 51')
    expect(searchCalls()[1].get('_start')).toBe('50')
    expect(screen.queryByText('search.page.more')).toBeNull()
  })

  it('searches without words when a filter is set', async () => {
    renderPage('/search?type=albums&year_from=1997&year_to=1997')
    await waitFor(() => expect(searchCalls()).toHaveLength(1))
    expect(searchCalls()[0].get('types')).toBe('albums')
    expect(searchCalls()[0].get('q')).toBeNull()
  })

  it('waits for something to search', async () => {
    renderPage('/search')
    expect(screen.getByText('search.page.start')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(searchCalls()).toHaveLength(0)
  })

  it('switches between songs, albums and artists', async () => {
    renderPage('/search?q=blue')
    await screen.findByText('Song 0')
    fireEvent.click(screen.getByText('search.groups.albums'))
    expect(history.location.search).toContain('type=albums')
  })
})
