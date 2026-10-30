import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import { Slide } from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { ScreenStrip } from './ScreenStrip'
import { IpodScreen } from './IpodScreen'
import { ClickWheel } from './ClickWheel'
import { useAudioState } from './useAudioState'
import { edition } from './ipodLook'

// How far down a swipe on the screen goes to close the player
const SWIPE_CLOSE = 60

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
  const [open, setOpen] = useState(false)
  const swipe = useRef(null)

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

  // A swipe down on the screen closes the player
  const onScreenPointerDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY }
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
            <IpodScreen audio={audio} controls={controls} />
          </div>
          <div className={classes.wheelArea}>
            <ClickWheel
              look={look}
              onMenu={closePlayer}
              onPrev={controls.prev}
              onNext={controls.next}
              onPlay={controls.togglePlay}
            />
          </div>
        </div>
      </Slide>
    </>
  )
}
