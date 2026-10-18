import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodFactsDialog } from './IpodFactsDialog'
import { pickSuperlatives } from './superlatives'
import { httpClient } from '../dataProvider'

const getOne = vi.fn()

vi.mock('../dataProvider', () => ({
  httpClient: vi.fn(),
}))

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTranslate: () => (x) => x,
    useDataProvider: () => ({ getOne }),
    useNotify: () => vi.fn(),
    // eslint-disable-next-line react/display-name
    Link: React.forwardRef(({ to, children, ...props }, ref) => (
      <a href={to} ref={ref} {...props}>
        {children}
      </a>
    )),
  }
})

const stats = [
  {
    id: 1,
    name: "Alice's iPod",
    songCount: 100,
    distinctSongs: 100,
    uniqueSongs: 10,
    genreCount: 3,
    totalDuration: 36000,
    totalSize: 1e9,
    avgYear: 1975,
  },
  {
    id: 2,
    name: "Bob's iPod",
    songCount: 50,
    distinctSongs: 50,
    uniqueSongs: 40,
    genreCount: 9,
    totalDuration: 18000,
    totalSize: 5e8,
    avgYear: 2004,
  },
]

const facts = {
  totals: {
    ipods: 2,
    songs: 150,
    hours: 15,
    distinctSongs: 140,
    sharedSongs: 12,
    topGenre: 'Rock',
    topDecade: 1990,
  },
  topDuplicateSongs: [
    {
      id: 'song-1',
      title: 'Hey Ya!',
      artist: 'OutKast',
      ipodCount: 2,
      ipodNames: ["Alice's iPod", "Bob's iPod"],
    },
  ],
  topSharedArtists: [{ id: 'ar-1', name: 'OutKast', ipodCount: 2 }],
  superlatives: stats,
  twins: {
    a: { id: 1, name: "Alice's iPod" },
    b: { id: 2, name: "Bob's iPod" },
    weight: 0.42,
    sharedCount: 7,
    sharedArtists: ['Weezer', 'Blur'],
  },
  uniqueGems: [
    {
      id: 'song-2',
      title: 'Obscure B-side',
      artist: 'Someone',
      libraryId: 2,
      libraryName: "Bob's iPod",
    },
  ],
}

describe('pickSuperlatives', () => {
  it('picks the winner of each category', () => {
    const picks = Object.fromEntries(
      pickSuperlatives(stats).map((p) => [p.key, p.ipod.name]),
    )
    expect(picks).toEqual({
      biggest: "Alice's iPod",
      longest: "Alice's iPod",
      oldest: "Alice's iPod",
      newest: "Bob's iPod",
      genres: "Bob's iPod",
      unique: "Bob's iPod",
    })
  })

  it('skips "most original" when there is only one iPod', () => {
    const keys = pickSuperlatives(stats.slice(0, 1)).map((p) => p.key)
    expect(keys).not.toContain('unique')
  })
})

describe('<IpodFactsDialog />', () => {
  const store = createStore(() => ({}))

  beforeEach(() => {
    vi.clearAllMocks()
    httpClient.mockResolvedValue({ json: facts })
  })

  const renderDialog = () =>
    render(
      <Provider store={store}>
        <IpodFactsDialog open onClose={vi.fn()} />
      </Provider>,
    )

  it('shows the facts loaded from the server', async () => {
    renderDialog()
    await waitFor(() =>
      expect(screen.getByText('Hey Ya! — OutKast')).toBeInTheDocument(),
    )
    expect(httpClient).toHaveBeenCalledWith('/api/ipods/facts')
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('Obscure B-side — Someone')).toBeInTheDocument()
    expect(screen.getByText('OutKast · 2')).toBeInTheDocument()
    expect(screen.getByText("Alice's iPod ♥ Bob's iPod")).toBeInTheDocument()
    expect(screen.getByText('Blur')).toBeInTheDocument()
  })

  it('hides the twins when no iPods share artists', async () => {
    httpClient.mockResolvedValue({ json: { ...facts, twins: null } })
    renderDialog()
    await waitFor(() =>
      expect(screen.getByText('Hey Ya! — OutKast')).toBeInTheDocument(),
    )
    expect(screen.queryByText('ipods.facts.twins')).toBeNull()
  })

  it('plays a duplicate song', async () => {
    getOne.mockResolvedValue({ data: { id: 'song-1' } })
    renderDialog()
    await waitFor(() =>
      expect(screen.getByLabelText('ipods.facts.play')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByLabelText('ipods.facts.play'))
    expect(getOne).toHaveBeenCalledWith('song', { id: 'song-1' })
  })

  it('refetches when reshuffling the gems', async () => {
    renderDialog()
    await waitFor(() =>
      expect(screen.getByText('ipods.facts.reshuffle')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('ipods.facts.reshuffle'))
    expect(httpClient).toHaveBeenCalledTimes(2)
  })
})
