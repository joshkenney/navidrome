import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { MobilePlayer } from './MobilePlayer'
import subsonic from '../../subsonic'
import { forgetCovers } from './realCover'

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
// The iPod's library: Weezer's Blue Album on Bob's iPod (library 2), among other artists
vi.mock('./ipodBrowse', () => {
  const ok = (data) => Promise.resolve({ data, total: data.length })
  return {
    PAGE: 100,
    fetchArtists: vi.fn(() =>
      ok([
        { id: 'ar0', name: 'Pavement' },
        { id: 'ar1', name: 'Weezer' },
      ]),
    ),
    fetchArtistAlbums: vi.fn(() =>
      ok([
        { id: 'al0', name: 'Pinkerton', maxYear: 1996 },
        { id: 'al1', name: 'Blue Album', maxYear: 1994 },
      ]),
    ),
    fetchAlbumSongs: vi.fn(() =>
      ok([
        { id: 's1', title: 'Song 1', duration: 200 },
        { id: 's2', title: 'Song 2', duration: 200 },
      ]),
    ),
    fetchAlbums: vi.fn(() => ok([])),
    fetchSongs: vi.fn(() => ok([])),
    fetchShuffle: vi.fn(() => ok([])),
    fetchRandomAlbums: vi.fn(() =>
      ok([
        { id: 'al0', name: 'Pinkerton', albumArtist: 'Weezer' },
        { id: 'al1', name: 'Blue Album', albumArtist: 'Weezer' },
      ]),
    ),
  }
})
// Rating songs (the classics), and the covers beside their main menu
vi.mock('../../subsonic', () => ({
  default: {
    setRating: vi.fn(() => Promise.resolve()),
    star: vi.fn(() => Promise.resolve()),
    unstar: vi.fn(() => Promise.resolve()),
    getCoverArtUrl: (album) => `cover-${album.id}.jpg`,
  },
}))

// The size of Bob's iPod's folder, every file in it, as the server measured it
vi.mock('../../dataProvider', () => ({
  default: {},
  httpClient: vi.fn(() =>
    Promise.resolve({ json: { id: 2, size: 9.2e9, measuring: false } }),
  ),
}))

// iPod Facts: Bob's iPod, its songs and their size
vi.mock('../../ipods/ipodDataCache', () => {
  const facts = {
    superlatives: [{ id: 2, songCount: 1029, totalSize: 4.7e9 }],
  }
  return {
    FACTS_URL: '/api/ipods/facts',
    getCachedIpodData: () => undefined,
    fetchIpodData: () => Promise.resolve(facts),
  }
})

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
    albumArtist: 'Weezer',
    albumArtistId: 'ar1',
    album: 'Blue Album',
    albumId: 'al1',
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

const renderPlayer = ({
  queue = [song(1), song(2)],
  current = 'u2',
  settings = {},
} = {}) => {
  // Adding tracks appends them, like the real reducer; the play mode and the iPod settings change
  const settingKeys = {
    SET_IPOD_CLICKS: 'ipodClicks',
    SET_IPOD_HAPTICS: 'ipodHaptics',
    SET_IPOD_BACKLIGHT: 'ipodBacklight',
  }
  const reducer = (
    state = { player: { queue, current: { uuid: current } }, settings },
    action,
  ) =>
    action.type === 'PLAYER_SET_MODE'
      ? { ...state, player: { ...state.player, mode: action.data.mode } }
      : settingKeys[action.type]
        ? {
            ...state,
            settings: {
              ...state.settings,
              [settingKeys[action.type]]: action.data,
            },
          }
        : action.type === 'PLAYER_ADD_TRACKS'
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

const at = (x, y, pointerId = 1) => ({ clientX: x, clientY: y, pointerId })

const openPlayer = () =>
  fireEvent.click(screen.getByRole('button', { name: 'player.mobile.open' }))

// Up Next is in the iPod's main menu: MENU up to it from Now Playing, then down to Up Next
const openUpNext = async () => {
  const menu = () =>
    fireEvent.click(screen.getByLabelText('player.mobile.menu'))
  menu()
  await screen.findByText('Song 1')
  menu()
  await screen.findByText('Pinkerton')
  menu()
  await screen.findByText('Pavement')
  menu() // Music
  menu() // The main menu
  fireEvent.click(await screen.findByTestId('menu-upNext'))
}

describe('<MobilePlayer />', () => {
  beforeEach(() => {
    window.history.replaceState(null, '')
  })

  it('shows the song playing in a strip that never covers the page with a floating button', () => {
    renderPlayer()
    const strip = screen.getByRole('region', {
      name: 'player.mobile.nowPlaying',
    })
    expect(strip).toHaveAttribute('data-tour', 'mobilePlayer')
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

  it("skips and sets the volume from the shuffle's pad, without opening the player", () => {
    const { controls } = renderPlayer({
      settings: { ipodSkin: 'classic-black' },
    })
    let level = 0.5
    controls.volume = vi.fn(() => level)
    controls.setVolume = vi.fn((v) => (level = v))
    const press = (name) =>
      fireEvent.click(screen.getByRole('button', { name }))
    press('player.previousTrackText')
    press('player.nextTrackText')
    expect(controls.prev).toHaveBeenCalled()
    expect(controls.next).toHaveBeenCalled()
    press('player.mobile.volumeUp')
    expect(level).toBeCloseTo(0.6)
    press('player.mobile.volumeDown')
    press('player.mobile.volumeDown')
    expect(level).toBeCloseTo(0.4)
    expect(screen.queryByRole('dialog')).toBeNull()
    // The song playing, printed on it, whatever the iPod chosen
    expect(
      screen.getByRole('button', { name: 'player.mobile.open' }),
    ).toHaveTextContent('Song 2')
  })

  it('opens the iPod on a tap, with a still square cover', () => {
    renderPlayer()
    openPlayer()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('player.mobile.nowPlaying')
    expect(dialog).toHaveTextContent(
      `player.mobile.position:{"n":"2","total":"2"}`,
    )
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

  it("climbs with MENU like an iPod: the album's songs, the artist, the iPod's artists, Music, the main menu", async () => {
    renderPlayer()
    openPlayer()
    const menu = () =>
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    const header = () =>
      screen.getByRole('dialog').querySelector('span[class*=headerTitle]')
        .textContent
    const selected = () =>
      screen.getByRole('option', { selected: true }).textContent

    menu()
    expect(header()).toBe('Blue Album')
    expect(await screen.findByText('Song 1')).toBeInTheDocument()
    expect(selected()).toContain('Song 2') // the song playing
    menu()
    expect(header()).toBe('Weezer')
    expect(await screen.findByText('Pinkerton')).toBeInTheDocument()
    expect(selected()).toContain('Blue Album')
    menu()
    expect(header()).toBe('player.mobile.artists')
    expect(await screen.findByText('Pavement')).toBeInTheDocument()
    expect(selected()).toContain('Weezer')
    menu()
    expect(header()).toBe('player.mobile.music')
    expect(selected()).toContain('player.mobile.artists')
    menu()
    expect(header()).toBe("Bob's iPod")
    expect(selected()).toContain('player.mobile.music')
  })

  it('goes down the menus with the centre button, and plays a song picked', async () => {
    const { store } = renderPlayer()
    const dispatch = vi.spyOn(store, 'dispatch')
    openPlayer()
    const menu = () =>
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    menu()
    await screen.findByText('Song 1')
    // From the album's songs, back to the artists, then down again to Pinkerton
    menu()
    await screen.findByText('Pinkerton')
    fireEvent.click(screen.getByText('Pinkerton'))
    await screen.findByText('Song 1')
    fireEvent.click(screen.getByText('Song 1'))
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAYER_PLAY_TRACKS', id: 's1' }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'player.mobile.nowPlaying',
    )
  })

  it('closes with MENU from the main menu, going back in history like the phone Back button', () => {
    const back = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() =>
        window.dispatchEvent(new PopStateEvent('popstate')),
      )
    // A radio stream: no album nor iPod, so the main menu is just above Now Playing
    renderPlayer({
      queue: [song(1, { isRadio: true, song: {} })],
      current: 'u1',
    })
    openPlayer()
    expect(window.history.state).toEqual({ ndPlayer: true })
    fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    expect(back).not.toHaveBeenCalled()
    act(() => {
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    })
    expect(back).toHaveBeenCalled()
    expect(screen.getByRole('region')).toBeInTheDocument()
    back.mockRestore()
  })

  it('closes when the iPod is dragged down, and goes back up if let go too soon', () => {
    renderPlayer()
    openPlayer()
    window.history.replaceState(null, '')
    const ipod = screen.getByTestId('ipod')
    let now = 1000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    // A short, slow drag: it follows the finger, then goes back up
    fireEvent.pointerDown(ipod, { clientX: 100, clientY: 100, pointerId: 1 })
    now += 300
    fireEvent.pointerMove(ipod, { clientX: 101, clientY: 140, pointerId: 1 })
    expect(ipod.style.transform).toBe('translateY(40px)')
    now += 300
    fireEvent.pointerUp(ipod, { clientX: 101, clientY: 140, pointerId: 1 })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(ipod.style.transform).toBe('')
    // A long one closes it
    fireEvent.pointerDown(ipod, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(ipod, { clientX: 102, clientY: 180, pointerId: 1 })
    fireEvent.pointerMove(ipod, { clientX: 102, clientY: 260, pointerId: 1 })
    fireEvent.pointerUp(ipod, { clientX: 102, clientY: 260, pointerId: 1 })
    expect(screen.getByRole('region')).toBeInTheDocument()
    clock.mockRestore()
  })

  it("doesn't drag the iPod from the wheel, which turns instead", () => {
    renderPlayer()
    openPlayer()
    const ipod = screen.getByTestId('ipod')
    const wheel = screen.getByTestId('click-wheel')
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 100, clientY: 220, pointerId: 1 })
    fireEvent.pointerUp(wheel, { clientX: 100, clientY: 220, pointerId: 1 })
    expect(ipod.style.transform).toBe('')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('scrubs with the click wheel after the centre button, seeking when the finger lifts', () => {
    vi.useFakeTimers()
    const { controls } = renderPlayer()
    openPlayer()
    const wheel = layOutWheel()
    const centerButton = screen.getByLabelText('player.mobile.select')
    // A tap on the centre button (a touch, then a click)
    const tapCenter = () => {
      fireEvent.pointerDown(centerButton, at(100, 100, 2))
      fireEvent.pointerUp(centerButton, at(100, 100, 2))
      fireEvent.click(centerButton)
    }
    // The centre button: scrubbing, a diamond where the song is
    tapCenter()
    expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
    // A quarter turn clockwise: 15 clicks of a second, from 0:50
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(screen.getByRole('dialog')).toHaveTextContent('1:05')
    expect(controls.seek).not.toHaveBeenCalled()
    fireEvent.pointerUp(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(controls.seek).toHaveBeenCalledWith(65)
    // Still scrubbing, for another turn; the centre button again: back to the song's progress
    expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
    tapCenter()
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
    // Left alone, scrubbing ends by itself
    tapCenter()
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
    expect(controls.seek).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('rates the song on the classics, the centre button pressed a second time: any stars love it, none unloves it', () => {
    vi.useFakeTimers()
    subsonic.setRating.mockClear()
    subsonic.star.mockClear()
    subsonic.unstar.mockClear()
    renderPlayer({ settings: { ipodSkin: 'classic-black' } })
    openPlayer()
    const wheel = layOutWheel()
    const centerButton = screen.getByLabelText('player.mobile.select')
    const tapCenter = () => {
      fireEvent.pointerDown(centerButton, at(100, 100, 2))
      fireEvent.pointerUp(centerButton, at(100, 100, 2))
      fireEvent.click(centerButton)
    }
    const stars = () =>
      Number(screen.getByTestId('rating-edit').getAttribute('aria-valuenow'))
    // Once: scrubbing; twice: rating, from none
    tapCenter()
    expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
    tapCenter()
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
    expect(stars()).toBe(0)
    // A quarter turn clockwise (15 clicks): three stars; another: as many as there are, five
    fireEvent.pointerDown(wheel, at(100, 10))
    fireEvent.pointerMove(wheel, at(190, 100))
    expect(stars()).toBe(3)
    fireEvent.pointerMove(wheel, at(100, 190))
    expect(stars()).toBe(5)
    fireEvent.pointerUp(wheel, at(100, 190))
    // A third time: kept, and loved
    tapCenter()
    expect(screen.queryByTestId('rating-edit')).toBeNull()
    expect(subsonic.setRating).toHaveBeenCalledWith('s2', 5)
    expect(subsonic.star).toHaveBeenCalledWith('s2')
    expect(screen.getByTestId('rating')).toHaveTextContent('★★★★★')
    // Down to none, then left alone: kept, and unloved
    tapCenter()
    tapCenter()
    expect(stars()).toBe(5)
    // Half a turn back, anticlockwise
    fireEvent.pointerDown(wheel, at(100, 190))
    fireEvent.pointerMove(wheel, at(190, 100))
    fireEvent.pointerMove(wheel, at(100, 10))
    fireEvent.pointerUp(wheel, at(100, 10))
    expect(stars()).toBe(0)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByTestId('rating-edit')).toBeNull()
    expect(subsonic.setRating).toHaveBeenLastCalledWith('s2', 0)
    expect(subsonic.unstar).toHaveBeenCalledWith('s2')
    expect(screen.queryByTestId('rating')).toBeNull()
    vi.useRealTimers()
  })

  it('loves a song rated three stars on the classics, as Navidrome keeps it for this user', () => {
    subsonic.setRating.mockClear()
    subsonic.star.mockClear()
    renderPlayer({ settings: { ipodSkin: 'classic-silver' } })
    openPlayer()
    const wheel = layOutWheel()
    const centerButton = screen.getByLabelText('player.mobile.select')
    const tapCenter = () => {
      fireEvent.pointerDown(centerButton, at(100, 100, 2))
      fireEvent.pointerUp(centerButton, at(100, 100, 2))
      fireEvent.click(centerButton)
    }
    tapCenter()
    tapCenter()
    fireEvent.pointerDown(wheel, at(100, 10))
    fireEvent.pointerMove(wheel, at(190, 100))
    fireEvent.pointerUp(wheel, at(190, 100))
    tapCenter()
    expect(subsonic.setRating).toHaveBeenCalledWith('s2', 3)
    expect(subsonic.star).toHaveBeenCalledWith('s2')
    expect(screen.getByTestId('rating')).toHaveTextContent('★★★')
  })

  it.each(['3g', '4g', '4g-u2', 'mini-silver', 'photo'])(
    'rates the song on the %s too, its stars drawn: any stars love it',
    (ipodSkin) => {
      subsonic.setRating.mockClear()
      subsonic.star.mockClear()
      subsonic.unstar.mockClear()
      renderPlayer({ settings: { ipodSkin } })
      openPlayer()
      const wheel = layOutWheel()
      const centerButton = screen.getByLabelText('player.mobile.select')
      const tapCenter = () => {
        fireEvent.pointerDown(centerButton, at(100, 100, 2))
        fireEvent.pointerUp(centerButton, at(100, 100, 2))
        fireEvent.click(centerButton)
      }
      tapCenter()
      expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
      tapCenter()
      const meter = screen.getByTestId('rating-edit')
      expect(meter).toHaveAttribute('aria-valuenow', '0')
      fireEvent.pointerDown(wheel, at(100, 10))
      fireEvent.pointerMove(wheel, at(190, 100))
      fireEvent.pointerUp(wheel, at(190, 100))
      expect(meter).toHaveAttribute('aria-valuenow', '3')
      // Pictures of stars, the screen's font having none
      expect(meter.querySelectorAll('svg')).toHaveLength(3)
      // Over the bar and the times, hidden, so the song doesn't move
      expect(meter.previousSibling).toHaveAttribute('aria-hidden', 'true')
      tapCenter()
      expect(screen.queryByTestId('rating-edit')).toBeNull()
      expect(subsonic.setRating).toHaveBeenCalledWith('s2', 3)
      expect(subsonic.star).toHaveBeenCalledWith('s2')
    },
  )

  it("doesn't rate on the 1st generation, which couldn't: the centre button only scrubs", () => {
    renderPlayer({ settings: { ipodSkin: '1g' } })
    openPlayer()
    const centerButton = screen.getByLabelText('player.mobile.select')
    const tapCenter = () => {
      fireEvent.pointerDown(centerButton, at(100, 100, 2))
      fireEvent.pointerUp(centerButton, at(100, 100, 2))
      fireEvent.click(centerButton)
    }
    tapCenter()
    expect(screen.getByTestId('scrub-diamond')).toBeInTheDocument()
    tapCenter()
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
    expect(screen.queryByTestId('rating-edit')).toBeNull()
  })

  it('sets the volume by turning the wheel on Now Playing, showing it a moment', () => {
    vi.useFakeTimers()
    const { controls } = renderPlayer()
    let level = 0.5
    controls.volume = vi.fn(() => level)
    controls.setVolume = vi.fn((v) => (level = v))
    controls.volumeLocked = vi.fn(() => false)
    openPlayer()
    const wheel = layOutWheel()
    // A quarter turn clockwise: 15 clicks of 1/40
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(level).toBeCloseTo(0.5 + 15 / 40)
    expect(screen.getByTestId('volume')).toBeInTheDocument()
    expect(screen.queryByTestId('scrub-diamond')).toBeNull()
    expect(controls.seek).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.queryByTestId('volume')).toBeNull()
    vi.useRealTimers()
  })

  it('shows the volume but says to use the side buttons where the phone keeps it (iPhones)', () => {
    const { controls } = renderPlayer()
    controls.setVolume = vi.fn()
    controls.volumeLocked = vi.fn(() => true)
    openPlayer()
    const wheel = layOutWheel()
    fireEvent.pointerDown(wheel, { clientX: 100, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(wheel, { clientX: 190, clientY: 100, pointerId: 1 })
    expect(screen.getByTestId('volume')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'player.mobile.volumeLocked',
    )
    expect(controls.setVolume).not.toHaveBeenCalled()
  })

  it('opens Up Next from the main menu, on the song playing, and goes back with MENU', async () => {
    renderPlayer({ queue: [song(1), song(2), song(3)] })
    openPlayer()
    await openUpNext()
    const list = screen.getByRole('listbox', { name: 'player.mobile.upNext' })
    expect(list).toBeInTheDocument()
    expect(screen.getByTestId('upnext-1')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // MENU: back to the main menu
    fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    expect(
      screen.queryByRole('listbox', { name: 'player.mobile.upNext' }),
    ).toBeNull()
    expect(screen.getByTestId('menu-upNext')).toBeInTheDocument()
  })

  it('moves through Up Next with the wheel, and plays the song picked with the centre button', async () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3), song(4)],
      current: 'u1',
    })
    openPlayer()
    await openUpNext()
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

  it('removes a song from Up Next, and Undo puts it back where it was', async () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3)],
      current: 'u1',
    })
    openPlayer()
    await openUpNext()
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

  it('moves on to the next song before removing the one playing', async () => {
    const { controls } = renderPlayer({
      queue: [song(1), song(2), song(3)],
      current: 'u2',
    })
    openPlayer()
    await openUpNext()
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

  it('shows only text on the black and white iPods, under a backlight that goes out after 10 seconds', () => {
    vi.useFakeTimers()
    renderPlayer({ settings: { ipodSkin: '1g' } })
    openPlayer()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-skin', '1g')
    // No cover: the song in lines of text
    expect(screen.queryByAltText('Blue Album')).toBeNull()
    expect(screen.getByTestId('now-playing-text')).toHaveTextContent('Song 2')
    expect(dialog).toHaveAttribute('data-backlight', 'on')
    act(() => vi.advanceTimersByTime(10000))
    expect(dialog).toHaveAttribute('data-backlight', 'off')
    // A touch lights it again
    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(dialog).toHaveAttribute('data-backlight', 'on')
    vi.useRealTimers()
  })

  it("shows the early iPods' Now Playing: where the song is at the top, a battery in four bars", () => {
    renderPlayer({ settings: { ipodSkin: '1g' } })
    openPlayer()
    expect(screen.getByTestId('now-playing-position')).toHaveTextContent(
      `player.mobile.position:{"n":"2","total":"2"}`,
    )
    expect(screen.getByTestId('now-playing-text')).toHaveTextContent(
      'Blue Album',
    )
    // The phone keeps its battery to itself here: full
    expect(screen.getAllByTestId('battery-bar')).toHaveLength(4)
  })

  it('gives the 4th generation, and its U2 edition, a battery of one bar as long as the charge', async () => {
    const getBattery = vi.fn(() =>
      Promise.resolve({
        level: 0.5,
        charging: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    )
    navigator.getBattery = getBattery
    try {
      for (const ipodSkin of ['4g', '4g-u2']) {
        const { unmount } = renderPlayer({ settings: { ipodSkin } })
        openPlayer()
        const level = await screen.findByTestId('battery-level')
        await vi.waitFor(() =>
          expect(Number(level.getAttribute('width'))).toBeCloseTo(8.4),
        )
        expect(screen.queryByTestId('battery-bar')).toBeNull()
        unmount()
      }
    } finally {
      delete navigator.getBattery
    }
  })

  it("shows the classic's Now Playing: a big cover, the song, its rating, and the times either side of the bar", () => {
    const rated = song(2)
    rated.song.rating = 4
    renderPlayer({
      queue: [song(1), rated],
      settings: { ipodSkin: 'classic-black' },
    })
    openPlayer()
    expect(
      screen.getByRole('dialog').querySelector('[data-software="classic"]'),
    ).not.toBeNull()
    expect(screen.getByTestId('cover-tilt')).toBeInTheDocument()
    expect(screen.getByTestId('rating')).toHaveTextContent('★★★★')
    expect(screen.getByTestId('now-playing-position')).toHaveTextContent(
      'player.mobile.position',
    )
    const bar = screen.getByLabelText('player.mobile.seek').parentElement
    expect(bar.previousSibling).toHaveTextContent('0:50')
    expect(bar.nextSibling).toHaveTextContent('-2:30')
  })

  it("shows the classic's main menu beside the iPod's album covers", async () => {
    renderPlayer({ settings: { ipodSkin: 'classic-silver' } })
    openPlayer()
    expect(screen.queryByTestId('cover-shuffle')).toBeNull()
    const menu = () =>
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    menu()
    await screen.findByText('Song 1')
    menu()
    await screen.findByText('Pinkerton')
    menu()
    await screen.findByText('Pavement')
    menu() // Music
    menu() // The main menu
    const covers = await screen.findByTestId('cover-shuffle')
    await vi.waitFor(() =>
      expect(covers.querySelectorAll('img').length).toBeGreaterThan(0),
    )
  })

  it('has Settings in the main menu: shuffle, repeat, the backlight and the clicker, the same as Personal settings, and About', async () => {
    const { store } = renderPlayer({ settings: { ipodSkin: '1g' } })
    openPlayer()
    const menu = () =>
      fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    menu()
    await screen.findByText('Song 1')
    menu()
    await screen.findByText('Pinkerton')
    menu()
    await screen.findByText('Pavement')
    menu() // Music
    menu() // The main menu
    fireEvent.click(await screen.findByTestId('menu-settings'))
    const row = (key) => screen.getByTestId(`menu-${key}`)
    expect(row('shuffle')).toHaveTextContent('player.mobile.off')
    // Shuffle: the player's own
    fireEvent.click(row('shuffle'))
    expect(store.getState().player.mode).toBe('shufflePlay')
    expect(row('shuffle')).toHaveTextContent('player.mobile.on')
    // Repeat: off, one, all
    fireEvent.click(row('repeat'))
    expect(store.getState().player.mode).toBe('singleLoop')
    expect(row('repeat')).toHaveTextContent('player.mobile.repeat_one')
    fireEvent.click(row('repeat'))
    expect(store.getState().player.mode).toBe('orderLoop')
    // The clicker, as in Personal settings
    fireEvent.click(row('clicker'))
    expect(store.getState().settings.ipodClicks).toBe(false)
    // The backlight timer: its choices, the one picked going back to Settings
    fireEvent.click(row('backlight'))
    fireEvent.click(await screen.findByTestId('menu-2'))
    expect(store.getState().settings.ipodBacklight).toBe(2)
    expect(await screen.findByTestId('menu-about')).toBeInTheDocument()
    // Reset All Settings: back as they were
    fireEvent.click(row('reset'))
    fireEvent.click(await screen.findByTestId('menu-reset'))
    expect(store.getState().player.mode).toBe('order')
    expect(store.getState().settings.ipodClicks).toBe(true)
    expect(store.getState().settings.ipodBacklight).toBe(10)
    // About: the iPod's name, its songs, what its folder holds, and what that leaves of the model's
    // biggest hard drive (20 GB)
    fireEvent.click(await screen.findByTestId('menu-about'))
    const about = await screen.findByTestId('about')
    expect(about).toHaveTextContent("Bob's iPod")
    await vi.waitFor(() => expect(about).toHaveTextContent('1,029'))
    await vi.waitFor(() => expect(about).toHaveTextContent('9.2 GB'))
    expect(about).toHaveTextContent('10.8 GB')
  })

  it('shows no picture for a song with no cover of its own, the song centred, but on the classics, which showed the placeholder', async () => {
    forgetCovers()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          headers: { get: (h) => (h === 'x-nd-placeholder' ? 'true' : null) },
        }),
      ),
    )
    try {
      for (const ipodSkin of ['5g-white', 'photo']) {
        const { unmount } = renderPlayer({ settings: { ipodSkin } })
        openPlayer()
        await vi.waitFor(() =>
          expect(screen.queryByAltText('Blue Album')).toBeNull(),
        )
        const song = screen.getByTestId('now-playing-song')
        expect(song).toHaveTextContent('Song 2')
        expect(song.parentElement.className).toMatch(/centred/)
        unmount()
      }
      const { unmount } = renderPlayer({
        settings: { ipodSkin: 'classic-black' },
      })
      openPlayer()
      expect(screen.getByAltText('Blue Album')).toBeVisible()
      expect(
        screen.getByTestId('now-playing-song').parentElement.className,
      ).not.toMatch(/centred/)
      unmount()
    } finally {
      vi.unstubAllGlobals()
      forgetCovers()
    }
  })

  it("leaves the album off the mini's small screen", () => {
    renderPlayer({ settings: { ipodSkin: 'mini2-blue' } })
    openPlayer()
    const text = screen.getByTestId('now-playing-text')
    expect(text).toHaveTextContent('Song 2')
    expect(text).toHaveTextContent('Weezer')
    expect(text).not.toHaveTextContent('Blue Album')
  })

  it('times the backlight as chosen in Personal settings', () => {
    vi.useFakeTimers()
    const { unmount } = renderPlayer({
      settings: { ipodSkin: '3g', ipodBacklight: 2 },
    })
    openPlayer()
    const dialog = () => screen.getByRole('dialog')
    expect(dialog()).toHaveAttribute('data-backlight', 'on')
    act(() => vi.advanceTimersByTime(2000))
    expect(dialog()).toHaveAttribute('data-backlight', 'off')
    unmount()

    const always = renderPlayer({
      settings: { ipodSkin: '3g', ipodBacklight: 'always' },
    })
    openPlayer()
    act(() => vi.advanceTimersByTime(60000))
    expect(dialog()).toHaveAttribute('data-backlight', 'on')
    always.unmount()

    // Off: never lit by a touch
    renderPlayer({ settings: { ipodSkin: '3g', ipodBacklight: 0 } })
    openPlayer()
    expect(dialog()).toHaveAttribute('data-backlight', 'off')
    fireEvent.pointerDown(dialog(), { clientX: 10, clientY: 10, pointerId: 1 })
    expect(dialog()).toHaveAttribute('data-backlight', 'off')
    vi.useRealTimers()
  })

  it('turns the backlight off and on by holding MENU, without going up a menu', () => {
    vi.useFakeTimers()
    renderPlayer({ settings: { ipodSkin: '1g' } })
    openPlayer()
    const dialog = screen.getByRole('dialog')
    const menu = screen.getByLabelText('player.mobile.menu')
    const hold = () => {
      fireEvent.pointerDown(menu, { clientX: 10, clientY: 10, pointerId: 1 })
      act(() => vi.advanceTimersByTime(700))
      fireEvent.pointerUp(menu, { pointerId: 1 })
      fireEvent.click(menu)
    }
    expect(dialog).toHaveAttribute('data-backlight', 'on')
    hold()
    expect(dialog).toHaveAttribute('data-backlight', 'off')
    // Still Now Playing: the hold wasn't a press of MENU
    expect(dialog).toHaveTextContent('player.mobile.nowPlaying')
    // Held again: on, and it stays on
    hold()
    expect(dialog).toHaveAttribute('data-backlight', 'on')
    act(() => vi.advanceTimersByTime(60000))
    expect(dialog).toHaveAttribute('data-backlight', 'on')
    hold()
    expect(dialog).toHaveAttribute('data-backlight', 'off')
    vi.useRealTimers()
  })

  it('keeps covers and the light on the colour screens', () => {
    vi.useFakeTimers()
    renderPlayer({ settings: { ipodSkin: '5g-black' } })
    openPlayer()
    expect(screen.getByAltText('Blue Album')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(10000))
    // The colour screen's palette doesn't change with the backlight
    expect(
      screen.getByRole('dialog').style.getPropertyValue('--lcd-bg'),
    ).toMatch(/#f1f5f8/)
    vi.useRealTimers()
  })

  it("shows the 5th generation's Now Playing: where the song is at the top, the times under a striped bar", () => {
    renderPlayer({ settings: { ipodSkin: '5g-white' } })
    openPlayer()
    const ipod = screen.getByRole('dialog')
    expect(ipod.querySelector('[data-software="fifth"]')).not.toBeNull()
    expect(screen.getByTestId('now-playing-position')).toHaveTextContent(
      'player.mobile.position',
    )
    expect(screen.getByAltText('Blue Album')).toBeInTheDocument()
    const bar = screen.getByLabelText('player.mobile.seek').parentElement
    expect(bar.nextSibling).toHaveTextContent('0:50')
    expect(bar.nextSibling).toHaveTextContent('-2:30')
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
