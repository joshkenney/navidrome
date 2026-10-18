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

// The real graph draws on a canvas, which jsdom doesn't support. The mock lays the
// nodes out, settles immediately and records camera moves
const camera = vi.hoisted(() => ({
  zoomToFit: vi.fn(),
  centerAt: vi.fn(),
  zoom: vi.fn(),
}))
vi.mock('react-force-graph-2d', async () => {
  const React = await import('react')
  const MockGraph = React.forwardRef(
    ({ graphData, onNodeClick, onBackgroundClick, onEngineStop }, ref) => {
      React.useImperativeHandle(ref, () => camera)
      React.useEffect(() => {
        graphData.nodes.forEach((n, i) => {
          n.x = i * 10
          n.y = i * 10
        })
        onEngineStop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <div data-testid="graph">
          {graphData.nodes.map((n) => (
            <button key={n.id} onClick={() => onNodeClick(n)}>
              node-{n.name}
            </button>
          ))}
          <button onClick={onBackgroundClick}>background</button>
        </div>
      )
    },
  )
  MockGraph.displayName = 'MockGraph'
  return { default: MockGraph }
})

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
    { id: 3, name: "Carol's iPod", songCount: 10, artistCount: 2 },
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
    // ...and the camera starts focused on it
    const filter = camera.zoomToFit.mock.calls.at(-1)[2]
    expect(filter({ id: 2 })).toBe(true)
    expect(filter({ id: 3 })).toBe(false)
  })

  describe('camera', () => {
    const focusFilter = () => camera.zoomToFit.mock.calls.at(-1)[2]

    it('fits the whole network once the layout settles', async () => {
      renderDialog()
      await waitFor(() => expect(camera.zoomToFit).toHaveBeenCalled())
      expect(focusFilter()).toBeUndefined()
    })

    it('zooms into the clicked iPod and its neighbors', async () => {
      renderDialog()
      await waitFor(() =>
        expect(screen.getByText("node-Alice's iPod")).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByText("node-Alice's iPod"))

      const filter = focusFilter()
      expect(filter({ id: 1 })).toBe(true)
      expect(filter({ id: 2 })).toBe(true)
      expect(filter({ id: 3 })).toBe(false)
    })

    it('centers on an iPod without links', async () => {
      renderDialog()
      await waitFor(() =>
        expect(screen.getByText("node-Carol's iPod")).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByText("node-Carol's iPod"))
      expect(camera.centerAt).toHaveBeenCalledWith(20, 20, expect.any(Number))
      expect(camera.zoom).toHaveBeenCalled()
    })

    it('zooms back out on background click and reset view', async () => {
      renderDialog()
      await waitFor(() =>
        expect(screen.getByText("node-Alice's iPod")).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByText("node-Alice's iPod"))
      fireEvent.click(screen.getByText('background'))
      expect(focusFilter()).toBeUndefined()
      expect(screen.getByText('ipods.network.selectHint')).toBeInTheDocument()

      camera.zoomToFit.mockClear()
      fireEvent.click(screen.getByLabelText('ipods.network.resetView'))
      expect(camera.zoomToFit).toHaveBeenCalledWith(expect.any(Number), 40)
    })

    it('hops to a neighbor from the side card', async () => {
      renderDialog()
      await waitFor(() =>
        expect(screen.getByText("node-Alice's iPod")).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByText("node-Alice's iPod"))
      fireEvent.click(screen.getByText("Bob's iPod · 25%"))

      // Bob's side card lists Alice as its closest iPod
      expect(screen.getByText("Alice's iPod · 25%")).toBeInTheDocument()
      const filter = focusFilter()
      expect(filter({ id: 2 })).toBe(true)
      expect(filter({ id: 1 })).toBe(true)
      expect(filter({ id: 3 })).toBe(false)
    })
  })
})
