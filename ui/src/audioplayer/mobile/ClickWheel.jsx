import React, { useEffect, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { buzz } from './haptics'
import { angleAt, angleDelta, onRing, ticks } from './wheelMath'
import { circleBox, modelOf } from './skins'

// How far a finger moves on the ring before it is turning the wheel, not pressing a button
const DRAG_SLOP = 8
// Holding MENU this long toggles the backlight, like the iPod's
export const MENU_HOLD_MS = 600
// A press shows at least this long, so a quick tap is seen
const PRESS_SHOWN_MS = 120

// Which way each button lies from the centre, for the press: [x, y]
const SIDES = { menu: [0, -1], play: [0, 1], prev: [-1, 0], next: [1, 0] }
// The 1st and 2nd generation's ring buttons, each a quarter of the ring between its grooves:
// the angle (degrees, clockwise from the right) at its middle
const RING_ANGLES = { next: 0, play: 90, prev: 180, menu: 270 }

// A quarter of a ring, from "a0" to "a1" degrees, between radii r0 and r1 (a 100x100 box)
const ringSegment = (r0, r1, a0, a1) => {
  const at = (r, a) => {
    const rad = (a * Math.PI) / 180
    return `${50 + r * Math.cos(rad)} ${50 + r * Math.sin(rad)}`
  }
  return `M${at(r1, a0)} A${r1} ${r1} 0 0 1 ${at(r1, a1)} L${at(r0, a1)} A${r0} ${r0} 0 0 0 ${at(r0, a0)}Z`
}

// The click wheel pressed at one edge: it tilts in, that edge shaded with a soft shadow inside it,
// the far edge catching a little light. Only the wheel: the centre button is left out
const tilt = ([x, y]) => {
  const to = { '0,-1': 'bottom', '0,1': 'top', '-1,0': 'right', '1,0': 'left' }[
    `${x},${y}`
  ]
  return {
    background: `linear-gradient(to ${to}, rgba(0, 0, 0, 0.13) 0%, rgba(0, 0, 0, 0.04) 22%, transparent 45%, rgba(255, 255, 255, 0.05) 100%)`,
    boxShadow: `inset ${-x * 3}px ${-y * 3}px 5px -2px rgba(0, 0, 0, 0.32), inset ${x * 2}px ${y * 2}px 3px -2px rgba(255, 255, 255, 0.22)`,
  }
}

const useStyles = makeStyles(
  {
    // Placed over the iPod's front (see IpodBody), which draws the wheel: only the touch areas are
    // here, at the same places
    layer: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      '& > *': { pointerEvents: 'auto' },
    },
    wheel: {
      position: 'absolute',
      borderRadius: '50%',
      touchAction: 'none',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
    },
    button: {
      position: 'absolute',
      border: 0,
      padding: 0,
      margin: 0,
      background: 'transparent',
      color: 'transparent',
      fontSize: 0,
      cursor: 'pointer',
      borderRadius: '50%',
      WebkitTapHighlightColor: 'transparent',
    },
    // The 3rd generation's buttons, touch-sensitive and lit: pressed, a little darker
    rowButton: {
      transition: 'background 120ms',
      '&:active': { background: 'rgba(0, 0, 0, 0.1)' },
    },
    // The press, drawn over the wheel or the ring: easing in quickly, and out
    press: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      pointerEvents: 'none',
      opacity: 0,
      transition: 'opacity 200ms ease-out',
    },
    pressed: { opacity: 1, transition: 'opacity 60ms ease-in' },
    menu: { top: '3%', left: '30%', width: '40%', height: '22%' },
    prev: { left: '3%', top: '30%', width: '22%', height: '40%' },
    next: { right: '3%', top: '30%', width: '22%', height: '40%' },
    play: { bottom: '3%', left: '30%', width: '40%', height: '22%' },
    center: { transform: 'translate(-50%, -50%)', left: '50%', top: '50%' },
    // The centre button, pressed, sinks a little: shaded at the top, a faint light catching its
    // lower edge, easing back when let go
    sinks: {
      transition: 'box-shadow 180ms ease-out, background 180ms ease-out',
      '&:active': {
        background: 'rgba(0, 0, 0, 0.06)',
        boxShadow:
          'inset 0 2px 5px rgba(0, 0, 0, 0.32), inset 0 -1px 2px rgba(255, 255, 255, 0.14)',
        transition: 'box-shadow 60ms ease-in, background 60ms ease-in',
      },
    },
    // The 3rd generation's was touch-sensitive, and didn't move
    still: { '&:active': { background: 'transparent' } },
  },
  { name: 'NDClickWheel' },
)

// One of the 1st and 2nd generation's ring buttons pushed in: its quarter of the ring a little
// darker, shadowed inside along its top and left edges, as the light falls from above
const RingPress = ({ angle, inner }) => {
  const id = `nd-ring-press-${angle}`
  const d = ringSegment(inner, 49.6, angle - 44.2, angle + 44.2)
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={d} />
        </clipPath>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <path d={d} fill="rgba(0, 0, 0, 0.045)" />
        <path
          d={d}
          fill="none"
          stroke="rgba(0, 0, 0, 0.26)"
          strokeWidth="1.8"
          transform="translate(0.3 1.1)"
          filter={`url(#${id}-blur)`}
        />
        <path
          d={d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.6)"
          strokeWidth="1"
          transform="translate(-0.3 -0.6)"
          filter={`url(#${id}-blur)`}
        />
      </g>
    </>
  )
}

// The iPod's click wheel: MENU, previous, next and play/pause, and the centre button, laid out like
// the iPod chosen ("skin"): on the wheel, on a ring around it (1st and 2nd generation) or in a row
// above it (3rd generation). Turning the wheel clicks once every "step" degrees: onTurn gets the
// clicks (positive clockwise), between onTurnStart and onTurnEnd. A turn can start on a button's
// label, which then isn't pressed. Holding MENU calls onMenuHold instead of onMenu
export const ClickWheel = ({
  skin,
  onMenu,
  onMenuHold,
  onPrev,
  onNext,
  onPlay,
  onCenter,
  step = 6,
  onTurnStart,
  onTurn,
  onTurnEnd,
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const t = (key) => translate(`player.mobile.${key}`)
  const m = modelOf(skin)
  // The centre button's radius, as a share of the wheel's
  const center = m.center / m.wheel.d
  const wheel = useRef(null)
  const turn = useRef(null)
  // Set when a turn ends, so the click that ends it doesn't press the button it ended on
  const turned = useRef(false)
  // Holding MENU: its timer, and whether it went off (then the click that ends the hold is no press)
  const hold = useRef({ timer: null, done: false })
  useEffect(() => () => clearTimeout(hold.current.timer), [])
  // The button held down ("down"), and the last one pressed ("side"), kept as the press fades
  const [down, setDown] = useState(null)
  const [side, setSide] = useState(null)
  const pressedAt = useRef(0)
  const letGo = useRef(null)
  useEffect(() => () => clearTimeout(letGo.current), [])
  const pressDown = (key) => {
    clearTimeout(letGo.current)
    pressedAt.current = Date.now()
    setSide(key)
    setDown(key)
  }
  const pressUp = () => {
    clearTimeout(letGo.current)
    const left = PRESS_SHOWN_MS - (Date.now() - pressedAt.current)
    if (left > 0) letGo.current = setTimeout(() => setDown(null), left)
    else setDown(null)
  }

  const press = (action) => () => {
    if (turned.current) {
      turned.current = false
      return
    }
    if (hold.current.done) {
      hold.current.done = false
      return
    }
    buzz()
    action?.()
  }

  const startHold = () => {
    clearTimeout(hold.current.timer)
    hold.current.done = false
    if (!onMenuHold) return
    hold.current.timer = setTimeout(() => {
      hold.current.done = true
      buzz('hold')
      onMenuHold()
    }, MENU_HOLD_MS)
  }
  const endHold = () => clearTimeout(hold.current.timer)

  const onPointerDown = (e) => {
    turned.current = false
    const rect = wheel.current?.getBoundingClientRect()
    if (!rect || !rect.width) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    if (!onRing(cx, cy, rect.width / 2, e.clientX, e.clientY, center)) return
    turn.current = {
      cx,
      cy,
      x: e.clientX,
      y: e.clientY,
      angle: angleAt(cx, cy, e.clientX, e.clientY),
      total: 0,
      clicks: 0,
      turning: false,
    }
  }

  const onPointerMove = (e) => {
    const tr = turn.current
    if (!tr) return
    const angle = angleAt(tr.cx, tr.cy, e.clientX, e.clientY)
    tr.total += angleDelta(tr.angle, angle)
    tr.angle = angle
    if (!tr.turning) {
      if (Math.hypot(e.clientX - tr.x, e.clientY - tr.y) < DRAG_SLOP) return
      tr.turning = true
      endHold() // A turn that starts on MENU isn't holding it
      clearTimeout(letGo.current)
      setDown(null) // Nor pressing the button it started on
      // Only now, so a plain tap still clicks the button under the finger
      wheel.current?.setPointerCapture?.(e.pointerId)
      onTurnStart?.()
    }
    const clicks = ticks(tr.total, step)
    if (clicks !== tr.clicks) {
      buzz('tick')
      onTurn?.(clicks - tr.clicks)
      tr.clicks = clicks
    }
  }

  const endTurn = (e) => {
    const tr = turn.current
    turn.current = null
    wheel.current?.releasePointerCapture?.(e.pointerId)
    if (tr?.turning) {
      turned.current = true
      onTurnEnd?.()
    }
  }

  // Pressing a button on the wheel or the ring shows; the 3rd generation's light up by themselves
  const shows = m.controls !== 'row'
  const button = (key, label, onClick, className, style) => {
    const isMenu = key === 'menu'
    const shown = shows && key !== 'select'
    return (
      <button
        key={key}
        type="button"
        className={`${classes.button} ${className || ''}`}
        style={style}
        aria-label={label}
        data-no-swipe
        onClick={press(onClick)}
        onPointerDown={() => {
          if (shown) pressDown(key)
          if (isMenu) startHold()
        }}
        onPointerUp={() => {
          if (shown) pressUp()
          if (isMenu) endHold()
        }}
        onPointerLeave={() => {
          if (shown) pressUp()
          if (isMenu) endHold()
        }}
        onPointerCancel={() => {
          if (shown) pressUp()
          if (isMenu) endHold()
        }}
        {...(isMenu && { onContextMenu: (e) => e.preventDefault() })}
      />
    )
  }
  const buttons = {
    menu: [t('menu'), onMenu, classes.menu],
    prev: [translate('player.previousTrackText'), onPrev, classes.prev],
    next: [translate('player.nextTrackText'), onNext, classes.next],
    play: [t('playPause'), onPlay, classes.play],
  }
  const onWheel = m.controls === 'click'
  // Where the ring's buttons begin, inside it (a 100x100 box): just outside the wheel
  const ringInner = m.ring ? ((m.wheel.d / 2 + 0.6) / m.ring.d) * 100 : 0
  // The wheel without its centre button
  const hole = `radial-gradient(circle, transparent ${center * 50}%, #000 ${center * 50 + 0.6}%)`

  const wheelElement = (
    <div
      ref={wheel}
      className={classes.wheel}
      style={circleBox(m, m.wheel)}
      data-testid="click-wheel"
      data-wheel={m.controls}
      data-no-swipe
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endTurn}
      onPointerCancel={endTurn}
    >
      {onWheel && (
        <div
          className={`${classes.press} ${down ? classes.pressed : ''}`}
          style={{
            ...(side && tilt(SIDES[side])),
            WebkitMaskImage: hole,
            maskImage: hole,
          }}
          data-testid="wheel-press"
          data-pressed={down || undefined}
          aria-hidden
        />
      )}
      {onWheel &&
        Object.entries(buttons).map(([key, [label, onClick, cls]]) =>
          button(key, label, onClick, cls),
        )}
      {button(
        'select',
        t('select'),
        onCenter,
        `${classes.center} ${m.controls === 'row' ? classes.still : classes.sinks}`,
        {
          width: `${center * 100}%`,
          height: `${center * 100}%`,
        },
      )}
    </div>
  )

  return (
    <div className={classes.layer}>
      {m.controls === 'ring' && (
        // The ring around the wheel: its buttons are on the ring, outside the wheel
        <div
          className={classes.wheel}
          style={circleBox(m, m.ring)}
          data-no-swipe
        >
          <svg
            className={`${classes.press} ${down ? classes.pressed : ''}`}
            viewBox="0 0 100 100"
            data-testid="ring-press"
            data-pressed={down || undefined}
            aria-hidden
          >
            {side && (
              <RingPress
                key={side}
                angle={RING_ANGLES[side]}
                inner={ringInner}
              />
            )}
          </svg>
          {Object.entries(buttons).map(([key, [label, onClick, cls]]) =>
            button(key, label, onClick, cls),
          )}
        </div>
      )}
      {m.controls === 'row' &&
        ['prev', 'menu', 'play', 'next'].map((key, i) => {
          const [label, onClick] = buttons[key]
          return button(
            key,
            label,
            onClick,
            classes.rowButton,
            circleBox(m, { cx: m.row.xs[i], cy: m.row.cy, d: m.row.d }),
          )
        })}
      {wheelElement}
    </div>
  )
}
