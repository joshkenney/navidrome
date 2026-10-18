import React, { useEffect, useState } from 'react'
import { useTranslate } from 'react-admin'
import {
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Popper,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaLightbulb, FaRegCirclePlay } from 'react-icons/fa6'
import { IpodIcon } from '../ipods/IpodIcon'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'

export const HIDE_TIPS_KEY = 'hide-feature-tips'
// Dismissing without "don't show again" only hides the tips until the next visit
export const TIPS_DISMISSED_KEY = 'feature-tips-dismissed'

const useStyles = makeStyles((theme) => ({
  popper: { zIndex: theme.zIndex.modal - 1 },
  paper: {
    width: 320,
    maxWidth: 'calc(100vw - 32px)',
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  tip: {
    display: 'flex',
    gap: theme.spacing(1.5),
    alignItems: 'flex-start',
    marginTop: theme.spacing(1.5),
  },
  tipIcon: { flexShrink: 0, marginTop: 2 },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1.5),
  },
}))

const readFlag = (storage, key) => {
  try {
    return storage.getItem(key) === 'true'
  } catch (e) {
    return false
  }
}

const writeFlag = (storage, key) => {
  try {
    storage.setItem(key, 'true')
  } catch (e) {
    // Storage unavailable (e.g. private mode): the tips will show again next time
  }
}

const shouldShow = () =>
  !readFlag(localStorage, HIDE_TIPS_KEY) &&
  !readFlag(sessionStorage, TIPS_DISMISSED_KEY)

// Points out the new header features, under the header icons (anchorEl)
export const FeatureTips = ({ anchorEl, showNowPlaying }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const [open, setOpen] = useState(shouldShow)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  // Wait for the welcome dialog to be closed, so they don't show on top of each other
  const [welcomeOpen, setWelcomeOpen] = useState(() =>
    readFlag(localStorage, 'show-welcome'),
  )

  useEffect(() => {
    const onWelcomeClosed = () => setWelcomeOpen(false)
    window.addEventListener(WELCOME_CLOSED_EVENT, onWelcomeClosed)
    return () =>
      window.removeEventListener(WELCOME_CLOSED_EVENT, onWelcomeClosed)
  }, [])

  const handleClose = () => {
    writeFlag(
      dontShowAgain ? localStorage : sessionStorage,
      dontShowAgain ? HIDE_TIPS_KEY : TIPS_DISMISSED_KEY,
    )
    setOpen(false)
  }

  const t = (key) => translate(`featureTips.${key}`)
  const tips = [
    { key: 'facts', icon: <FaLightbulb size={18} /> },
    { key: 'ipods', icon: <IpodIcon size={20} /> },
    showNowPlaying && {
      key: 'nowPlaying',
      icon: <FaRegCirclePlay size={18} />,
    },
  ].filter(Boolean)

  return (
    <Popper
      open={open && !welcomeOpen && !!anchorEl}
      anchorEl={anchorEl}
      placement="bottom-end"
      className={classes.popper}
    >
      <Paper elevation={8} className={classes.paper} role="dialog">
        <Typography variant="subtitle1">{t('title')}</Typography>
        {tips.map((tip) => (
          <div key={tip.key} className={classes.tip}>
            <span className={classes.tipIcon}>{tip.icon}</span>
            <div>
              <Typography variant="body2" style={{ fontWeight: 600 }}>
                {t(`${tip.key}.title`)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t(`${tip.key}.description`)}
              </Typography>
            </div>
          </div>
        ))}
        <div className={classes.actions}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">{t('dontShowAgain')}</Typography>
            }
          />
          <Button color="primary" variant="contained" onClick={handleClose}>
            {t('gotIt')}
          </Button>
        </div>
      </Paper>
    </Popper>
  )
}
