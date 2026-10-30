import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { MobilePlayer } from './MobilePlayer'

// jsdom has no PointerEvent: without it, simulated pointer events have no coordinates
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {}
}

vi.mock('react-admin', () => ({
  useTranslate: () => (key, opts) =>
    opts ? `${key}:${JSON.stringify(opts)}` : key,
}))
// The actions menu has its own test: here, only which song it was opened for
vi.mock('./PlayerActions', () => ({
  PlayerActions: ({ item }) =>
    item ? <div data-testid="actions">{item.name}</div> : null,
}))
vi.mock('../../ipods/useIpodName', () => ({
  useIpodName: (id, name) => name,
}))

const song = (n, extra = {}) => ({
  uuid: `u${n}`,
  trackId: `t${n}`,
  name: `Song ${n}`,
  singer: 'Weezer',
  cover: `cover-${n}.jpg`,
  song: {
    id: `s${n}`,
    title: `Song ${n}`,
    artist: 'Weezer',
    album: 'Blue Album',
    libraryId: 2,
    libraryName: "Bob's iPod",
  },
  ...extra,
})

const fakeAudio = () => {
  const el = document.createElement('audio')
  Object.defineProperty(el, 'duration', { value: 200, configurable: true })
  Object.defineProperty(el, 'paused', { value: false, configurable: true })
  el.currentTime = 50
  return el
}

const renderPlayer = ({ queue = [song(1), song(2)], current = 'u2' } = {}) => {
  // Adding tracks appends them, like the real reducer
  const reducer = (
    state = { player: { queue, current: { uuid: current } } },
    action,
  ) =>
    action.type === 'PLAYER_ADD_TRACKS'
      ? {
          ...state,
          player: {
            ...state.player,
            queue: [
              ...state.player.queue,
              ...Object.values(action.data).map((s) => ({
                uuid: `added-${s.id}`,
                name: s.title,
                song: s,
              })),
            ],
          },
        }
      : state
  const store = createStore(reducer)
  const controls = {
    togglePlay: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    seek: vi.fn(),
    playAt: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
  }
  const utils = render(
    <Provider store={store}>
      <MobilePlayer audioInstance={fakeAudio()} controls={controls} />
    </Provider>,
  )
  return { ...utils, controls, store }
}

// The wheel is 200x200 at the top left of the page
const layOutWheel = () => {
  const wheel = screen.getByTestId('click-wheel')
  wheel.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
  })
  return wheel
}

const openPlayer = () =>
  fireEvent.click(screen.getByRole('button', { name: 'player.mobile.open' }))

describe('<MobilePlayer />', () => {
  beforeEach(() => {
    window.history.replaceState(null, '')
  })

  it('shows the song playing in a strip that never covers the page with a floating button', () => {
    renderPlayer()
    const strip = screen.getByRole('region', {
      name: 'player.mobile.nowPlaying',
    })
    expect(strip).toHaveAttribute('data-tour', 'player')
    expect(strip).toHaveTextContent('Song 2')
    expect(strip).toHaveTextContent('Weezer')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('plays and pauses from the strip without opening the player', () => {
    const { controls } = renderPlayer()
    fireEvent.click(
      screen.getByRole('button', { name: 'player.clickToPauseText' }),
    )
    expect(controls.togglePlay).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the iPod on a tap, with a still square cover', () => {
    renderPlayer()
    openPlayer()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('player.mobile.nowPlaying')
    expect(dialog).toHaveTextContent(`player.mobile.position:{"n":2,"total":2}`)
    expect(dialog).toHaveTextContent("Bob's iPod")
    const cover = screen.getByAltText('Blue Album')
    expect(cover).toHaveAttribute('src', 'cover-2.jpg')
    expect(cover.className).not.toMatch(/rotate/)
  })

  it('opens the iPod on a swipe up', () => {
    renderPlayer()
    fireEvent.pointerDown(screen.getByRole('region'), {
      clientX: 10,
      clientY: 300,
    })
    fireEvent.pointerUp(screen.getByRole('region'), {
      clientX: 14,
      clientY: 220,
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('drives the music player from the click wheel', () => {
    const { controls } = renderPlayer()
    openPlayer()
    fireEvent.click(screen.getByLabelText('player.previousTrackText'))
    fireEvent.click(screen.getByLabelText('player.nextTrackText'))
    fireEvent.click(screen.getByLabelText('player.mobile.playPause'))
    expect(controls.prev).toHaveBeenCalled()
    expect(controls.next).toHaveBeenCalled()
    expect(controls.togglePlay).toHaveBeenCalled()
  })

  it('seeks with the progress slider', () => {
    const { controls } = renderPlayer()
    openPlayer()
    fireEvent.change(screen.getByLabelText('player.mobile.seek'), {
      target: { value: '120' },
    })
    expect(controls.seek).toHaveBeenCalledWith(120)
  })

  it('closes with MENU, which goes back in history like the phone Back button', () => {
    const back = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() =>
        window.dispatchEvent(new PopStateEvent('popstate')),
      )
    renderPlayer()
    openPlayer()
    expect(window.history.state).toEqual({ ndPlayer: true })
    act(() => {
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    })
    expect(back).toHaveBeenCalled()
    expect(screen.getByRole('region')).toBeInTheDocument()
    back.mockRestore()
  })

  it('closes on a swipe down on the screen', () => {
    renderPlayer()
    openPlayer()
    window.history.replaceState(null, '')
    const screenArea = screen.getByText('player.mobile.nowPlaying', {
      selector: 'span',
    })
    fireEvent.pointerDown(screenArea, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(screenArea, { clientX: 105, clientY: 220 })
    expect(screen.getByRole('region')).toBeInTheDocument()
  })

  it('scrubs with the click wheel, seeking when the finger lifts', () => {
    const { controls } = renderPlayer()
    openPlayer()
    const wheel = screen.getByTestId('click-wheel')
    wheel.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    })
    // A quarter turn clockwise: 15 clicks of a second, from 0:50
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('1:05')
    expect(controls.seek).not.toHaveBeenCalled()
    fireEvent.pointerUp(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(controls.seek).toHaveBeenCalledWith(65)
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
  })

  it('opens Up Next with the centre button, on the song playing, and goes back with MENU', () => {
    renderPlayer({ queue: [song(1), song(2), song(3)] })
    openPlayer()
    fireEvent.click(screen.getByLabelText('player.mobile.select'))
    const list = screen.getByRole('listbox', { name: 'player.mobile.upNext' })
    expect(list).toBeInTheDocument()
    expect(screen.getByTestId('upnext-1')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('moves through Up Next with the wheel, and plays the song picked with the centre button', () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3), song(4)],
      current: 'u1',
    })
    openPlayer()
    fireEvent.click(screen.getByLabelText('player.mobile.select'))
    const wheel = layOutWheel()
    // A quarter turn clockwise: 90° is 3 clicks of 24°, from the first song to the last (clamped)
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(screen.getByTestId('upnext-3')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(controls.seek).not.toHaveBeenCalled()
    // A tap on the centre button (a touch, then a click)
    const center = screen.getByLabelText('player.mobile.select')
    fireEvent.pointerDown(center, { clientX: 100, clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(center, { clientX: 100, clientY: 100, pointerId: 2 })
    fireEvent.click(center)
    expect(controls.playAt).toHaveBeenCalledWith(3)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('removes a song from Up Next, and Undo puts it back where it was', () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3)],
      current: 'u1',
    })
    openPlayer()
    fireEvent.click(screen.getByLabelText('player.mobile.select'))
    const row = screen.getByTestId('upnext-1')
    fireEvent.pointerDown(row, { clientX: 200, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(screen.getByRole('listbox'), {
      clientX: 100,
      clientY: 12,
      pointerId: 1,
    })
    fireEvent.pointerUp(screen.getByRole('listbox'), {
      clientX: 100,
      clientY: 12,
      pointerId: 1,
    })
    expect(controls.remove).toHaveBeenCalledWith(1)
    expect(
      screen.getByText(`player.mobile.removed:{"name":"Song 2"}`),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText('player.mobile.undo'))
    // The song comes back at the end of the queue (4 songs in this fake queue, which the real
    // player would have shortened), and is moved back to where it was
    expect(controls.move).toHaveBeenCalledWith(3, 1)
  })

  it('moves on to the next song before removing the one playing', () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3)],
      current: 'u2',
    })
    openPlayer()
    fireEvent.click(screen.getByLabelText('player.mobile.select'))
    const row = screen.getByTestId('upnext-1')
    fireEvent.pointerDown(row, { clientX: 200, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(screen.getByRole('listbox'), {
      clientX: 100,
      clientY: 12,
      pointerId: 1,
    })
    fireEvent.pointerUp(screen.getByRole('listbox'), {
      clientX: 100,
      clientY: 12,
      pointerId: 1,
    })
    expect(controls.next).toHaveBeenCalled()
    // Not removed until the player has moved on (here it never does)
    expect(controls.remove).not.toHaveBeenCalled()
  })

  it('skips songs when the cover is swiped', () => {
    const { controls } = renderPlayer()
    openPlayer()
    const cover = screen.getByAltText('Blue Album')
    fireEvent.pointerDown(cover, { clientX: 200, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(cover, { clientX: 100, clientY: 105, pointerId: 1 })
    expect(controls.next).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(cover, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(cover, { clientX: 220, clientY: 96, pointerId: 1 })
    expect(controls.prev).toHaveBeenCalledTimes(1)
  })

  it('shows what to do with a song held: its cover, the strip, or a song of Up Next', () => {
    vi.useFakeTimers()
    renderPlayer({ queue: [song(1), song(2), song(3)] })
    // The strip: holding it doesn't open the player
    const strip = screen.getByRole('region')
    fireEvent.pointerDown(strip, { clientX: 50, clientY: 800, pointerId: 1 })
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(strip, { clientX: 50, clientY: 800, pointerId: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'player.mobile.open' }))
    expect(screen.getByTestId('actions')).toHaveTextContent('Song 2')
    expect(screen.queryByRole('dialog')).toBeNull()
    vi.useRealTimers()
  })

  it('shows the actions of the cover held', () => {
    vi.useFakeTimers()
    renderPlayer()
    openPlayer()
    const cover = screen.getByAltText('Blue Album')
    fireEvent.pointerDown(cover, { clientX: 100, clientY: 100, pointerId: 1 })
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(cover, { clientX: 100, clientY: 100, pointerId: 1 })
    expect(screen.getByTestId('actions')).toHaveTextContent('Song 2')
    vi.useRealTimers()
  })

  it('hides the progress for radio streams', () => {
    renderPlayer({
      queue: [song(1, { isRadio: true })],
      current: 'u1',
    })
    openPlayer()
    expect(screen.queryByLabelText('player.mobile.seek')).toBeNull()
  })
})
