import React from 'react'
import { render, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodRadioExtender } from './IpodRadioExtender'
import {
  extendRadio,
  getRadioSession,
  noteRadioProgress,
  startRadioSession,
  stopRadioSession,
} from './radio'

vi.mock('./radio', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, extendRadio: vi.fn(() => Promise.resolve()) }
})

const item = (id) => ({ trackId: id, uuid: `uuid-${id}` })

describe('<IpodRadioExtender />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stopRadioSession()
  })

  const renderWith = (player) => {
    let state = { player }
    const store = createStore((s = state, action) =>
      action.type === 'SET_PLAYER' ? { player: action.player } : s,
    )
    const utils = render(
      <Provider store={store}>
        <IpodRadioExtender />
      </Provider>,
    )
    return {
      ...utils,
      setPlayer: (p) => store.dispatch({ type: 'SET_PLAYER', player: p }),
    }
  }

  it('queues more songs when the radio is about to run out', async () => {
    startRadioSession({
      seed: { id: 'a' },
      adventure: 0,
      trackIds: ['a', 'b', 'c'],
    })
    renderWith({ queue: [item('a'), item('b'), item('c')], current: item('b') })
    await waitFor(() => expect(extendRadio).toHaveBeenCalled())
    expect(extendRadio.mock.calls[0][1]).toEqual(['a', 'b', 'c'])
  })

  it('waits while enough songs are left', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    startRadioSession({ seed: { id: 'a' }, adventure: 0, trackIds: ids })
    renderWith({ queue: ids.map(item), current: item('a') })
    expect(extendRadio).not.toHaveBeenCalled()
  })

  it('stops the radio when the queue was replaced', async () => {
    startRadioSession({ seed: { id: 'a' }, adventure: 0, trackIds: ['a', 'b'] })
    await act(async () => {
      renderWith({ queue: [item('x'), item('y')], current: item('x') })
    })
    expect(getRadioSession()).toBeNull()
    expect(extendRadio).not.toHaveBeenCalled()
  })

  it('notes a skip when the player moves on early', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    startRadioSession({ seed: { id: 'a' }, adventure: 0, trackIds: ids })
    const queue = ids.map(item)
    const { setPlayer } = renderWith({ queue, current: item('b') })
    noteRadioProgress('b', 4, 200)
    await act(async () => {
      setPlayer({ queue, current: item('c') })
    })
    expect(getRadioSession().skipped).toEqual(['b'])
  })
})
