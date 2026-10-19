import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { GlobalSearch } from './GlobalSearch'
import { fetchRadioHistory, searchEverything } from './searchEverything'
import { playIpodRadio } from '../ipods/radio'

vi.mock('./searchEverything', async (importOriginal) => ({
  ...(await importOriginal()),
  searchEverything: vi.fn(),
  fetchRadioHistory: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../ipods/radio', async (importOriginal) => ({
  ...(await importOriginal()),
  playIpodRadio: vi.fn(() => Promise.resolve()),
}))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => vi.fn(),
}))

const empty = {
  ipods: [],
  artists: [],
  albums: [],
  songs: [],
  playlists: [],
  genres: [],
  radios: [],
}

const libraries = [
  { id: 1, name: "Alice's iPod" },
  { id: 2, name: "Bob's iPod" },
]

describe('<GlobalSearch />', () => {
  let store, history, actions

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    actions = []
    store = createStore(
      (state, action) => {
        actions.push(action)
        return action.type === 'SET_SELECTED_LIBRARIES'
          ? { library: { ...state.library, selectedLibraries: action.data } }
          : state
      },
      { library: { userLibraries: libraries, selectedLibraries: [1] } },
    )
    history = createMemoryHistory()
    render(
      <Provider store={store}>
        <Router history={history}>
          <GlobalSearch />
        </Router>
      </Provider>,
    )
  })

  const search = async (text, found) => {
    searchEverything.mockResolvedValue({ ...empty, ...found })
    fireEvent.click(screen.getByLabelText('search.tooltip'))
    fireEvent.change(screen.getByLabelText('search.placeholder'), {
      target: { value: text },
    })
    await waitFor(() => expect(searchEverything).toHaveBeenCalled())
    return screen.getByLabelText('search.placeholder')
  }

  it('opens from the header button and loads the radio history', async () => {
    fireEvent.click(screen.getByLabelText('search.tooltip'))
    expect(screen.getByLabelText('search.placeholder')).toBeInTheDocument()
    await waitFor(() => expect(fetchRadioHistory).toHaveBeenCalled())
  })

  it('waits for two characters before searching', async () => {
    fireEvent.click(screen.getByLabelText('search.tooltip'))
    fireEvent.change(screen.getByLabelText('search.placeholder'), {
      target: { value: 'w' },
    })
    await new Promise((r) => setTimeout(r, 300))
    expect(searchEverything).not.toHaveBeenCalled()
  })

  it('searches with every iPod and shows results grouped', async () => {
    await search('wee', {
      artists: [{ id: 'ar1', name: 'Weezer' }],
      albums: [{ id: 'al1', name: 'Blue', albumArtist: 'Weezer' }],
    })
    expect(searchEverything.mock.calls[0][0]).toBe('wee')
    expect(searchEverything.mock.calls[0][1].userLibraries).toEqual(libraries)
    expect(await screen.findByText('search.groups.artists')).toBeInTheDocument()
    expect(screen.getByText('search.groups.albums')).toBeInTheDocument()
    expect(screen.queryByText('search.groups.songs')).toBeNull()
    expect(screen.getByText('Blue')).toBeInTheDocument()
  })

  it('says when nothing is found', async () => {
    await search('zzz', {})
    expect(await screen.findByText('search.noResults')).toBeInTheDocument()
  })

  it('opens an album from another iPod with the keyboard, selecting its iPod', async () => {
    const input = await search('blue', {
      artists: [{ id: 'ar1', name: 'Weezer' }],
      albums: [{ id: 'al1', name: 'Blue', libraryId: 2 }],
    })
    await screen.findByText('Blue')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(history.location.pathname).toBe('/album/al1/show')
    expect(store.getState().library.selectedLibraries).toEqual([1, 2])
    await waitFor(() =>
      expect(screen.queryByLabelText('search.placeholder')).toBeNull(),
    )
  })

  it('plays a song', async () => {
    const input = await search('buddy', {
      songs: [{ id: 's1', title: 'Buddy Holly', albumId: 'al1', libraryId: 1 }],
    })
    await screen.findByText('Buddy Holly')
    fireEvent.keyDown(input, { key: 'Enter' })
    const play = actions.find((a) => a.type === 'PLAYER_PLAY_TRACKS')
    expect(play.id).toBe('s1')
  })

  it("opens a song's album", async () => {
    await search('buddy', {
      songs: [{ id: 's1', title: 'Buddy Holly', albumId: 'al1', libraryId: 1 }],
    })
    fireEvent.click(await screen.findByLabelText('search.goToAlbum'))
    expect(history.location.pathname).toBe('/album/al1/show')
  })

  it('plays a past iPod radio again', async () => {
    const input = await search('buddy', {
      radios: [{ seedId: 's1', title: 'Buddy Holly', adventure: 0.5 }],
    })
    await screen.findByText('Buddy Holly')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(playIpodRadio.mock.calls[0][2]).toEqual({
      songId: 's1',
      adventure: 0.5,
    })
  })

  it('opens a genre as a filtered album list', async () => {
    const input = await search('rock', {
      genres: [{ id: 'g1', name: 'Rock' }],
    })
    await screen.findByText('Rock')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(history.location.pathname).toBe('/album')
    expect(decodeURIComponent(history.location.search)).toContain(
      '{"genre_id":["g1"]}',
    )
  })
})
