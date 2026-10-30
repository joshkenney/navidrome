import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDispatch, useSelector } from 'react-redux'
import { SelectIpod } from './SelectIpod'

vi.mock('react-redux', () => ({ useDispatch: vi.fn(), useSelector: vi.fn() }))
vi.mock('react-admin', () => ({ useTranslate: () => (key) => key }))

describe('<SelectIpod />', () => {
  const dispatch = vi.fn()
  let settings
  beforeEach(() => {
    vi.clearAllMocks()
    settings = { ipodSkin: '3g', ipodHaptics: true }
    useDispatch.mockReturnValue(dispatch)
    useSelector.mockImplementation((select) => select({ settings }))
  })

  it('shows every iPod, by family, with the one chosen marked', () => {
    render(<SelectIpod />)
    expect(
      screen.getByText('menu.personal.options.ipodGroups.classic'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('menu.personal.options.ipodGroups.special'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Transparent', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('3rd generation (2003)').closest('button'),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByText('mini, pink (2004)').closest('button'),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('chooses an iPod', () => {
    render(<SelectIpod />)
    fireEvent.click(screen.getByText('mini, pink (2004)'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_IPOD_SKIN',
      data: 'mini-pink',
    })
  })

  it('turns the click wheel sounds off', () => {
    render(<SelectIpod />)
    fireEvent.click(screen.getByLabelText('menu.personal.options.ipodClicks'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_IPOD_CLICKS',
      data: false,
    })
  })

  it('times the backlight', () => {
    render(<SelectIpod />)
    // The default: 10 seconds
    expect(
      screen.getByText('menu.personal.options.ipodBacklightTimes.10'),
    ).toBeInTheDocument()
    fireEvent.mouseDown(
      screen.getByText('menu.personal.options.ipodBacklightTimes.10'),
    )
    fireEvent.click(
      screen.getByText('menu.personal.options.ipodBacklightTimes.always'),
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_IPOD_BACKLIGHT',
      data: 'always',
    })
  })

  it('turns the click wheel clicks off', () => {
    render(<SelectIpod />)
    fireEvent.click(screen.getByLabelText('menu.personal.options.ipodHaptics'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_IPOD_HAPTICS',
      data: false,
    })
  })
})
