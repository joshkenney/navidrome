import React from 'react'
import { Button, useTranslate, useUnselectAll } from 'react-admin'
import CloudDownloadOutlinedIcon from '@material-ui/icons/CloudDownloadOutlined'
import subsonic from '../subsonic'

// Downloads the selected songs: one song as its own file, several as one zip
export const BatchDownloadButton = ({ resource, selectedIds, className }) => {
  const translate = useTranslate()
  const unselectAll = useUnselectAll()

  const download = () => {
    subsonic.download(selectedIds)
    unselectAll(resource)
  }

  const caption = translate('resources.song.actions.downloadSelected', {
    smart_count: selectedIds.length,
  })
  return (
    <Button
      aria-label={caption}
      onClick={download}
      label={caption}
      className={className}
    >
      <CloudDownloadOutlinedIcon />
    </Button>
  )
}
