import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodNetworkDialog } from './IpodNetworkDialog'
import { httpClient } from '../dataProvider'

const getList = vi.fn()
const redirect = vi.fn()

vi.mock('../dataProvider', () => ({
  httpClient: vi.fn(),
}))

// The real graph draws on a canvas, which jsdom doesn't support
vi.mock('react-force-graph-2d', () => ({
  default: ({ graphData, onNodeClick }) => (
    <div data-testid="graph">
      {graphData.nodes.map((n) => (
        <button key={n.id} onClick={() => onNodeClick(n)}>
          node-{n.name}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTranslate: () => (x) => x,
    useDataProvider: () => ({ getList }),
    useRedirect: () => redirect,
  }
})

const network = {
  nodes: [
    { id: 1, name: "Alice's iPod", songCount: 100, artistCount: 20 },
    { id: 2, name: "Bob's iPod", songCount: 50, artistCount: 10 },
  ],
  edges: [
    {
      source: 1,
      target: 2,
      weight: 0.25,
      sharedCount: 5,
      sharedArtists: ['OutKast', 'Weezer'],
    },
  ],
}

const match = {
  matches: [
    {
      id: 2,
      name: "Bob's iPod",
      songCount: 50,
      score: 3,
      resonance: 80,
      matched: [{ id: 'ar-1', name: 'Weezer', songCount: 12 }],
    },
  ],
  notFound: [],
}

describe('<IpodNetworkDialog />', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    store = createStore((state = {}, action) => {
      if (action.type === 'SET_SELECTED_LIBRARIES') {
        return { ...state, selected: action.data }
      }
      return state
    })
    httpClient.mockImplementation((url) =>
      Promise.resolve({
        json: url.startsWith('/api/ipods/match') ? match : network,
      }),
    )
    // jsdom has no layout, so give the graph container a width
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    })
  })

  const renderDialog = (onClose = vi.fn()) =>
    render(
      <Provider store={store}>
        <IpodNetworkDialog open onClose={onClose} />
      </Provider>,
    )

  it('renders the network and shows details for a clicked iPod', async () => {
    renderDialog()
    await waitFor(() =>
      expect(screen.getByText("node-Alice's iPod")).toBeInTheDocument(),
    )
    expect(httpClient).toHaveBeenCalledWith('/api/ipods/network')
    expect(screen.getByText('ipods.network.selectHint')).toBeInTheDocument()

    fireEvent.click(screen.getByText("node-Alice's iPod"))
    expect(screen.getByText("Bob's iPod · 25%")).toBeInTheDocument()
    expect(screen.getByText('OutKast, Weezer')).toBeInTheDocument()
  })

  it('browses a selected iPod', async () => {
    const onClose = vi.fn()
    renderDialog(onClose)
    await waitFor(() =>
      expect(screen.getByText("node-Bob's iPod")).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText("node-Bob's iPod"))
    fireEvent.click(screen.getByText('ipods.network.browse'))
    expect(store.getState().selected).toEqual([2])
    expect(onClose).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/album')
  })

  it('finds matching iPods for the chosen artists', async () => {
    getList.mockResolvedValue({ data: [{ id: 'ar-1', name: 'Weezer' }] })
    renderDialog()
    fireEvent.click(screen.getByText('ipods.match.tab'))

    const input = screen.getByLabelText('ipods.match.artists')
    fireEvent.change(input, { target: { value: 'Wee' } })
    await waitFor(() => expect(screen.getByText('Weezer')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Weezer'))

    fireEvent.click(screen.getByText('ipods.match.find'))
    await waitFor(() =>
      expect(screen.getByText('Weezer · 12')).toBeInTheDocument(),
    )
    expect(httpClient).toHaveBeenCalledWith('/api/ipods/match?artistId=ar-1')
    expect(getList).toHaveBeenCalledWith(
      'artist',
      expect.objectContaining({ filter: { name: 'Wee' } }),
    )

    // Selecting a match jumps back to the network with that iPod highlighted
    fireEvent.click(screen.getByText(/Bob's iPod · ipods.match.resonance/))
    await waitFor(() =>
      expect(screen.getByText("node-Bob's iPod")).toBeInTheDocument(),
    )
    expect(screen.getByText('ipods.network.browse')).toBeInTheDocument()
  })
})
