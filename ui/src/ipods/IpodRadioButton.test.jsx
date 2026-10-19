import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodRadioButton } from './IpodRadioButton'
import { playIpodRadio, startRadioSession, stopRadioSession } from './radio'
import { httpClient } from '../dataProvider'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

vi.mock('./radio', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, playIpodRadio: vi.fn(() => Promise.resolve()) }
})

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => vi.fn(),
}))

describe('<IpodRadioButton />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stopRadioSession()
  })

  const open = (player = { queue: [], current: {} }) => {
    render(
      <Provider store={createStore(() => ({ player }))}>
        <IpodRadioButton />
      </Provider>,
    )
    fireEvent.click(screen.getByLabelText('ipods.radio.title'))
  }

  it('cannot start from the current song when nothing is playing', () => {
    open()
    expect(
      screen.getByText('ipods.radio.startCurrent').closest('button'),
    ).toBeDisabled()
  })

  it('starts from the current song, keeping it playing', async () => {
    open({ queue: [], current: { trackId: 'song-1', uuid: 'u1' } })
    fireEvent.click(screen.getByText('ipods.radio.startCurrent'))
    await waitFor(() => expect(playIpodRadio).toHaveBeenCalled())
    expect(playIpodRadio.mock.calls[0][2]).toMatchObject({
      songId: 'song-1',
      keepPlaying: true,
    })
  })

  it('starts a surprise radio without a seed song', async () => {
    open()
    fireEvent.click(screen.getByText('ipods.radio.surprise'))
    await waitFor(() => expect(playIpodRadio).toHaveBeenCalled())
    expect(playIpodRadio.mock.calls[0][2].songId).toBeUndefined()
  })

  it('stays visible and marks the button while a radio plays', () => {
    act(() => {
      startRadioSession({
        seed: { id: 's', title: 'Buddy Holly', artist: 'Weezer' },
        adventure: 0,
        trackIds: ['s'],
        reasons: {},
      })
    })
    render(
      <Provider
        store={createStore(() => ({ player: { queue: [], current: {} } }))}
      >
        <IpodRadioButton />
      </Provider>,
    )
    const button = screen.getByLabelText('ipods.radio.title')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('data-playing', 'true')
  })

  it('shows the running radio and can stop it', () => {
    act(() => {
      startRadioSession({
        seed: { id: 's', title: 'Buddy Holly', artist: 'Weezer' },
        adventure: 0,
        trackIds: ['s'],
        reasons: {},
      })
    })
    open()
    expect(screen.getByText('ipods.radio.playingFrom')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ipods.radio.stop'))
    expect(screen.queryByText('ipods.radio.playingFrom')).toBeNull()
  })

  it('spins while a radio is starting, from anywhere', async () => {
    const actual = await vi.importActual('./radio')
    let respond
    httpClient.mockReturnValue(new Promise((resolve) => (respond = resolve)))
    render(
      <Provider
        store={createStore(() => ({ player: { queue: [], current: {} } }))}
      >
        <IpodRadioButton />
      </Provider>,
    )
    const button = screen.getByLabelText('ipods.radio.title')
    let started
    act(() => {
      // As the song menu does
      started = actual.playIpodRadio(vi.fn(), vi.fn(), { songId: 'song-1' })
    })
    expect(button.querySelector('[role="progressbar"]')).toBeTruthy()
    await act(async () => {
      respond({ status: 204 })
      await started
    })
    expect(button.querySelector('[role="progressbar"]')).toBeNull()
  })
})
