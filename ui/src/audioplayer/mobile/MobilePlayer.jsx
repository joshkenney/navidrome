import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslate } from 'react-admin'
import { Button, Slide, Snackbar } from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { ScreenStrip } from './ScreenStrip'
import { IpodScreen } from './IpodScreen'
import { ClickWheel } from './ClickWheel'
import { useAudioState } from './useAudioState'
import { edition } from './ipodLook'
import { addTracks } from '../../actions'

// How far down a swipe on the screen goes to close the player
const SWIPE_CLOSE = 60
// Turning the click wheel scrubs this many seconds per click: a whole turn (60 clicks) is a minute
const SECONDS_PER_CLICK = 1
// Degrees of a wheel click: fine for scrubbing, coarser for moving through the queue
const SCRUB_STEP = 6
const LIST_STEP = 24
// How long the "removed" notice (and its Undo) stays
const UNDO_MS = 5000

const useStyles = makeStyles(
  (theme) => ({
    ipod: {
      position: 'fixed',
      inset: 0,
      // Above the app bar and the sidebar, below dialogs (download, save queue), the tour and
      // notifications, which the player can open
      zIndex: theme.zIndex.modal - 1,
      background: (p) => p.look.case,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      boxSizing: 'border-box',
      padding:
        'calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)',
      gap: 16,
      overflow: 'hidden',
    },
    screen: { flex: '0 1 auto', minHeight: 0, touchAction: 'pan-y' },
    wheelArea: {
      flex: '1 1 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 0,
    },
  }),
  { name: 'NDMobilePlayer' },
)

// The player on phones: a strip of iPod screen at the bottom of the page, which opens into a whole
// iPod, with its screen and click wheel. The music player underneath still plays the music: this
// only drives it (see playerControls)
export const MobilePlayer = ({ audioInstance, controls }) => {
  const theme = useTheme()
  const look = edition(theme)
  const classes = useStyles({ look })
  const translate = useTranslate()
  const audio = useAudioState(audioInstance)
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const swipe = useRef(null)
  // "nowPlaying" or "upNext", and the song of the queue the wheel is on in Up Next
  const [view, setView] = useState('nowPlaying')
  const [highlight, setHighlight] = useState(0)
  // The song last removed from Up Next, which Undo puts back
  const [removed, setRemoved] = useState(null)
  const undoRef = useRef(null)
  // Where the wheel is scrubbing to, shown on the screen until the finger lifts and it seeks there
  const [scrubTime, setScrubTime] = useState(null)
  const scrubRef = useRef(null)
  const scrubbable = !audio.isRadio && audio.duration > 0

  const startScrub = () => {
    if (view !== 'nowPlaying' || !scrubbable) return
    scrubRef.current = audio.currentTime
    setScrubTime(audio.currentTime)
  }
  const scrub = (clicks) => {
    if (view === 'upNext') {
      const last = audio.queue.length - 1
      setHighlight((h) => Math.max(0, Math.min(last, h + clicks)))
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
    if (scrubRef.current !== null) controls.seek(scrubRef.current)
    scrubRef.current = null
    setScrubTime(null)
  }

  // The centre button opens Up Next on the song playing, and there plays the highlighted song
  const showNowPlaying = () => setView('nowPlaying')
  const onCenter = () => {
    if (view === 'upNext') {
      if (highlight !== audio.index) controls.playAt(highlight)
      showNowPlaying()
    } else {
      setHighlight(audio.index)
      setView('upNext')
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

  // MENU goes back from Up Next, and closes the player from Now Playing
  const onMenu = () => (view === 'upNext' ? showNowPlaying() : closePlayer())

  // Opening adds a history entry, so the phone's Back button closes the player
  const openPlayer = useCallback(() => {
    setView('nowPlaying')
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

  // A swipe down on the Now Playing screen closes the player (Up Next scrolls instead)
  const onScreenPointerDown = (e) => {
    swipe.current =
      view === 'nowPlaying' ? { x: e.clientX, y: e.clientY } : null
  }
  const onScreenPointerUp = (e) => {
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (dy > SWIPE_CLOSE && dy > Math.abs(dx)) closePlayer()
  }

  return (
    <>
      {!open && (
        <ScreenStrip
          audio={audio}
          controls={controls}
          look={look}
          onOpen={openPlayer}
        />
      )}
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <div
          className={classes.ipod}
          role="dialog"
          aria-modal="true"
          aria-label={translate('player.mobile.nowPlaying')}
        >
          <div
            className={classes.screen}
            onPointerDown={onScreenPointerDown}
            onPointerUp={onScreenPointerUp}
            onPointerCancel={() => (swipe.current = null)}
          >
            <IpodScreen
              audio={audio}
              controls={controls}
              scrubTime={scrubTime}
              view={view}
              upNext={{
                highlight,
                onPlay: playFromList,
                onMove: moveInList,
                onRemove: removeFromList,
              }}
            />
          </div>
          <div className={classes.wheelArea}>
            <ClickWheel
              look={look}
              onMenu={onMenu}
              onPrev={controls.prev}
              onNext={controls.next}
              onPlay={controls.togglePlay}
              onCenter={onCenter}
              step={view === 'upNext' ? LIST_STEP : SCRUB_STEP}
              onTurnStart={startScrub}
              onTurn={scrub}
              onTurnEnd={endScrub}
            />
          </div>
        </div>
      </Slide>
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
