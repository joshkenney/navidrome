import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { activityReducer } from '../reducers'
import AppBar from './AppBar'
import config from '../config'
import { startTour } from '../tour'

let store

vi.mock('react-admin', () => ({
  AppBar: ({ userMenu }) => <div data-testid="appbar">{userMenu}</div>,
  useTranslate: () => (x) => x,
  usePermissions: () => ({ permissions: 'admin' }),
  getResources: () => [],
}))

vi.mock('./NowPlayingPanel', () => ({
  default: () => <div data-testid="now-playing-panel" />,
}))
vi.mock('../ipods', () => ({
  IpodFactsButton: () => <div data-testid="ipod-facts-button" />,
  IpodNetworkButton: () => <div data-testid="ipod-network-button" />,
  IpodRadioButton: () => <div data-testid="ipod-radio-button" />,
  IpodShuffleButton: () => <div data-testid="ipod-shuffle-button" />,
}))
vi.mock('../search/GlobalSearch', () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}))
vi.mock('../tour', () => ({
  Tour: () => <div data-testid="tour" />,
  startTour: vi.fn(),
}))
vi.mock('./ActivityPanel', () => ({
  default: () => <div data-testid="activity-panel" />,
}))
vi.mock('./PersonalMenu', () => ({
  default: () => <div />,
}))
vi.mock('./UserMenu', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('../dialogs/Dialogs', () => ({
  Dialogs: () => <div />,
}))
vi.mock('../dialogs', () => ({
  AboutDialog: () => <div />,
}))

describe('<AppBar />', () => {
  beforeEach(() => {
    config.devActivityPanel = true
    config.enableNowPlaying = true
    store = createStore(combineReducers({ activity: activityReducer }), {
      activity: { nowPlayingCount: 0 },
    })
  })

  it('renders NowPlayingPanel when enabled', () => {
    render(
      <Provider store={store}>
        <AppBar />
      </Provider>,
    )
    expect(screen.getByTestId('now-playing-panel')).toBeInTheDocument()
  })

  it('hides NowPlayingPanel when disabled', () => {
    config.enableNowPlaying = false
    render(
      <Provider store={store}>
        <AppBar />
      </Provider>,
    )
    expect(screen.queryByTestId('now-playing-panel')).toBeNull()
  })

  it('renders the iPod facts and network buttons', () => {
    render(
      <Provider store={store}>
        <AppBar />
      </Provider>,
    )
    expect(screen.getByTestId('global-search')).toBeInTheDocument()
    expect(screen.getByTestId('ipod-facts-button')).toBeInTheDocument()
    expect(screen.getByTestId('ipod-network-button')).toBeInTheDocument()
    expect(screen.getByTestId('ipod-radio-button')).toBeInTheDocument()
    expect(screen.getByTestId('ipod-shuffle-button')).toBeInTheDocument()
  })

  it('marks the header buttons for the tour, and replays it from the user menu', () => {
    vi.useFakeTimers()
    render(
      <Provider store={store}>
        <AppBar />
      </Provider>,
    )
    expect(screen.getByTestId('tour')).toBeInTheDocument()
    for (const target of [
      'search',
      'facts',
      'network',
      'shuffle',
      'radio',
      'userMenu',
    ]) {
      expect(document.querySelector(`[data-tour="${target}"]`)).toBeTruthy()
    }
    fireEvent.click(screen.getByText('tour.menu'))
    vi.advanceTimersByTime(300) // Once the menu has closed
    expect(startTour).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
