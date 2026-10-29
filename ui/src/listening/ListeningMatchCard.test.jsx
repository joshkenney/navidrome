import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import httpClient from '../dataProvider/httpClient'
import { ListeningMatchCard, SHOW_MATCH_KEY } from './ListeningMatchCard'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'

vi.mock('../dataProvider/httpClient', () => ({ default: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) =>
    opts?.name
      ? `${key}:${opts.name}${opts.artist ? `:${opts.artist}` : ''}`
      : key,
  useNotify: () => vi.fn(),
  useDataProvider: () => ({ getMany: vi.fn() }),
}))

const match = {
  listener: { id: 'josh', username: 'josh', name: 'Josh' },
  artist: { id: 'ar1', name: 'Pavement', plays: 9 },
  songs: [{ id: 's1', name: 'Cut Your Hair', plays: 4 }],
  venn: {
    mine: 3,
    shared: 2,
    theirs: 4,
    mineOnly: [],
    sharedTop: [{ id: 'a', name: 'Weezer' }],
    theirsOnly: [],
  },
  days: 30,
}

const renderCard = () =>
  render(
    <Provider store={createStore(() => ({}))}>
      <Router history={createMemoryHistory()}>
        <ListeningMatchCard />
      </Router>
    </Provider>,
  )

describe('ListeningMatchCard', () => {
  beforeEach(() => {
    localStorage.clear()
    httpClient.mockReset()
    httpClient.mockResolvedValue({ json: match })
  })

  it('shows nothing when not just logged in', async () => {
    renderCard()
    await new Promise((r) => setTimeout(r, 0))
    expect(httpClient).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('recommends what the closest listener played, once, after the welcome dialog', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.setItem(SHOW_MATCH_KEY, 'true')
    localStorage.setItem('show-welcome', 'true')
    renderCard()
    await waitFor(() => expect(httpClient).toHaveBeenCalled())
    expect(localStorage.getItem(SHOW_MATCH_KEY)).toBeNull()
    await act(async () => vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => {
      window.dispatchEvent(new Event(WELCOME_CLOSED_EVENT))
    })
    await act(async () => vi.advanceTimersByTime(2000))
    expect(
      screen.getByText('listening.match.title:Josh:Pavement'),
    ).toBeInTheDocument()
    expect(screen.getByText('Cut Your Hair')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
