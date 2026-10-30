import React from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import SkipPreviousIcon from '@material-ui/icons/SkipPrevious'
import SkipNextIcon from '@material-ui/icons/SkipNext'
import { buzz } from './haptics'

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

// The iPod's click wheel: MENU, previous, next and play/pause around the ring, and the centre button
export const ClickWheel = ({
  look,
  onMenu,
  onPrev,
  onNext,
  onPlay,
  onCenter,
}) => {
  const classes = useStyles({ look })
  const translate = useTranslate()
  const t = (key) => translate(`player.mobile.${key}`)
  const press = (action) => () => {
    buzz()
    action?.()
  }

  return (
    <div className={classes.wheel} data-testid="click-wheel">
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
