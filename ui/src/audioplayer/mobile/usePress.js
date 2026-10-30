import { useEffect, useRef } from 'react'
import { buzz } from './haptics'

// How long a finger rests before it is a long press, how far it moves before it isn't one, and how
// far sideways a swipe goes
export const LONG_PRESS_MS = 500
const SLOP = 10
const SWIPE = 50

// Pointer handlers for a long press and sideways swipes on an element. "wasHandled" tells a click
// handler to skip the click that ends one of them
export const usePress = ({ onLongPress, onSwipeLeft, onSwipeRight }) => {
  const press = useRef(null)
  const handled = useRef(false)
  useEffect(() => () => clearTimeout(press.current?.timer), [])

  const onPointerDown = (e) => {
    handled.current = false
    const p = { x: e.clientX, y: e.clientY, moved: false }
    if (onLongPress) {
      p.timer = setTimeout(() => {
        if (press.current !== p || p.moved) return
        handled.current = true
        press.current = null
        buzz('hold')
        onLongPress()
      }, LONG_PRESS_MS)
    }
    press.current = p
  }
  const onPointerMove = (e) => {
    const p = press.current
    if (!p || p.moved) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) {
      p.moved = true
      clearTimeout(p.timer)
    }
  }
  const onPointerUp = (e) => {
    const p = press.current
    press.current = null
    if (!p) return
    clearTimeout(p.timer)
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const swipe = dx < 0 ? onSwipeLeft : onSwipeRight
      if (swipe) {
        handled.current = true
        buzz()
        swipe()
      }
    }
  }
  const onPointerCancel = () => {
    clearTimeout(press.current?.timer)
    press.current = null
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      // The browser's own long-press menu (save image...) would get in the way
      onContextMenu: (e) => onLongPress && e.preventDefault(),
    },
    wasHandled: () => handled.current,
  }
}
