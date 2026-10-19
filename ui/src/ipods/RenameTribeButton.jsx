import React, { useState } from 'react'
import { useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Dialog,
  DialogActions,
  IconButton,
  TextField,
  Tooltip,
} from '@material-ui/core'
import EditIcon from '@material-ui/icons/Edit'
import { DialogTitle } from '../dialogs/DialogTitle'
import { DialogContent } from '../dialogs/DialogContent'
import { httpClient } from '../dataProvider'

const saveName = (tribe, name) =>
  httpClient('/api/ipods/tribes/name', {
    method: 'PUT',
    body: JSON.stringify({ name, ipods: tribe.ipods }),
  })

// Lets admins give a tribe a name. The server keeps it while the tribe keeps most of its iPods
export const RenameTribeButton = ({ tribe, onRenamed }) => {
  const translate = useTranslate()
  const notify = useNotify()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(tribe.name)

  const save = async (newName) => {
    try {
      await saveName(tribe, newName)
      setOpen(false)
      onRenamed()
    } catch (e) {
      notify('ra.page.error', 'warning')
    }
  }

  return (
    <>
      <Tooltip title={translate('ipods.tribes.rename')}>
        <IconButton
          size="small"
          aria-label={translate('ipods.tribes.rename')}
          onClick={() => {
            setName(tribe.name)
            setOpen(true)
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle onClose={() => setOpen(false)}>
          {translate('ipods.tribes.renameTitle', { name: tribe.name })}
        </DialogTitle>
        <DialogContent>
          <TextField
            id="tribe-name"
            autoFocus
            fullWidth
            label={translate('ipods.tribes.newName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && save(name)}
          />
        </DialogContent>
        <DialogActions>
          {tribe.custom && (
            <Button onClick={() => save('')}>
              {translate('ipods.tribes.reset')}
            </Button>
          )}
          <Button
            color="primary"
            variant="contained"
            disabled={!name.trim()}
            onClick={() => save(name)}
          >
            {translate('ipods.tribes.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
