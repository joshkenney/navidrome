import React, { useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IconButton } from '@material-ui/core'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import PauseIcon from '@material-ui/icons/Pause'
import { LCD, edition } from './ipodLook'
import { usePress } from './usePress'

// Height of the strip, without the phone's safe area (the iPhone home bar)
export const STRIP_HEIGHT = 56

// How far up a swipe goes to open the player
const SWIPE_OPEN = 30

const useStyles = makeStyles(
  (theme) => ({
    root: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: `calc(${STRIP_HEIGHT}px + env(safe-area-inset-bottom))`,
      padding: '0 8px env(safe-area-inset-bottom)',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      background: (p) => p.look.case,
      boxShadow: '0 -1px 4px rgba(0, 0, 0, 0.3)',
      // Above the pages, below the sidebar drawer and dialogs
      zIndex: theme.zIndex.appBar - 1,
      touchAction: 'pan-x',
      userSelect: 'none',
      cursor: 'pointer',
    },
    screen: {
      flex: 1,
      minWidth: 0,
      height: STRIP_HEIGHT - 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 6px',
      borderRadius: 5,
      background: LCD.background,
      boxShadow: LCD.bevel,
      color: LCD.text,
      position: 'relative',
      overflow: 'hidden',
    },
    cover: {
      width: 32,
      height: 32,
      flex: '0 0 32px',
      objectFit: 'cover',
      borderRadius: 2,
      background: LCD.track,
    },
    text: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    artist: { color: LCD.muted },
    progress: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: 3,
      background: LCD.bar,
    },
    button: {
      color: (p) => p.look.label,
      padding: 8,
    },
  }),
  { name: 'NDScreenStrip' },
)

// The collapsed phone player: a strip of iPod screen at the bottom showing the song playing. A tap
// or a swipe up opens the whole iPod
export const ScreenStrip = ({ audio, controls, look, onOpen, onActions }) => {
  const classes = useStyles({ look })
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
      <div
        className={classes.screen}
        role="button"
        tabIndex={0}
        aria-label={translate('player.mobile.open')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      >
        {item.cover && (
          <img className={classes.cover} src={item.cover} alt="" />
        )}
        <div className={`${classes.text} songTitle`}>
          {title}
          {artist && <span className={classes.artist}> — {artist}</span>}
        </div>
        <div className={classes.progress} style={{ width: `${progress}%` }} />
      </div>
      <IconButton
        className={classes.button}
        aria-label={playLabel}
        title={playLabel}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          controls.togglePlay()
        }}
      >
        {playing ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>
    </div>
  )
}
