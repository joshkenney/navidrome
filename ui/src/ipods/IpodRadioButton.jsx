import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNotify, useTranslate } from 'react-admin'
import {
  Button,
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
} from './radio'

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  active: { color: theme.palette.secondary.main },
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
        >
          <FaRadio size={18} />
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
              onClick={() =>
                start({ songId: currentTrackId, keepPlaying: true })
              }
            >
              {t('startCurrent')}
            </Button>
            <Button
              variant="outlined"
              disabled={loading}
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
