import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import httpClient from '../dataProvider/httpClient'
import ErasPage from './ErasPage'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) => (opts?.name ? `${key}:${opts.name}` : key),
  useNotify: () => notify,
  Title: () => null,
}))

const eras = {
  years: [
    { year: 1967, songs: 10, played: 2 },
    { year: 1971, songs: 30, played: 3 },
    { year: 1975, songs: 20, played: 0 },
  ],
  undated: 4,
}

const era = (from, to) => ({
  from,
  to,
  songs: 50,
  played: 3,
  artists: [{ id: 'ar1', name: 'Funkadelic', songs: 12, plays: 1 }],
  albums: [
    { id: 'al1', name: 'Maggot Brain', albumId: 'al1', ipods: 2, libraryId: 2 },
  ],
  genres: [{ name: 'Funk', songs: 20 }],
  ipods: [
    {
      id: '2',
      name: "Bob's iPod",
      libraryId: 2,
      libraryName: "Bob's iPod",
      songs: 30,
    },
  ],
})

describe('<ErasPage />', () => {
  let history, actions

  beforeEach(() => {
    vi.clearAllMocks()
    httpClient.mockImplementation((url) => {
      const p = new URL(url, 'http://x').searchParams
      if (url.startsWith('/api/eras/play')) {
        return Promise.resolve({ json: [{ id: 's1', title: 'Song' }] })
      }
      if (url.startsWith('/api/eras/era')) {
        return Promise.resolve({
          json: era(Number(p.get('from')), Number(p.get('to'))),
        })
      }
      return Promise.resolve({ json: eras })
    })
  })

  const renderPage = (url = '/eras') => {
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
          <ErasPage />
        </Router>
      </Provider>,
    )
  }

  const calls = (prefix) =>
    httpClient.mock.calls.map(([u]) => u).filter((u) => u.startsWith(prefix))

  it('starts with the decade with the most music', async () => {
    renderPage()
    expect(await screen.findByText('eras.theDecade:1970s')).toBeInTheDocument()
    expect(calls('/api/eras/era')[0]).toBe('/api/eras/era?from=1970&to=1979')
    expect(await screen.findByText('Funkadelic')).toBeInTheDocument()
    expect(screen.getByText('Maggot Brain')).toBeInTheDocument()
  })

  it('opens the era in the address', async () => {
    renderPage('/eras?from=1967&to=1967')
    expect(
      await screen.findByRole('heading', { name: '1967' }),
    ).toBeInTheDocument()
    expect(calls('/api/eras/era')[0]).toBe('/api/eras/era?from=1967&to=1967')
  })

  it('moves to another decade, or to a year from the chart', async () => {
    renderPage()
    fireEvent.click(await screen.findByText(/^1960s ·/))
    expect(history.location.search).toBe('?from=1960&to=1969')
    fireEvent.click(screen.getByLabelText('1975: eras.songs'))
    expect(history.location.search).toBe('?from=1975&to=1975')
    fireEvent.click(screen.getByLabelText('eras.earlier'))
    expect(history.location.search).toBe('?from=1974&to=1974')
  })

  it('shuffles the era', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('eras.shuffle:1970s'))
    await waitFor(() =>
      expect(actions.some((a) => a.type === 'PLAYER_PLAY_TRACKS')).toBe(true),
    )
    expect(calls('/api/eras/play')[0]).toBe(
      '/api/eras/play?from=1970&to=1979&mode=shuffle&count=60',
    )
  })

  it('journeys through the era, only songs not heard yet', async () => {
    renderPage()
    await screen.findByText('Funkadelic')
    fireEvent.click(screen.getByLabelText('eras.unplayed'))
    fireEvent.click(screen.getByText('eras.journey:1970s'))
    await waitFor(() => expect(calls('/api/eras/play')).toHaveLength(1))
    expect(calls('/api/eras/play')[0]).toBe(
      '/api/eras/play?from=1970&to=1979&mode=journey&unplayed=true&count=60',
    )
  })

  it('plays through the decades, from the first year to the last', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('eras.playHistory'))
    await waitFor(() => expect(calls('/api/eras/play')).toHaveLength(1))
    expect(calls('/api/eras/play')[0]).toContain(
      'from=1967&to=1975&mode=journey',
    )
  })

  it('shuffles a genre of the era', async () => {
    renderPage()
    fireEvent.click(await screen.findByText(/^Funk ·/))
    await waitFor(() => expect(calls('/api/eras/play')).toHaveLength(1))
    expect(calls('/api/eras/play')[0]).toContain('genre=Funk')
  })
})
