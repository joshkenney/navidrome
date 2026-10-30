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
  const store = createStore(() => ({
    player: { queue, current: { uuid: current } },
  }))
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
  return { ...utils, controls }
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

  it('hides the progress for radio streams', () => {
    renderPlayer({
      queue: [song(1, { isRadio: true })],
      current: 'u1',
    })
    openPlayer()
    expect(screen.queryByLabelText('player.mobile.seek')).toBeNull()
  })
})
