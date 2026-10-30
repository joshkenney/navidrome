import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMediaQuery } from '@material-ui/core'
import { useSelector } from 'react-redux'
import { Player } from './Player'

// The props the music player was last rendered with (an array, not a ref-like object)
const { calls } = vi.hoisted(() => ({ calls: [] }))
const lastProps = () => calls[calls.length - 1]

// A class, like the real player, so it can hold the ref Player gives it
vi.mock('navidrome-music-player', async () => {
  const { Component } = await vi.importActual('react')
  class MusicPlayer extends Component {
    render() {
      calls.push(this.props)
      return null
    }
  }
  return { default: MusicPlayer }
})
vi.mock('navidrome-music-player/assets/index.css', () => ({}))
vi.mock('./mobile/MobilePlayer', () => ({
  MobilePlayer: () => <div data-testid="mobile-player" />,
}))
vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  useMediaQuery: vi.fn(),
}))
vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: vi.fn(),
}))
vi.mock('react-admin', () => ({
  createMuiTheme: (t) => t,
  useAuthState: () => ({ authenticated: true }),
  useDataProvider: () => ({}),
  useTranslate: () => (key) => key,
}))
vi.mock('react-hotkeys', () => ({ GlobalHotKeys: () => null }))
vi.mock('../themes/useCurrentTheme', () => ({ default: () => ({}) }))
vi.mock('../ipods/IpodRadioExtender', () => ({ IpodRadioExtender: () => null }))
vi.mock('../transcode', () => ({
  detectBrowserProfile: () => ({}),
  decisionService: {
    setProfile: vi.fn(),
    resolveStreamUrl: vi.fn(() => Promise.resolve('url')),
    prefetchDecisions: vi.fn(),
    invalidateAll: vi.fn(),
  },
}))

const state = {
  player: {
    queue: [{ uuid: 'u1', trackId: 't1', name: 'Song', song: {} }],
    current: { uuid: 'u1' },
    savedPlayIndex: 0,
    volume: 1,
  },
  settings: {},
  replayGain: { gainMode: 'none' },
}

describe('<Player />', () => {
  beforeEach(() => {
    calls.length = 0
    useSelector.mockImplementation((select) => select(state))
  })

  it('shows the iPod on phones, keeping the music player collapsed and out of sight', () => {
    useMediaQuery.mockReturnValue(false) // narrower than 810px
    render(<Player />)
    expect(screen.getByTestId('mobile-player')).toBeInTheDocument()
    expect(lastProps().mode).toBe('mini')
    expect(lastProps().drag).toBe(false)
  })

  it('keeps the full player bar on larger screens', () => {
    useMediaQuery.mockReturnValue(true)
    render(<Player />)
    expect(screen.queryByTestId('mobile-player')).toBeNull()
    expect(lastProps().mode).toBe('full')
    expect(lastProps().drag).toBe(true)
  })
})
