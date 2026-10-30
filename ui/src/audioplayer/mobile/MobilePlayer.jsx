import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslate } from 'react-admin'
import { Button, Slide, Snackbar } from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { ScreenStrip } from './ScreenStrip'
import { IpodScreen } from './IpodScreen'
import { ClickWheel } from './ClickWheel'
import { useAudioState } from './useAudioState'
import { lcdVars, modelOf, percentBox, screenOf, skinFor } from './skins'
import { IpodBody } from './IpodBody'
import { setHaptics } from './haptics'
import { setClicks } from './clicks'
import { addTracks, playTracks } from '../../actions'
import { useIpodNavigation } from './useIpodNavigation'
import { PlayerActions } from './PlayerActions'

// Dragging the iPod down closes it past this far, or this fast (px per ms)
const DRAG_CLOSE = 110
const FLICK_CLOSE = 0.7
// How far a finger moves before it is dragging the iPod down, or doing something else
const DRAG_SLOP = 10
// On Now Playing, turning the click wheel sets the volume, a whole range in two thirds of a turn,
// and the volume shows this long after. The centre button switches it to scrubbing instead, this
// many seconds per click (a whole turn, 60 clicks, is a minute), until the centre button is pressed
// again or the wheel is left alone a while
const VOLUME_PER_CLICK = 1 / 40
const VOLUME_SHOWN_MS = 2500
const SECONDS_PER_CLICK = 1
const SCRUB_IDLE_MS = 5000
// Degrees of a wheel click: fine for scrubbing, coarser for moving through the queue
const SCRUB_STEP = 6
const LIST_STEP = 24
// How long the "removed" notice (and its Undo) stays
const UNDO_MS = 5000
// The black and white iPods' backlight goes out this long after the last touch, like theirs,
// unless another timer is chosen in Personal settings (seconds, 0 for never on, or "always")
export const BACKLIGHT_MS = 10000

// The backlight's bulbs, behind the black and white screens' edges: three down each side, warm
const BULB = 'rgb(254, 249, 220)'
const bulb = (x, y, w, h, reach) =>
  `radial-gradient(${w}% ${h}% at ${x}% ${y}%, ${BULB} 0%, rgba(254, 249, 220, 0.85) 6%, rgba(254, 249, 220, 0.15) ${reach}%, transparent 50%)`
const BULBS = [19, 53, 83]
  .flatMap((y) => [bulb(0, y, 50, 70, 20), bulb(100, y, 20, 83, 33)])
  .join(', ')

const useStyles = makeStyles(
  (theme) => ({
    // The whole phone screen: the iPod, held up over a blur of the song's cover
    backdrop: {
      position: 'fixed',
      inset: 0,
      // Above the app bar and the sidebar, below dialogs (download, save queue), the tour and
      // notifications, which the player can open
      zIndex: theme.zIndex.modal - 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: '#0d0d0f',
      touchAction: 'none',
    },
    blur: {
      position: 'absolute',
      inset: '-10%',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(36px) saturate(1.3) brightness(0.5)',
      transform: 'scale(1.1)',
    },
    // The iPod, at its real proportions, as big as the phone allows: its screen and wheel are
    // where they were on the real one, never over each other
    device: {
      position: 'relative',
      aspectRatio: 'var(--ratio)',
      width:
        'min(calc(100vw - 28px), calc((100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) * var(--ratio)))',
      fallbacks: [
        {
          width: 'min(calc(100vw - 28px), calc((100vh - 48px) * var(--ratio)))',
        },
      ],
      filter:
        'drop-shadow(0 18px 28px rgba(0,0,0,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
      willChange: 'transform',
    },
    body: { position: 'absolute', inset: 0, display: 'block' },
    // The lit screen, under the iPod's glass
    lcd: {
      position: 'absolute',
      overflow: 'hidden',
      borderRadius: 2,
      containerType: 'size',
      // About 7.5 menu rows fill a screen, like the iPod's
      '--row': 'clamp(18px, 13.3cqh, 36px)',
    },
    // The backlight's unevenness and the early screens' pixel grid, over what is shown
    backlight: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: 'var(--lcd-grid, none)',
      boxShadow: 'var(--lcd-glow, none)',
    },
    // The bulbs glowing through the lit screen's edges (how brightly: --lcd-bulbs, 0 unlit)
    bulbs: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: BULBS,
      mixBlendMode: 'plus-lighter',
      opacity: 'var(--lcd-bulbs, 0)',
      transition: 'opacity 300ms ease-out',
    },
    // The glass's reflection over the screen
    glare: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 38%, rgba(255,255,255,0) 39%), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0) 12%)',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
    },
  }),
  { name: 'NDMobilePlayer' },
)

// The player on phones: a strip of iPod screen at the bottom of the page, which opens into a whole
// iPod, with its screen and click wheel. The music player underneath still plays the music: this
// only drives it (see playerControls)
export const MobilePlayer = ({ audioInstance, controls }) => {
  const theme = useTheme()
  // The iPod chosen in Personal settings, or one matching the theme
  const settings = useSelector((state) => state.settings) || {}
  const look = skinFor(settings.ipodSkin, theme)
  useEffect(() => {
    setHaptics(settings.ipodHaptics !== false)
  }, [settings.ipodHaptics])
  useEffect(() => {
    setClicks(settings.ipodClicks !== false)
  }, [settings.ipodClicks])
  const classes = useStyles({ look })
  const translate = useTranslate()
  const audio = useAudioState(audioInstance)
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  // The backlight (black and white screens): on when the iPod is touched, out after the timer.
  // Holding MENU turns it off, or on until it is held again ("pinned")
  const timer = settings.ipodBacklight ?? BACKLIGHT_MS / 1000
  const [lit, setLit] = useState(timer !== 0)
  const litNow = useRef(lit)
  const litBeforeTouch = useRef(lit)
  const pinned = useRef(false)
  const backlightTimer = useRef(null)
  const light = useCallback((on) => {
    litNow.current = on
    setLit(on)
  }, [])
  const wake = useCallback(() => {
    litBeforeTouch.current = litNow.current
    clearTimeout(backlightTimer.current)
    if (pinned.current) return
    light(timer !== 0)
    if (timer && timer !== 'always') {
      backlightTimer.current = setTimeout(() => light(false), timer * 1000)
    }
  }, [timer, light])
  const toggleBacklight = useCallback(() => {
    clearTimeout(backlightTimer.current)
    // The touch holding MENU woke it: what counts is how it was before
    pinned.current = !litBeforeTouch.current
    light(pinned.current)
    litBeforeTouch.current = pinned.current
  }, [light])
  useEffect(() => {
    if (open) wake()
    return () => clearTimeout(backlightTimer.current)
  }, [open, wake])

  // Dragging the iPod down: how far (px), and whether a finger is on it
  const drag = useRef(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  // The song of the queue the wheel is on in Up Next
  const [highlight, setHighlight] = useState(0)
  // The song last removed from Up Next, which Undo puts back
  const [removed, setRemoved] = useState(null)
  const undoRef = useRef(null)
  // The song whose actions are shown (from a long press), if any
  const [actionsItem, setActionsItem] = useState(null)
  // Where the wheel is scrubbing to, shown on the screen until the finger lifts and it seeks there
  const [scrubTime, setScrubTime] = useState(null)
  const scrubRef = useRef(null)
  const scrubbable = !audio.isRadio && audio.duration > 0
  // What the wheel does on Now Playing, and what the bottom of the screen shows: the song's
  // progress, the volume (the wheel turned), or scrubbing (the centre button pressed)
  const [mode, setMode] = useState('progress')
  const modeTimer = useRef(null)
  const leaveMode = useCallback(() => {
    clearTimeout(modeTimer.current)
    // Not while a finger is scrubbing
    if (scrubRef.current !== null) {
      modeTimer.current = setTimeout(leaveMode, SCRUB_IDLE_MS)
      return
    }
    setMode('progress')
  }, [])
  const showMode = (next, ms) => {
    clearTimeout(modeTimer.current)
    setMode(next)
    modeTimer.current = setTimeout(leaveMode, ms)
  }
  useEffect(() => () => clearTimeout(modeTimer.current), [])
  // Whether the phone keeps the volume to itself (iPhones), found out the first time it's turned
  const volumeLocked = useRef(null)

  // Opening adds a history entry, so the phone's Back button closes the player
  const openPlayer = useCallback(() => {
    setOpen(true)
    window.history.pushState({ ndPlayer: true }, '')
  }, [])
  const closePlayer = useCallback(() => {
    if (window.history.state?.ndPlayer) {
      window.history.back() // popstate closes it
    } else {
      setOpen(false)
    }
  }, [])

  // The iPod's menus (see useIpodNavigation), on the iPod of the song playing
  const playSongs = useCallback(
    (songs, selectedId) => {
      const byId = Object.fromEntries(songs.map((song) => [song.id, song]))
      dispatch(playTracks(byId, Object.keys(byId), selectedId))
    },
    [dispatch],
  )
  const nav = useIpodNavigation({
    song: audio.song,
    t: (key, opts) => translate(`player.mobile.${key}`, opts),
    playSongs,
    onClose: closePlayer,
  })
  const view = nav.screen.type
  // Opening the player shows the song playing, with the menus leading to it above
  const songRef = useRef(audio.song)
  songRef.current = audio.song
  const { reset } = nav
  useEffect(() => {
    if (open) reset(songRef.current)
  }, [open, reset])

  // Leaving Now Playing, or closing the iPod, ends the volume or scrubbing
  useEffect(() => {
    if (view !== 'nowPlaying' || !open) {
      clearTimeout(modeTimer.current)
      setMode('progress')
    }
  }, [view, open])
  // Up Next opens on the song playing
  const indexRef = useRef(audio.index)
  indexRef.current = audio.index
  useEffect(() => {
    if (view === 'upNext') setHighlight(indexRef.current)
  }, [view])

  const startScrub = () => {
    if (view !== 'nowPlaying' || mode !== 'scrub' || !scrubbable) return
    scrubRef.current = audio.currentTime
    setScrubTime(audio.currentTime)
    clearTimeout(modeTimer.current)
  }
  const turnVolume = (clicks) => {
    if (volumeLocked.current === null) {
      volumeLocked.current = !!controls.volumeLocked?.()
    }
    if (!volumeLocked.current && controls.setVolume) {
      const level = controls.volume?.() ?? audio.volume
      controls.setVolume(level + clicks * VOLUME_PER_CLICK)
    }
    showMode('volume', VOLUME_SHOWN_MS)
  }
  const scrub = (clicks) => {
    if (nav.isMenu) {
      nav.moveHighlight(clicks)
      return
    }
    if (view === 'upNext') {
      const last = audio.queue.length - 1
      setHighlight((h) => Math.max(0, Math.min(last, h + clicks)))
      return
    }
    if (mode !== 'scrub') {
      turnVolume(clicks)
      return
    }
    if (scrubRef.current === null) return
    const to = Math.min(
      audio.duration,
      Math.max(0, scrubRef.current + clicks * SECONDS_PER_CLICK),
    )
    scrubRef.current = to
    setScrubTime(to)
  }
  const endScrub = () => {
    if (scrubRef.current === null) return
    controls.seek(scrubRef.current)
    scrubRef.current = null
    setScrubTime(null)
    // Still scrubbing for a while, for another turn
    showMode('scrub', SCRUB_IDLE_MS)
  }

  // The centre button: on Now Playing it switches the wheel to scrubbing, and back; in Up Next it
  // plays the highlighted song; in a menu, it picks the highlighted item
  // Up Next is reached from the main menu: a song picked there shows Now Playing
  const showNowPlaying = () => nav.push({ type: 'nowPlaying' })
  const onCenter = () => {
    if (nav.isMenu) {
      nav.select()
    } else if (view === 'upNext') {
      if (highlight !== audio.index) controls.playAt(highlight)
      showNowPlaying()
    } else if (mode === 'scrub') {
      clearTimeout(modeTimer.current)
      setMode('progress')
    } else if (scrubbable) {
      showMode('scrub', SCRUB_IDLE_MS)
    }
  }
  const playFromList = (index) => {
    if (index !== audio.index) controls.playAt(index)
    showNowPlaying()
  }
  const moveInList = (from, to) => {
    controls.move(from, to)
    setHighlight(to)
  }
  // Removing the song playing first moves on to the next one, then removes it once it isn't
  // playing anymore (see the effect below): the player itself would go back to the first song
  const pendingRemove = useRef(null)
  const removeFromList = (index) => {
    const item = audio.queue[index]
    if (!item) return
    if (index === audio.index && index < audio.queue.length - 1) {
      pendingRemove.current = item.uuid
      controls.next()
    } else {
      controls.remove(index)
    }
    setHighlight((h) => Math.max(0, Math.min(h, audio.queue.length - 2)))
    setRemoved({ item, index })
  }
  useEffect(() => {
    const uuid = pendingRemove.current
    if (!uuid || audio.item.uuid === uuid) return
    pendingRemove.current = null
    const index = audio.queue.findIndex((i) => i.uuid === uuid)
    if (index >= 0) controls.remove(index)
  }, [audio.item.uuid, audio.queue, controls])
  // Undo adds the song back at the end of the queue, then moves it where it was once the player
  // has it (see the effect below)
  const undoRemove = () => {
    if (!removed) return
    const song = removed.item.song
    if (song?.id) {
      undoRef.current = { to: removed.index, length: audio.queue.length }
      dispatch(addTracks({ [song.id]: song }))
    }
    setRemoved(null)
  }
  useEffect(() => {
    const undo = undoRef.current
    if (!undo || audio.queue.length !== undo.length + 1) return
    undoRef.current = null
    controls.move(audio.queue.length - 1, undo.to)
  }, [audio.queue.length, controls])

  // MENU goes up a screen, like an iPod: from Now Playing to the album's songs, the artist, the
  // iPod's artists, Music and the main menu, which it closes
  const onMenu = () => nav.back(audio.song)
  // Closes the player for a page about to open: going back in history would race the new page,
  // so the player's history entry is just forgotten
  const leavePlayer = useCallback(() => {
    if (window.history.state?.ndPlayer) window.history.replaceState(null, '')
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onPopState = () => setOpen(false)
    window.addEventListener('popstate', onPopState)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPopState)
      document.body.style.overflow = overflow
    }
  }, [open])

  // Dragging the iPod down closes it, from anywhere but the wheel and the lists (which scroll): it
  // follows the finger, and goes back up if let go too soon
  const onDragStart = (e) => {
    wake()
    if (e.target.closest?.('[data-no-swipe]')) return
    drag.current = { x: e.clientX, y: e.clientY, t: Date.now(), active: false }
  }
  const onDragMove = (e) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    const dx = e.clientX - d.x
    if (!d.active) {
      if (dy > DRAG_SLOP && dy > Math.abs(dx)) {
        d.active = true
        setDragging(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else {
        if (Math.abs(dx) > DRAG_SLOP || dy < -DRAG_SLOP) {
          drag.current = null // A sideways swipe or a scroll up: not for us
        }
        return
      }
    }
    setDragY(Math.max(0, dy))
  }
  const onDragEnd = (e) => {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    setDragging(false)
    const dy = e.clientY - d.y
    const speed = dy / Math.max(1, Date.now() - d.t)
    if (dy > DRAG_CLOSE || speed > FLICK_CLOSE) {
      closePlayer()
    } else {
      setDragY(0)
    }
  }
  useEffect(() => {
    if (open) setDragY(0)
  }, [open])

  const model = modelOf(look)
  return (
    <>
      {!open && (
        <ScreenStrip
          audio={audio}
          controls={controls}
          look={look}
          onOpen={openPlayer}
          onActions={setActionsItem}
        />
      )}
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <div
          className={classes.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label={translate('player.mobile.ipod')}
          data-skin={look.id}
          data-backlight={lit ? 'on' : 'off'}
          style={lcdVars(screenOf(look.lcd, lit))}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {audio.item.cover && (
            <div
              className={classes.blur}
              style={{
                backgroundImage: `url("${audio.item.cover}")`,
                opacity: 1 - Math.min(0.8, dragY / 500),
              }}
              aria-hidden
            />
          )}
          <div
            className={classes.device}
            data-testid="ipod"
            style={{
              '--ratio': `${model.w} / ${model.h}`,
              transform: dragY ? `translateY(${dragY}px)` : undefined,
              transition: dragging ? 'none' : 'transform 220ms ease-out',
            }}
          >
            <IpodBody skin={look} lit={lit} className={classes.body} />
            <div className={classes.lcd} style={percentBox(model, model.lcd)}>
              <IpodScreen
                audio={audio}
                art={!look.lcd.mono}
                mono={!!look.lcd.mono}
                album={!look.lcd.noAlbum}
                coverLook={look.lcd.cover}
                controls={controls}
                scrubTime={scrubTime}
                mode={mode}
                volumeLocked={!!volumeLocked.current}
                view={view}
                menu={nav}
                onActions={setActionsItem}
                upNext={{
                  highlight,
                  onPlay: playFromList,
                  onMove: moveInList,
                  onRemove: removeFromList,
                  onLongPress: (index) => setActionsItem(audio.queue[index]),
                }}
              />
              <div className={classes.bulbs} />
              <div className={classes.backlight} />
              <div className={classes.glare} />
            </div>
            <ClickWheel
              skin={look}
              onMenu={onMenu}
              onMenuHold={look.lcd.mono ? toggleBacklight : undefined}
              onPrev={controls.prev}
              onNext={controls.next}
              onPlay={controls.togglePlay}
              onCenter={onCenter}
              step={view === 'nowPlaying' ? SCRUB_STEP : LIST_STEP}
              onTurnStart={startScrub}
              onTurn={scrub}
              onTurnEnd={endScrub}
            />
          </div>
        </div>
      </Slide>
      <PlayerActions
        item={actionsItem}
        onClose={() => setActionsItem(null)}
        onLeave={leavePlayer}
      />
      <Snackbar
        open={!!removed}
        autoHideDuration={UNDO_MS}
        onClose={(e, reason) => reason !== 'clickaway' && setRemoved(null)}
        message={translate('player.mobile.removed', {
          name: removed?.item.song?.title || removed?.item.name || '',
        })}
        action={
          removed?.item.song?.id && (
            <Button color="secondary" size="small" onClick={undoRemove}>
              {translate('player.mobile.undo')}
            </Button>
          )
        }
      />
    </>
  )
}
