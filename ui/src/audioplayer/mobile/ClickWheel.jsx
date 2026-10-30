import React, { useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import SkipPreviousIcon from '@material-ui/icons/SkipPrevious'
import SkipNextIcon from '@material-ui/icons/SkipNext'
import { buzz } from './haptics'
import { angleAt, angleDelta, onRing, ticks } from './wheelMath'

// The centre button's radius, as a share of the wheel's (see the "center" style)
const CENTER = 0.34
// How far a finger moves on the ring before it is turning the wheel, not pressing a button
const DRAG_SLOP = 8

const useStyles = makeStyles(
  {
    wheel: {
      position: 'relative',
      width: 'min(72vw, 40vh, 300px)',
      aspectRatio: '1 / 1',
      borderRadius: '50%',
      background: (p) => p.look.wheel,
      boxShadow: (p) =>
        `0 0 0 1px ${p.look.wheelEdge}, 0 2px 6px rgba(0, 0, 0, 0.25)`,
      touchAction: 'none',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
    },
    button: {
      position: 'absolute',
      border: 0,
      background: 'transparent',
      color: (p) => p.look.label,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      '&:active': { opacity: 0.6 },
      '& svg': { fontSize: 28 },
    },
    menu: {
      top: '4%',
      left: '30%',
      width: '40%',
      height: '20%',
      fontSize: 14,
      letterSpacing: 1,
    },
    prev: { left: '4%', top: '30%', width: '20%', height: '40%' },
    next: { right: '4%', top: '30%', width: '20%', height: '40%' },
    play: {
      bottom: '4%',
      left: '30%',
      width: '40%',
      height: '20%',
      fontSize: 15,
      letterSpacing: -2,
    },
    center: {
      position: 'absolute',
      top: '33%',
      left: '33%',
      width: '34%',
      height: '34%',
      borderRadius: '50%',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      background: (p) => p.look.center,
      boxShadow: (p) =>
        `0 0 0 1px ${p.look.wheelEdge}, inset 0 1px 2px rgba(255, 255, 255, 0.2)`,
      WebkitTapHighlightColor: 'transparent',
      '&:active': { filter: 'brightness(0.92)' },
    },
  },
  { name: 'NDClickWheel' },
)

// The iPod's click wheel: MENU, previous, next and play/pause around the ring, and the centre
// button. Turning the ring clicks once every "step" degrees: onTurn gets the clicks (positive
// clockwise), between onTurnStart and onTurnEnd. A turn can start on a button's label, which then
// isn't pressed
export const ClickWheel = ({
  look,
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
  const classes = useStyles({ look })
  const translate = useTranslate()
  const t = (key) => translate(`player.mobile.${key}`)
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
    if (!onRing(cx, cy, rect.width / 2, e.clientX, e.clientY, CENTER)) return
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
      buzz(3)
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

  return (
    <div
      ref={wheel}
      className={classes.wheel}
      data-testid="click-wheel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endTurn}
      onPointerCancel={endTurn}
    >
      <button
        type="button"
        className={`${classes.button} ${classes.menu} songTitle`}
        aria-label={t('menu')}
        onClick={press(onMenu)}
      >
        MENU
      </button>
      <button
        type="button"
        className={`${classes.button} ${classes.prev}`}
        aria-label={translate('player.previousTrackText')}
        onClick={press(onPrev)}
      >
        <SkipPreviousIcon />
      </button>
      <button
        type="button"
        className={`${classes.button} ${classes.next}`}
        aria-label={translate('player.nextTrackText')}
        onClick={press(onNext)}
      >
        <SkipNextIcon />
      </button>
      <button
        type="button"
        className={`${classes.button} ${classes.play} songTitle`}
        aria-label={t('playPause')}
        onClick={press(onPlay)}
      >
        ▶❚❚
      </button>
      <button
        type="button"
        className={classes.center}
        aria-label={t('select')}
        onClick={press(onCenter)}
      />
    </div>
  )
}
