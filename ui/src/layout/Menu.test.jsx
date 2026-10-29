import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import Menu from './Menu'

vi.mock('react-admin', () => ({
  useTranslate: () => (key) => key,
  getResources: (state) => state.resources,
  MenuItemLink: ({ to, primaryText }) => <a href={to}>{primaryText}</a>,
}))
vi.mock('../common/LibrarySelector', () => ({ default: () => null }))
vi.mock('./SubMenu', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('./PlaylistsSubMenu', () => ({ default: () => null }))

describe('<Menu />', () => {
  it('shows iPod Radio instead of the internet radio stations', () => {
    const store = createStore(() => ({
      admin: { ui: { sidebarOpen: true } },
      player: { queue: [] },
      resources: [
        { name: 'song', hasList: true, options: {} },
        { name: 'radio', hasList: true, options: {} },
      ],
    }))
    render(
      <Provider store={store}>
        <Menu />
      </Provider>,
    )
    expect(screen.getByText('ipods.radio.title').closest('a')).toHaveAttribute(
      'href',
      '/ipod-radio',
    )
    expect(screen.queryByText('resources.radio.name')).toBeNull()
    expect(screen.getByText('resources.song.name')).toBeInTheDocument()
  })

  it('links to the timeline and the holes', () => {
    const store = createStore(() => ({
      admin: { ui: { sidebarOpen: true } },
      player: { queue: [] },
      resources: [],
    }))
    render(
      <Provider store={store}>
        <Menu />
      </Provider>,
    )
    expect(
      screen.getByText('listening.timeline.title').closest('a'),
    ).toHaveAttribute('href', '/timeline')
    expect(
      screen.getByText('listening.holes.title').closest('a'),
    ).toHaveAttribute('href', '/holes')
  })
})
