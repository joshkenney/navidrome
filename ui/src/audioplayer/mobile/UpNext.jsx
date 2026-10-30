import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { LCD, formatTime } from './ipodLook'
import { buzz } from './haptics'

// How long a finger rests on a song before it can be dragged to another place in the queue
export const HOLD_MS = 250
// How far a finger moves before it is scrolling or swiping, not tapping or holding
const SLOP = 8
// How far left a song is swiped to remove it
export const REMOVE_AT = 80

const useStyles = makeStyles(
  {
    list: {
      maxHeight: 'min(46vh, 420px)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      // Vertical scrolling stays native; swipes and drags are handled below
      touchAction: 'pan-y',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    row: {
      position: 'relative',
      overflow: 'hidden',
      borderBottom: `1px solid ${LCD.track}`,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    },
    // Revealed under a song swiped left
    remove: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 12,
      background: '#c62828',
      color: '#fff',
      fontSize: 13,
    },
    content: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 10px',
      minHeight: 44,
      boxSizing: 'border-box',
      background: LCD.background,
      color: LCD.text,
      transition: 'transform 120ms ease-out',
    },
    highlighted: {
      background: LCD.highlight,
      color: LCD.highlightText,
      '& $artist, & $time': { color: LCD.highlightText },
    },
    dragging: {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
      zIndex: 1,
      transition: 'none',
    },
    marker: { width: 12, flex: '0 0 12px', fontSize: 11 },
    text: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 15,
      lineHeight: '19px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    artist: {
      fontSize: 12,
      lineHeight: '16px',
      color: LCD.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    time: { fontSize: 12, color: LCD.muted },
  },
  { name: 'NDUpNext' },
)

// The queue order shown while a song is dragged from "from" to "over"
const previewOrder = (length, drag) => {
  const order = [...Array(length).keys()]
  if (!drag || drag.from === drag.over) return order
  const [moved] = order.splice(drag.from, 1)
  order.splice(drag.over, 0, moved)
  return order
}

// The queue on the iPod's screen, as an iPod menu: the song playing is marked ▸, the one the wheel
// is on is highlighted. Tap a song to play it, hold then drag it to move it, swipe it left to
// remove it, or hold it without moving for more
export const UpNext = ({
  queue,
  current,
  highlight,
  onPlay,
  onMove,
  onRemove,
  onLongPress,
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const list = useRef(null)
  const rows = useRef([])
  const gesture = useRef(null)
  const [drag, setDrag] = useState(null) // { from, over }
  const [swipe, setSwipe] = useState(null) // { index, dx }

  // Keeps the highlighted song in view as the wheel moves
  useEffect(() => {
    rows.current[highlight]?.scrollIntoView?.({ block: 'nearest' })
  }, [highlight])

  // While dragging or swiping, the page must not scroll: only a non-passive listener can stop it
  useEffect(() => {
    const el = list.current
    if (!el) return undefined
    const onTouchMove = (e) => {
      const mode = gesture.current?.mode
      if (mode === 'drag' || mode === 'swipe') e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  // The place in the list under a finger: the last song whose top is above it
  const overIndex = (y) => {
    let over = 0
    rows.current.forEach((row, i) => {
      if (row && y >= row.getBoundingClientRect().top) over = i
    })
    return Math.min(over, queue.length - 1)
  }

  const reset = () => {
    clearTimeout(gesture.current?.timer)
    gesture.current = null
    setDrag(null)
    setSwipe(null)
  }

  const onPointerDown = (index) => (e) => {
    const g = { index, x: e.clientX, y: e.clientY, mode: 'pending' }
    g.timer = setTimeout(() => {
      if (gesture.current !== g || g.mode !== 'pending') return
      g.mode = 'drag'
      buzz(8)
      setDrag({ from: index, over: index })
    }, HOLD_MS)
    gesture.current = g
  }

  const onPointerMove = (e) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.mode === 'pending') {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
        clearTimeout(g.timer)
        g.mode = 'swipe'
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else if (Math.abs(dy) > SLOP) {
        // The list scrolls natively
        clearTimeout(g.timer)
        g.mode = 'scroll'
      }
    }
    if (g.mode === 'swipe') {
      setSwipe({ index: g.index, dx: Math.min(0, dx) })
    } else if (g.mode === 'drag') {
      g.moved = g.moved || Math.abs(dy) > SLOP
      const over = overIndex(e.clientY)
      setDrag((d) => (d && d.over !== over ? { ...d, over } : d))
    }
  }

  const onPointerUp = (e) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    if (g.mode === 'pending') {
      onPlay(g.index)
    } else if (g.mode === 'swipe' && dx <= -REMOVE_AT) {
      buzz(8)
      onRemove(g.index)
    } else if (g.mode === 'drag') {
      const over = overIndex(e.clientY)
      if (over !== g.index) {
        onMove(g.index, over)
      } else if (!g.moved) {
        onLongPress?.(g.index)
      }
    }
    reset()
  }

  const order = useMemo(
    () => previewOrder(queue.length, drag),
    [queue.length, drag],
  )

  return (
    <ul
      ref={list}
      className={classes.list}
      role="listbox"
      aria-label={translate('player.mobile.upNext')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
    >
      {order.map((index, position) => {
        const item = queue[index]
        if (!item) return null
        const song = item.song || {}
        const isCurrent = index === current
        const swiped = swipe?.index === index ? swipe.dx : 0
        return (
          <li
            key={item.uuid || index}
            ref={(el) => (rows.current[position] = el)}
            className={classes.row}
            role="option"
            aria-selected={index === highlight}
            aria-current={isCurrent ? 'true' : undefined}
            data-testid={`upnext-${index}`}
            tabIndex={index === highlight ? 0 : -1}
            onPointerDown={onPointerDown(index)}
            onKeyDown={(e) => e.key === 'Enter' && onPlay(index)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {swiped < 0 && (
              <div className={classes.remove} aria-hidden>
                {translate('player.mobile.remove')}
              </div>
            )}
            <div
              className={[
                classes.content,
                'songTitle',
                index === highlight && classes.highlighted,
                drag?.from === index && classes.dragging,
              ]
                .filter(Boolean)
                .join(' ')}
              style={swiped ? { transform: `translateX(${swiped}px)` } : null}
            >
              <span className={classes.marker} aria-hidden>
                {isCurrent ? '▶' : ''}
              </span>
              <div className={classes.text}>
                <div className={classes.title}>{song.title || item.name}</div>
                <div className={classes.artist}>
                  {song.artist || item.singer}
                </div>
              </div>
              {item.duration > 0 && (
                <span className={classes.time}>
                  {formatTime(item.duration)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
