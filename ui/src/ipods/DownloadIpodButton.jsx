import React, { useState } from 'react'
import { useTranslate } from 'react-admin'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContentText,
  IconButton,
  Tooltip,
} from '@material-ui/core'
import CloudDownloadOutlinedIcon from '@material-ui/icons/CloudDownloadOutlined'
import { DialogTitle } from '../dialogs/DialogTitle'
import { DialogContent } from '../dialogs/DialogContent'
import subsonic from '../subsonic'
import config from '../config'

// Downloads all the songs of an iPod as one zip, after a confirmation: it can be very large
export const DownloadIpodButton = ({ libraryId, name, variant = 'icon' }) => {
  const translate = useTranslate()
  const [open, setOpen] = useState(false)
  if (!config.enableDownloads || libraryId == null) return null

  const label = translate('ipods.download.button')
  const handleDownload = () => {
    setOpen(false)
    subsonic.download(`ipod-${libraryId}`)
  }

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title={label}>
          <IconButton
            size="small"
            aria-label={label}
            onClick={() => setOpen(true)}
          >
            <CloudDownloadOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          size="small"
          startIcon={<CloudDownloadOutlinedIcon />}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs">
        <DialogTitle onClose={() => setOpen(false)}>
          {translate('ipods.download.title', { name })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('ipods.download.warning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            {translate('ra.action.cancel')}
          </Button>
          <Button color="primary" variant="contained" onClick={handleDownload}>
            {translate('ra.action.download')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
