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

// Shown once after each successful login (flag set by authProvider.login)
export const WelcomeDialog = () => {
  const classes = useStyles()
  const [open, setOpen] = useState(
    () => localStorage.getItem('show-welcome') === 'true',
  )

  const handleClose = () => {
    localStorage.removeItem('show-welcome')
    setOpen(false)
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle onClose={handleClose}>
        Welcome to the iPod Repair NYC community!
      </DialogTitle>
      <DialogContent dividers className={classes.content}>
        <img src={sadIpod} alt="Sad iPod" className={classes.image} />
        <Typography className={classes.text}>
          This library is made up of collections from real iPods. Each library
          is the music someone carried around in their pocket.
        </Typography>
        <Typography>
          If you would like to contribute your iPod&apos;s collection, email{' '}
          <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="contained">
          Start listening
        </Button>
      </DialogActions>
    </Dialog>
  )
}
