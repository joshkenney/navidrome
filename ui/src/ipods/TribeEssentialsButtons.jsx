import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useDataProvider, useNotify, useTranslate } from 'react-admin'
import { Button, CircularProgress } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaPlay } from 'react-icons/fa6'
import CloudDownloadOutlinedIcon from '@material-ui/icons/CloudDownloadOutlined'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'
import { playTracks } from '../actions'
import subsonic from '../subsonic'
import config from '../config'

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(1), display: 'flex', gap: theme.spacing(1) },
}))

const fetchEssentials = (tribe) =>
  httpClient(`${REST_URL}/ipods/tribes/${tribe.id}/essentials`).then(
    ({ json }) => json.songs || [],
  )

// Plays or downloads a tribe's Essentials: the songs most of its iPods have, and few others do
export const TribeEssentialsButtons = ({ tribe }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const [loading, setLoading] = useState(false)

  const withEssentials = (action) => async () => {
    setLoading(true)
    try {
      const ids = await fetchEssentials(tribe)
      if (!ids.length) {
        notify('ipods.tribes.essentialsEmpty', 'info')
        return
      }
      await action(ids)
    } catch (e) {
      notify('ra.page.error', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const play = withEssentials(async (ids) => {
    const { data } = await dataProvider.getMany('song', { ids })
    const songs = Object.fromEntries(data.map((song) => [song.id, song]))
    dispatch(
      playTracks(
        songs,
        ids.filter((id) => songs[id]),
      ),
    )
  })

  const download = withEssentials((ids) =>
    subsonic.download(
      ids,
      'raw',
      '0',
      translate('ipods.tribes.essentialsOf', { name: tribe.name }),
    ),
  )

  return (
    <div className={classes.root}>
      <Button
        size="small"
        variant="outlined"
        disabled={loading}
        onClick={play}
        startIcon={loading ? <CircularProgress size={14} /> : <FaPlay />}
      >
        {translate('ipods.tribes.essentials')}
      </Button>
      {config.enableDownloads && (
        <Button
          size="small"
          disabled={loading}
          onClick={download}
          startIcon={<CloudDownloadOutlinedIcon />}
          aria-label={translate('ipods.tribes.downloadEssentials')}
        >
          {translate('ra.action.download')}
        </Button>
      )}
    </div>
  )
}
