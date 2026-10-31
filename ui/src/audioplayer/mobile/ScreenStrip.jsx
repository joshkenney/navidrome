import React, { useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { usePress } from './usePress'
import { Marquee } from './Marquee'
import { buzz } from './haptics'

// Height of the strip, without the phone's safe area (the iPhone home bar)
export const STRIP_HEIGHT = 72

// How far up a swipe goes to open the player
const SWIPE_OPEN = 30
// How much + and - change the volume
const VOLUME_STEP = 0.1

const useStyles = makeStyles(
  (theme) => ({
    root: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: `calc(${STRIP_HEIGHT}px + env(safe-area-inset-bottom))`,
      padding: '5px 8px calc(5px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      background: theme.palette.background.default,
      // Above the pages, below the sidebar drawer and dialogs
      zIndex: theme.zIndex.appBar - 1,
      touchAction: 'pan-x',
      userSelect: 'none',
      cursor: 'pointer',
    },
    // The 1st generation iPod shuffle, lying on its side: white plastic, rounded at the ends
    shuffle: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      borderRadius: 13,
      overflow: 'hidden',
      background:
        'linear-gradient(180deg, #fdfdfd 0%, #f2f2f3 55%, #e1e1e3 100%)',
      boxShadow:
        '0 1px 3px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(0, 0, 0, 0.12), inset 0 1px 0 #ffffff',
    },
    // Its round pad: + and - (the volume), back and forward, play and pause in the middle
    pad: {
      position: 'relative',
      flex: '0 0 auto',
      height: '100%',
      aspectRatio: '1 / 1',
      padding: 3,
      boxSizing: 'border-box',
      marginRight: 4,
    },
    padFace: { width: '100%', height: '100%', display: 'block' },
    padButton: {
      position: 'absolute',
      border: 0,
      padding: 0,
      margin: 0,
      background: 'transparent',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      borderRadius: '50%',
      '&:active': { background: 'rgba(0, 0, 0, 0.08)' },
      '&:focus-visible': { outline: '2px solid #7a9cc6' },
    },
    up: { left: '30%', top: 0, width: '40%', height: '30%' },
    down: { left: '30%', bottom: 0, width: '40%', height: '30%' },
    back: { left: 0, top: '30%', width: '30%', height: '40%' },
    forward: { right: 0, top: '30%', width: '30%', height: '40%' },
    middle: { left: '30%', top: '30%', width: '40%', height: '40%' },
    // The song playing, printed on the shuffle
    info: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 12px',
      color: '#4b4c4f',
      outline: 'none',
    },
    title: {
      fontSize: 15,
      lineHeight: '18px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    },
    artist: {
      fontSize: 13,
      lineHeight: '16px',
      color: '#8b8c90',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    track: {
      height: 2,
      marginTop: 5,
      borderRadius: 1,
      background: 'rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
    },
    fill: { height: '100%', background: '#9a9ca0' },
    // The cap over its USB plug, at the left end, a seam after it
    cap: {
      flex: '0 0 auto',
      alignSelf: 'stretch',
      width: 34,
      borderRight: '1px solid rgba(0, 0, 0, 0.16)',
      boxShadow: 'inset -1px 0 0 #ffffff',
      background:
        'linear-gradient(180deg, #f7f7f8 0%, #ebebec 55%, #dadadc 100%)',
    },
  }),
  { name: 'NDScreenStrip' },
)

// The shuffle's pad, drawn: a grey ring with its markings round a white button
const PadFace = ({ playing, className }) => (
  <svg className={className} viewBox="0 0 100 100" aria-hidden>
    <defs>
      <radialGradient id="ndShuffleRing" cx="0.5" cy="0.42" r="0.6">
        <stop offset="0.55" stopColor="#ececed" />
        <stop offset="1" stopColor="#c9cacc" />
      </radialGradient>
      <radialGradient id="ndShuffleButton" cx="0.5" cy="0.35" r="0.65">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e6e6e8" />
      </radialGradient>
    </defs>
    <circle
      cx="50"
      cy="50"
      r="48"
      fill="url(#ndShuffleRing)"
      stroke="#b9babd"
    />
    <circle
      cx="50"
      cy="50"
      r="27"
      fill="url(#ndShuffleButton)"
      stroke="#c3c4c7"
    />
    <g fill="#9c9da1">
      <path d="M46 14 h8 v2.4 h-8 Z M48.8 11.2 h2.4 v8 h-2.4 Z" />
      <path d="M46 84.4 h8 v2.4 h-8 Z" />
      <path d="M11 45 v10 h1.8 v-10 Z M13 50 l5 -5 v10 Z M18 50 l5 -5 v10 Z" />
      <path d="M89 45 v10 h-1.8 v-10 Z M87 50 l-5 -5 v10 Z M82 50 l-5 -5 v10 Z" />
      {playing ? (
        <path d="M44 44 v12 h4 v-12 Z M52 44 v12 h4 v-12 Z" />
      ) : (
        <path d="M44.5 43 L57.5 50 L44.5 57 Z" />
      )}
    </g>
  </svg>
)

// The collapsed phone player: whatever the iPod chosen, a 1st generation iPod shuffle lying along
// the bottom, its cap on the left, the song playing printed on it, its pad on the right playing
// and pausing, skipping and setting the volume. A tap or a swipe up opens the whole iPod
export const ScreenStrip = ({ audio, controls, onOpen, onActions }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const start = useRef(null)
  const { song, item, playing, currentTime, duration, isRadio } = audio
  // Holding the strip shows what can be done with the song, instead of opening the player
  const hold = usePress({ onLongPress: onActions && (() => onActions(item)) })

  // A swipe up opens the player; a tap is a click (below), so mice and keyboards work too. A
  // click that ends a swipe is ignored, as the swipe already opened it
  const swiped = useRef(false)
  const onPointerDown = (e) => {
    start.current = { x: e.clientX, y: e.clientY }
    swiped.current = false
    hold.handlers.onPointerDown(e)
  }
  const onPointerUp = (e) => {
    hold.handlers.onPointerUp(e)
    const from = start.current
    start.current = null
    if (!from || hold.wasHandled()) return
    const dy = e.clientY - from.y
    if (dy < -SWIPE_OPEN && Math.abs(e.clientX - from.x) < Math.abs(dy)) {
      swiped.current = true
      onOpen()
    }
  }
  const onClick = () => {
    if (hold.wasHandled()) return
    if (swiped.current) {
      swiped.current = false
      return
    }
    onOpen()
  }

  const title = song.title || item.name || ''
  const artist = song.artist || item.singer || ''
  const progress =
    !isRadio && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const playLabel = translate(
    playing ? 'player.clickToPauseText' : 'player.clickToPlayText',
  )
  const volume = (step) => {
    if (!controls.volume || !controls.setVolume) return
    controls.setVolume(Math.max(0, Math.min(1, controls.volume() + step)))
  }

  // A button of the pad: not a tap on the strip, which opens the player
  const padButton = (className, label, action) => (
    <button
      type="button"
      className={`${classes.padButton} ${className}`}
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        buzz('press')
        action()
      }}
    />
  )

  return (
    <div
      className={classes.root}
      data-tour="mobilePlayer"
      role="region"
      aria-label={translate('player.mobile.nowPlaying')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={hold.handlers.onPointerMove}
      onPointerCancel={(e) => {
        start.current = null
        hold.handlers.onPointerCancel(e)
      }}
      onContextMenu={hold.handlers.onContextMenu}
      onClick={onClick}
    >
      <div className={classes.shuffle}>
        <div className={classes.cap} aria-hidden />
        <div
          className={classes.info}
          role="button"
          tabIndex={0}
          aria-label={translate('player.mobile.open')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
        >
          <Marquee className={classes.title}>{title}</Marquee>
          {artist && <div className={classes.artist}>{artist}</div>}
          {!isRadio && (
            <div className={classes.track}>
              <div className={classes.fill} style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className={classes.pad}>
          <PadFace className={classes.padFace} playing={playing} />
          {padButton(classes.up, translate('player.mobile.volumeUp'), () =>
            volume(VOLUME_STEP),
          )}
          {padButton(classes.down, translate('player.mobile.volumeDown'), () =>
            volume(-VOLUME_STEP),
          )}
          {padButton(
            classes.back,
            translate('player.previousTrackText'),
            controls.prev,
          )}
          {padButton(
            classes.forward,
            translate('player.nextTrackText'),
            controls.next,
          )}
          {padButton(classes.middle, playLabel, controls.togglePlay)}
        </div>
      </div>
    </div>
  )
}
