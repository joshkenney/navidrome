import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HOLD_MS, REMOVE_AT, UpNext } from './UpNext'

// jsdom has no PointerEvent: without it, simulated pointer events have no coordinates
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {}
}

vi.mock('react-admin', () => ({ useTranslate: () => (key) => key }))

const queue = ['One', 'Two', 'Three', 'Four'].map((title, i) => ({
  uuid: `u${i}`,
  name: title,
  duration: 200,
  song: { title, artist: 'Weezer' },
}))

// Rows are 50px tall, from the top of the page
const layOut = () =>
  queue.forEach((_, i) => {
    screen.getByTestId(`upnext-${i}`).getBoundingClientRect = () => ({
      top: i * 50,
      height: 50,
      bottom: i * 50 + 50,
    })
  })

const renderList = (props = {}) => {
  const handlers = {
    onPlay: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onLongPress: vi.fn(),
  }
  render(
    <UpNext queue={queue} current={1} highlight={2} {...handlers} {...props} />,
  )
  layOut()
  return handlers
}

const row = (i) => screen.getByTestId(`upnext-${i}`)
const list = () => screen.getByRole('listbox')
const at = (x, y) => ({ clientX: x, clientY: y, pointerId: 1 })

describe('<UpNext />', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigator.vibrate = vi.fn()
  })
  afterEach(() => vi.useRealTimers())

  it('lists the queue like an iPod menu: the song playing marked, the wheel’s song highlighted', () => {
    renderList()
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(row(1)).toHaveAttribute('aria-current', 'true')
    expect(row(1)).toHaveTextContent('▶')
    expect(row(2)).toHaveAttribute('aria-selected', 'true')
    expect(row(0)).toHaveAttribute('aria-selected', 'false')
  })

  it('plays a song when tapped', () => {
    const h = renderList()
    fireEvent.pointerDown(row(3), at(50, 175))
    fireEvent.pointerUp(list(), at(50, 175))
    expect(h.onPlay).toHaveBeenCalledWith(3)
  })

  it('moves a song held, then dragged, to where it is dropped', () => {
    const h = renderList()
    fireEvent.pointerDown(row(0), at(50, 25))
    act(() => vi.advanceTimersByTime(HOLD_MS))
    expect(navigator.vibrate).toHaveBeenCalled()
    fireEvent.pointerMove(list(), at(50, 90))
    fireEvent.pointerMove(list(), at(50, 130))
    fireEvent.pointerUp(list(), at(50, 130))
    expect(h.onMove).toHaveBeenCalledWith(0, 2)
    expect(h.onPlay).not.toHaveBeenCalled()
  })

  it('removes a song swiped far enough left, and keeps one swiped a little', () => {
    const h = renderList()
    fireEvent.pointerDown(row(2), at(200, 125))
    fireEvent.pointerMove(list(), at(170, 126))
    fireEvent.pointerUp(list(), at(170, 126))
    expect(h.onRemove).not.toHaveBeenCalled()

    fireEvent.pointerDown(row(2), at(200, 125))
    fireEvent.pointerMove(list(), at(150, 127))
    fireEvent.pointerMove(list(), at(200 - REMOVE_AT - 5, 128))
    fireEvent.pointerUp(list(), at(200 - REMOVE_AT - 5, 128))
    expect(h.onRemove).toHaveBeenCalledWith(2)
    expect(h.onPlay).not.toHaveBeenCalled()
  })

  it('opens the actions of a song held without moving', () => {
    const h = renderList()
    fireEvent.pointerDown(row(1), at(50, 75))
    act(() => vi.advanceTimersByTime(HOLD_MS + 50))
    fireEvent.pointerUp(list(), at(50, 75))
    expect(h.onLongPress).toHaveBeenCalledWith(1)
    expect(h.onMove).not.toHaveBeenCalled()
    expect(h.onPlay).not.toHaveBeenCalled()
  })

  it('lets the list scroll: a finger moving up or down before the hold does nothing', () => {
    const h = renderList()
    fireEvent.pointerDown(row(1), at(50, 75))
    fireEvent.pointerMove(list(), at(52, 40))
    act(() => vi.advanceTimersByTime(HOLD_MS * 2))
    fireEvent.pointerCancel(list(), at(52, 10))
    expect(h.onPlay).not.toHaveBeenCalled()
    expect(h.onMove).not.toHaveBeenCalled()
    expect(h.onRemove).not.toHaveBeenCalled()
  })
})
