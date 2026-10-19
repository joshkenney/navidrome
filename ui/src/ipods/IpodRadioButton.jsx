import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNotify, useTranslate } from 'react-admin'
import {
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Slider,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaRadio } from 'react-icons/fa6'
import {
  getAdventure,
  playIpodRadio,
  saveAdventure,
  stopRadioSession,
  useRadioReason,
  useRadioSession,
  useRadioStarting,
  SURPRISE,
} from './radio'

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  // While a radio plays, the icon stays still, with a blinking red "REC" dot
  '@keyframes recBlink': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.15 },
  },
  active: {
    color: 'inherit',
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 7,
      right: 7,
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: '#e53935',
      boxShadow: '0 0 4px #e53935',
      animation: '$recBlink 1.2s steps(2, jump-none) infinite',
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    },
  },
  paper: {
    padding: theme.spacing(2),
    width: 300,
    maxWidth: 'calc(100vw - 32px)',
  },
  section: { marginTop: theme.spacing(2) },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  sliderLabels: { display: 'flex', justifyContent: 'space-between' },
}))

export const IpodRadioButton = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const session = useRadioSession()
  const reasonText = useRadioReason()
  const current = useSelector((state) => state.player?.current)
  const [anchorEl, setAnchorEl] = useState(null)
  const [adventure, setAdventure] = useState(getAdventure)
  const [loading, setLoading] = useState(false)
  // A radio started from anywhere (this popover, the song menu, the iPod Radio page)
  const starting = useRadioStarting()
  const t = (key, opts) => translate(`ipods.radio.${key}`, opts)
  const currentTrackId = current?.isRadio ? null : current?.trackId

  const start = async (options) => {
    setLoading(true)
    try {
      await playIpodRadio(dispatch, notify, { adventure, ...options })
      setAnchorEl(null)
    } catch (e) {
      notify('ra.page.error', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const currentReason =
    session && currentTrackId && reasonText(session.reasons?.[currentTrackId])

  return (
    <>
      <Tooltip title={t('title')}>
        <IconButton
          className={session ? classes.active : classes.button}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label={t('title')}
          aria-haspopup="true"
          aria-pressed={!!session}
          data-playing={session ? 'true' : undefined}
        >
          {starting ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <FaRadio size={18} />
          )}
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Paper className={classes.paper}>
          <Typography variant="subtitle1">{t('title')}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t('help')}
          </Typography>

          {session && (
            <div className={classes.section}>
              <Typography variant="body2">
                {t('playingFrom', {
                  title: session.seed.title,
                  artist: session.seed.artist,
                })}
              </Typography>
              {currentReason && (
                <Typography variant="body2" color="textSecondary">
                  {t('why', { reason: currentReason })}
                </Typography>
              )}
            </div>
          )}

          <div className={classes.section}>
            <Typography variant="body2" id="ipod-radio-adventure">
              {t('adventure')}
            </Typography>
            <Slider
              value={adventure}
              min={-1}
              max={1}
              step={0.1}
              onChange={(_, value) => setAdventure(value)}
              onChangeCommitted={(_, value) => saveAdventure(value)}
              aria-labelledby="ipod-radio-adventure"
            />
            <div className={classes.sliderLabels}>
              <Typography variant="caption">{t('mainstream')}</Typography>
              <Typography variant="caption">{t('deepCuts')}</Typography>
            </div>
          </div>

          <div className={classes.actions}>
            <Button
              variant="contained"
              color="primary"
              disabled={!currentTrackId || loading}
              startIcon={
                starting && starting === currentTrackId ? (
                  <CircularProgress size={14} color="inherit" />
                ) : null
              }
              onClick={() =>
                start({ songId: currentTrackId, keepPlaying: true })
              }
            >
              {t('startCurrent')}
            </Button>
            <Button
              variant="outlined"
              disabled={loading}
              startIcon={
                starting === SURPRISE ? (
                  <CircularProgress size={14} color="inherit" />
                ) : null
              }
              onClick={() => start({})}
            >
              {t('surprise')}
            </Button>
            {session && <Button onClick={stopRadioSession}>{t('stop')}</Button>}
          </div>
        </Paper>
      </Popover>
    </>
  )
}
