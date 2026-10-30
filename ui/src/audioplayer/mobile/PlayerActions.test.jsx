import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlayerActions } from './PlayerActions'
import { playIpodRadio } from '../../ipods/radio'

const { dispatch, push, toggleLove, browseIpod, getOne } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  push: vi.fn(),
  toggleLove: vi.fn(),
  browseIpod: vi.fn(),
  getOne: vi.fn(),
}))

vi.mock('react-redux', () => ({ useDispatch: () => dispatch }))
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push }) }))
vi.mock('react-admin', () => ({
  useGetOne: (...args) => getOne(...args),
  useNotify: () => vi.fn(),
  useTranslate: () => (key, opts) =>
    opts ? `${key}:${JSON.stringify(opts)}` : key,
}))
vi.mock('../../common/useToggleLove', () => ({
  useToggleLove: () => [toggleLove, false],
}))
vi.mock('../../ipods/useBrowseIpod', () => ({
  useBrowseIpod: (onClose) => (id) => {
    browseIpod(id)
    onClose()
  },
}))
vi.mock('../../ipods/radio', () => ({
  playIpodRadio: vi.fn(() => Promise.resolve()),
}))

const item = {
  uuid: 'u1',
  trackId: 'mf1',
  name: 'Buddy Holly',
  singer: 'Weezer',
  song: {
    id: 'mf1',
    title: 'Buddy Holly',
    artist: 'Weezer',
    albumId: 'al1',
    libraryId: 2,
    libraryName: "Bob's iPod",
  },
}

// A real tap on a menu item: a touch that starts in the menu, then a click
const pick = (text) => {
  const el = screen.getByText(text)
  fireEvent.pointerDown(el)
  fireEvent.click(el)
}

const renderActions = (it = item) => {
  const onClose = vi.fn()
  const onLeave = vi.fn()
  render(<PlayerActions item={it} onClose={onClose} onLeave={onLeave} />)
  return { onClose, onLeave }
}

describe('<PlayerActions />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOne.mockReturnValue({ data: { id: 'mf1', starred: false } })
  })

  it('shows nothing without a song', () => {
    render(<PlayerActions item={null} onClose={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.queryByText('player.mobile.goToAlbum')).toBeNull()
  })

  it('loves the song', () => {
    const { onClose } = renderActions()
    pick('player.mobile.love')
    expect(toggleLove).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('offers to unlove a loved song', () => {
    getOne.mockReturnValue({ data: { id: 'mf1', starred: true } })
    renderActions()
    expect(screen.getByText('player.mobile.unlove')).toBeInTheDocument()
  })

  it('opens the album, closing the player first', () => {
    const { onLeave } = renderActions()
    pick('player.mobile.goToAlbum')
    expect(onLeave).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/album/al1/show')
  })

  it("opens the song's iPod", () => {
    const { onLeave } = renderActions()
    pick(`player.mobile.goToIpod:{"name":"Bob's iPod"}`)
    expect(browseIpod).toHaveBeenCalledWith(2)
    expect(onLeave).toHaveBeenCalled()
  })

  it('starts an iPod Radio from the song', () => {
    renderActions()
    pick('player.mobile.startRadio')
    expect(playIpodRadio).toHaveBeenCalledWith(dispatch, expect.any(Function), {
      songId: 'mf1',
    })
  })

  it('downloads the song, through the download dialog (with its best-copy recommendation)', () => {
    renderActions()
    pick('ra.action.download')
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOWNLOAD_MENU_OPEN',
        recordType: 'song',
        record: expect.objectContaining({ id: 'mf1', title: 'Buddy Holly' }),
      }),
    )
  })

  it('saves or clears the queue', () => {
    const { onLeave } = renderActions()
    pick('player.mobile.saveQueue')
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAVE_QUEUE_OPEN' }),
    )
    pick('player.mobile.clearQueue')
    expect(onLeave).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAYER_CLEAR_QUEUE' }),
    )
  })

  it("doesn't pick what is under the finger that opened it by holding", () => {
    renderActions()
    // The release of the long press: a click with no touch starting in the menu
    fireEvent.click(screen.getByText('player.mobile.clearQueue'))
    expect(dispatch).not.toHaveBeenCalled()
    pick('player.mobile.clearQueue')
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAYER_CLEAR_QUEUE' }),
    )
  })

  it('only offers the queue for a radio stream', () => {
    renderActions({ uuid: 'r', name: 'KEXP', isRadio: true, song: {} })
    expect(screen.queryByText('player.mobile.love')).toBeNull()
    expect(screen.queryByText('ra.action.download')).toBeNull()
    expect(screen.getByText('player.mobile.clearQueue')).toBeInTheDocument()
  })
})
