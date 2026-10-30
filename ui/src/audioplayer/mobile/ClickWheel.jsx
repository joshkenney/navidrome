import React, { useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { buzz } from './haptics'
import { angleAt, angleDelta, onRing, ticks } from './wheelMath'
import { circleBox, modelOf } from './skins'

// How far a finger moves on the ring before it is turning the wheel, not pressing a button
const DRAG_SLOP = 8

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
      transition: 'background 120ms',
      // Pressed, a button darkens a little, like the plastic under a thumb
      '&:active': { background: 'rgba(0, 0, 0, 0.1)' },
    },
    menu: { top: '3%', left: '30%', width: '40%', height: '22%' },
    prev: { left: '3%', top: '30%', width: '22%', height: '40%' },
    next: { right: '3%', top: '30%', width: '22%', height: '40%' },
    play: { bottom: '3%', left: '30%', width: '40%', height: '22%' },
    center: { transform: 'translate(-50%, -50%)', left: '50%', top: '50%' },
  },
  { name: 'NDClickWheel' },
)

// The iPod's click wheel: MENU, previous, next and play/pause, and the centre button, laid out like
// the iPod chosen ("skin"): on the wheel, on a ring around it (1st and 2nd generation) or in a row
// above it (3rd generation). Turning the wheel clicks once every "step" degrees: onTurn gets the
// clicks (positive clockwise), between onTurnStart and onTurnEnd. A turn can start on a button's
// label, which then isn't pressed
export const ClickWheel = ({
  skin,
  onMenu,
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

  const press = (action) => () => {
    if (turned.current) {
      turned.current = false
      return
    }
    buzz()
    action?.()
  }

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

  const button = (key, label, onClick, className, style) => (
    <button
      key={key}
      type="button"
      className={`${classes.button} ${className || ''}`}
      style={style}
      aria-label={label}
      data-no-swipe
      onClick={press(onClick)}
    />
  )
  const buttons = {
    menu: [t('menu'), onMenu, classes.menu],
    prev: [translate('player.previousTrackText'), onPrev, classes.prev],
    next: [translate('player.nextTrackText'), onNext, classes.next],
    play: [t('playPause'), onPlay, classes.play],
  }
  const onWheel = m.controls === 'click'

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
      {onWheel &&
        Object.entries(buttons).map(([key, [label, onClick, cls]]) =>
          button(key, label, onClick, cls),
        )}
      {button('select', t('select'), onCenter, classes.center, {
        width: `${center * 100}%`,
        height: `${center * 100}%`,
      })}
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
            '',
            circleBox(m, { cx: m.row.xs[i], cy: m.row.cy, d: m.row.d }),
          )
        })}
      {wheelElement}
    </div>
  )
}
