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
    // 1st and 2nd generation: the four buttons on a ring around a smaller wheel
    ring: {
      position: 'relative',
      width: 'min(80vw, 44vh, 330px)',
      aspectRatio: '1 / 1',
      borderRadius: '50%',
      background: (p) => p.look.ring || p.look.wheel,
      boxShadow: (p) =>
        `0 0 0 1px ${p.look.wheelEdge}, 0 2px 6px rgba(0, 0, 0, 0.25)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
    },
    innerWheel: {
      width: '64%',
      boxShadow: (p) =>
        `0 0 0 1px ${p.look.wheelEdge}, inset 0 1px 4px rgba(0, 0, 0, 0.18)`,
    },
    ringMenu: { top: '2%', left: '30%', width: '40%', height: '15%' },
    ringPrev: { left: '1%', top: '30%', width: '15%', height: '40%' },
    ringNext: { right: '1%', top: '30%', width: '15%', height: '40%' },
    ringPlay: { bottom: '2%', left: '30%', width: '40%', height: '15%' },
    // 3rd generation: four lit buttons in a row above the wheel
    column: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18,
    },
    row: { display: 'flex', gap: 12 },
    rowButton: {
      position: 'static',
      width: 58,
      height: 40,
      borderRadius: 20,
      background: (p) => p.look.rowButton || p.look.center,
      color: (p) => `${p.look.rowLabel || p.look.label} !important`,
      boxShadow: (p) =>
        `0 0 0 1px ${p.look.wheelEdge}, 0 1px 3px rgba(0, 0, 0, 0.2)`,
      fontSize: 11,
      letterSpacing: 0.5,
      textShadow: (p) =>
        p.look.rowLabel ? `0 0 6px ${p.look.rowLabel}` : 'none',
      '& svg': { fontSize: '22px !important' },
    },
    rowWheel: { width: 'min(66vw, 34vh, 270px)' },
    // The transparent iPod's clear wheel
    glass: {
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
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

  const type = look.wheelType || 'click'
  const at = (positions) => (type === 'row' ? classes.rowButton : positions)
  const button = (key, position, label, onClick, content, chicago) => (
    <button
      key={key}
      type="button"
      className={[classes.button, at(position), chicago && 'songTitle']
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      onClick={press(onClick)}
    >
      {content}
    </button>
  )
  const ring = type === 'ring'
  const menu = button(
    'menu',
    ring ? classes.ringMenu : classes.menu,
    t('menu'),
    onMenu,
    'MENU',
    true,
  )
  const prev = button(
    'prev',
    ring ? classes.ringPrev : classes.prev,
    translate('player.previousTrackText'),
    onPrev,
    <SkipPreviousIcon />,
  )
  const next = button(
    'next',
    ring ? classes.ringNext : classes.next,
    translate('player.nextTrackText'),
    onNext,
    <SkipNextIcon />,
  )
  const play = button(
    'play',
    ring ? classes.ringPlay : classes.play,
    t('playPause'),
    onPlay,
    '▶❚❚',
    true,
  )

  const wheelElement = (
    <div
      ref={wheel}
      className={[
        classes.wheel,
        ring && classes.innerWheel,
        type === 'row' && classes.rowWheel,
        look.glass && classes.glass,
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="click-wheel"
      data-wheel={type}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endTurn}
      onPointerCancel={endTurn}
    >
      {type === 'click' && [menu, prev, next, play]}
      <button
        type="button"
        className={classes.center}
        aria-label={t('select')}
        onClick={press(onCenter)}
      />
    </div>
  )

  if (ring) {
    return (
      <div className={classes.ring}>
        {[menu, prev, next, play]}
        {wheelElement}
      </div>
    )
  }
  if (type === 'row') {
    return (
      <div className={classes.column}>
        <div className={classes.row}>{[prev, menu, play, next]}</div>
        {wheelElement}
      </div>
    )
  }
  return wheelElement
}
