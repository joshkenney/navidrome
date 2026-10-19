import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodShuffleButton } from './IpodShuffleButton'

const getList = vi.fn()
const notify = vi.fn()

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) =>
    opts ? `${key}:${opts.name ?? opts.smart_count}` : key,
  useDataProvider: () => ({ getList }),
  useNotify: () => notify,
}))

const libraries = [
  { id: 1, name: "Alice's iPod" },
  { id: 2, name: "Bob's iPod" },
  { id: 3, name: "Carol's iPod" },
]

describe('<IpodShuffleButton />', () => {
  let dispatched

  beforeEach(() => {
    vi.clearAllMocks()
    dispatched = []
    getList.mockResolvedValue({
      data: [
        { id: 's1', title: 'One' },
        { id: 's2', title: 'Two' },
      ],
    })
  })

  const renderWith = (selectedLibraries) => {
    const store = createStore(
      (state = {}, action) => {
        dispatched.push(action)
        return state
      },
      { library: { userLibraries: libraries, selectedLibraries } },
    )
    render(
      <Provider store={store}>
        <IpodShuffleButton />
      </Provider>,
    )
  }

  it('shuffles all iPods when all or none are selected', () => {
    renderWith([1, 2, 3])
    expect(screen.getByLabelText('ipods.shuffle.all')).toBeInTheDocument()
  })

  it('names the selected iPod', () => {
    renderWith([2])
    expect(
      screen.getByLabelText("ipods.shuffle.one:Bob's iPod"),
    ).toBeInTheDocument()
  })

  it('counts several selected iPods', () => {
    renderWith([1, 3])
    expect(screen.getByLabelText('ipods.shuffle.some:2')).toBeInTheDocument()
  })

  it('plays a random mix of songs', async () => {
    renderWith([])
    fireEvent.click(screen.getByLabelText('ipods.shuffle.all'))
    await waitFor(() =>
      expect(dispatched.some((a) => a.type === 'PLAYER_PLAY_TRACKS')).toBe(
        true,
      ),
    )
    expect(getList).toHaveBeenCalledWith(
      'song',
      expect.objectContaining({
        sort: { field: 'random', order: 'ASC' },
        filter: { missing: false },
      }),
    )
    const play = dispatched.find((a) => a.type === 'PLAYER_PLAY_TRACKS')
    expect(Object.keys(play.data)).toEqual(['s1', 's2'])
  })

  it('warns when there is nothing to shuffle', async () => {
    getList.mockResolvedValue({ data: [] })
    renderWith([])
    fireEvent.click(screen.getByLabelText('ipods.shuffle.all'))
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('ipods.shuffle.empty', 'warning'),
    )
  })
})
