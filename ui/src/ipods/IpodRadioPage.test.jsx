import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import IpodRadioPage from './IpodRadioPage'
import { httpClient } from '../dataProvider'
import { playIpodRadio } from './radio'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

vi.mock('./radio', async (importOriginal) => ({
  ...(await importOriginal()),
  playIpodRadio: vi.fn(() => Promise.resolve()),
}))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => vi.fn(),
  Title: () => null,
}))

const history = [
  {
    seedId: 's1',
    title: 'Buddy Holly',
    artist: 'Weezer',
    libraryName: "Alice's iPod",
    adventure: 0.8,
    startedAt: '2026-10-18T20:00:00Z',
  },
  {
    seedId: 's2',
    title: 'Song 2',
    artist: 'Blur',
    adventure: 0,
    surprise: true,
    startedAt: '2026-10-17T20:00:00Z',
  },
]

describe('<IpodRadioPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    httpClient.mockImplementation((url, options) =>
      Promise.resolve({
        json: options?.method === 'DELETE' ? [history[1]] : history,
      }),
    )
  })

  const renderPage = () =>
    render(
      <Provider store={createStore(() => ({}))}>
        <IpodRadioPage />
      </Provider>,
    )

  it('lists the last radios, with their iPod and setting', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Buddy Holly — Weezer')).toBeInTheDocument(),
    )
    expect(screen.getByText('Song 2 — Blur')).toBeInTheDocument()
    expect(screen.getByText("Alice's iPod")).toBeInTheDocument()
    expect(screen.getByText('ipods.radio.deepCuts')).toBeInTheDocument()
    expect(screen.getByText('ipods.radio.balanced')).toBeInTheDocument()
  })

  it('plays a radio again with its setting', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getAllByLabelText('ipods.radio.playAgain')).toHaveLength(2),
    )
    fireEvent.click(screen.getAllByLabelText('ipods.radio.playAgain')[0])
    expect(playIpodRadio.mock.calls[0][2]).toEqual({
      songId: 's1',
      adventure: 0.8,
    })
  })

  it('removes a radio from the history', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getAllByLabelText('ipods.radio.remove')).toHaveLength(2),
    )
    fireEvent.click(screen.getAllByLabelText('ipods.radio.remove')[0])
    await waitFor(() =>
      expect(screen.queryByText('Buddy Holly — Weezer')).toBeNull(),
    )
    expect(httpClient).toHaveBeenCalledWith(
      '/api/ipods/radio/history?seedId=s1',
      { method: 'DELETE' },
    )
  })

  it('clears the history after confirming', async () => {
    window.confirm = vi.fn(() => true)
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('ipods.radio.clearHistory')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('ipods.radio.clearHistory'))
    await waitFor(() =>
      expect(screen.getByText('ipods.radio.historyEmpty')).toBeInTheDocument(),
    )
  })

  it('says when there is no history yet', async () => {
    httpClient.mockResolvedValue({ json: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('ipods.radio.historyEmpty')).toBeInTheDocument(),
    )
  })
})
