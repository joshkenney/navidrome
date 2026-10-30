import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClickWheel } from './ClickWheel'

// jsdom has no PointerEvent: without it, simulated pointer events have no coordinates
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {}
}

vi.mock('react-admin', () => ({ useTranslate: () => (key) => key }))

const look = {
  wheel: '#000',
  wheelEdge: '#111',
  center: '#222',
  label: '#ccc',
}

// A 200x200 wheel at the top left of the page: its centre is at (100, 100)
const renderWheel = (props = {}) => {
  const handlers = {
    onMenu: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onPlay: vi.fn(),
    onCenter: vi.fn(),
    onTurnStart: vi.fn(),
    onTurn: vi.fn(),
    onTurnEnd: vi.fn(),
  }
  render(<ClickWheel look={look} {...handlers} {...props} />)
  const wheel = screen.getByTestId('click-wheel')
  wheel.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
  })
  wheel.setPointerCapture = vi.fn()
  wheel.releasePointerCapture = vi.fn()
  return { wheel, ...handlers }
}

const at = (x, y) => ({ clientX: x, clientY: y, pointerId: 1 })
const turnedBy = (onTurn) =>
  onTurn.mock.calls.reduce((sum, [clicks]) => sum + clicks, 0)

describe('<ClickWheel />', () => {
  beforeEach(() => {
    navigator.vibrate = vi.fn()
  })

  it('presses the buttons around the ring and in the centre', () => {
    const h = renderWheel()
    fireEvent.click(screen.getByLabelText('player.mobile.menu'))
    fireEvent.click(screen.getByLabelText('player.previousTrackText'))
    fireEvent.click(screen.getByLabelText('player.nextTrackText'))
    fireEvent.click(screen.getByLabelText('player.mobile.playPause'))
    fireEvent.click(screen.getByLabelText('player.mobile.select'))
    expect(h.onMenu).toHaveBeenCalled()
    expect(h.onPrev).toHaveBeenCalled()
    expect(h.onNext).toHaveBeenCalled()
    expect(h.onPlay).toHaveBeenCalled()
    expect(h.onCenter).toHaveBeenCalled()
    expect(navigator.vibrate).toHaveBeenCalled()
  })

  it('clicks once every 6° when turned clockwise, with a buzz each time', () => {
    const h = renderWheel()
    // From the top of the ring (-90°) to its right (0°): a quarter turn clockwise
    fireEvent.pointerDown(h.wheel, at(100, 10))
    fireEvent.pointerMove(h.wheel, at(164, 36))
    fireEvent.pointerMove(h.wheel, at(190, 100))
    fireEvent.pointerUp(h.wheel, at(190, 100))
    expect(h.onTurnStart).toHaveBeenCalledTimes(1)
    expect(turnedBy(h.onTurn)).toBe(15)
    expect(h.onTurnEnd).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledTimes(h.onTurn.mock.calls.length)
    expect(h.wheel.setPointerCapture).toHaveBeenCalled()
  })

  it('turns back counter-clockwise, across the left of the ring', () => {
    const h = renderWheel()
    // Down the left of the ring, from -170° to 170°: 20° counter-clockwise, across the ±180° seam
    fireEvent.pointerDown(h.wheel, at(12, 85))
    fireEvent.pointerMove(h.wheel, at(12, 115))
    fireEvent.pointerUp(h.wheel, at(12, 115))
    expect(turnedBy(h.onTurn)).toBe(-3)
  })

  it("doesn't press the button a turn started or ended on", () => {
    const h = renderWheel()
    const menu = screen.getByLabelText('player.mobile.menu')
    fireEvent.pointerDown(h.wheel, at(100, 10))
    fireEvent.pointerMove(h.wheel, at(190, 100))
    fireEvent.pointerUp(h.wheel, at(190, 100))
    fireEvent.click(menu)
    expect(h.onMenu).not.toHaveBeenCalled()
    // The next tap presses it again
    fireEvent.pointerDown(h.wheel, at(100, 10))
    fireEvent.pointerUp(h.wheel, at(100, 10))
    fireEvent.click(menu)
    expect(h.onMenu).toHaveBeenCalled()
  })

  it("doesn't turn for a small wobble, or from the centre button", () => {
    const h = renderWheel()
    fireEvent.pointerDown(h.wheel, at(100, 10))
    fireEvent.pointerMove(h.wheel, at(104, 12))
    fireEvent.pointerUp(h.wheel, at(104, 12))
    fireEvent.pointerDown(h.wheel, at(100, 100))
    fireEvent.pointerMove(h.wheel, at(130, 100))
    fireEvent.pointerUp(h.wheel, at(130, 100))
    expect(h.onTurnStart).not.toHaveBeenCalled()
    expect(h.onTurn).not.toHaveBeenCalled()
  })
})
