import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  Link,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { DialogTitle } from './DialogTitle'
import { DialogContent } from './DialogContent'
import sadIpod from '../icons/sad-ipod.webp'

const CONTACT_EMAIL = 'josh@ipodrepair.nyc'

// Fired on window when the dialog is closed, so other popups can wait for it
export const WELCOME_CLOSED_EVENT = 'welcome-dialog-closed'

const useStyles = makeStyles((theme) => ({
  content: {
    textAlign: 'center',
  },
  image: {
    width: 120,
    height: 'auto',
    imageRendering: 'pixelated',
    marginBottom: theme.spacing(2),
  },
  text: {
    marginBottom: theme.spacing(1.5),
  },
}))

export const WELCOME_TITLE = 'Welcome to the iPod Repair NYC community!'

// The sad iPod and the welcome text, also shown by the tour's first step
export const WelcomeContent = () => {
  const classes = useStyles()
  return (
    <div className={classes.content}>
      <img src={sadIpod} alt="Sad iPod" className={classes.image} />
      <Typography className={classes.text}>
        This collection is made up of real iPods. Each iPod is the music someone
        carried around in their pocket.
      </Typography>
      <Typography>
        If you would like to contribute your iPod&apos;s collection, email{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </Typography>
    </div>
  )
}

// Shown once after each successful login (flag set by authProvider.login)
export const WelcomeDialog = () => {
  const [open, setOpen] = useState(
    () => localStorage.getItem('show-welcome') === 'true',
  )

  const handleClose = () => {
    localStorage.removeItem('show-welcome')
    setOpen(false)
    window.dispatchEvent(new Event(WELCOME_CLOSED_EVENT))
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle onClose={handleClose}>{WELCOME_TITLE}</DialogTitle>
      <DialogContent dividers>
        <WelcomeContent />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="contained">
          Start listening
        </Button>
      </DialogActions>
    </Dialog>
  )
}
