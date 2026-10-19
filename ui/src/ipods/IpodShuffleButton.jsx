import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useDataProvider, useNotify, useTranslate } from 'react-admin'
import { CircularProgress, IconButton, Tooltip } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaShuffle } from 'react-icons/fa6'
import { playTracks } from '../actions'

const SHUFFLE_SIZE = 500

const useStyles = makeStyles({ button: { color: 'inherit' } })

// Plays a random mix of songs from the iPods picked in the iPod selector, or from all iPods. The
// dataProvider applies the selection to the song list
export const IpodShuffleButton = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const [loading, setLoading] = useState(false)
  const { userLibraries = [], selectedLibraries = [] } = useSelector(
    (state) => state.library || {},
  )

  const selected = userLibraries.filter((lib) =>
    selectedLibraries.includes(lib.id),
  )
  const all = selected.length === 0 || selected.length === userLibraries.length
  const title = all
    ? translate('ipods.shuffle.all')
    : selected.length === 1
      ? translate('ipods.shuffle.one', { name: selected[0].name })
      : translate('ipods.shuffle.some', { smart_count: selected.length })

  const handleClick = async () => {
    setLoading(true)
    try {
      const { data } = await dataProvider.getList('song', {
        pagination: { page: 1, perPage: SHUFFLE_SIZE },
        sort: { field: 'random', order: 'ASC' },
        filter: { missing: false },
      })
      if (!data.length) {
        notify('ipods.shuffle.empty', 'warning')
        return
      }
      const songs = Object.fromEntries(data.map((song) => [song.id, song]))
      dispatch(
        playTracks(
          songs,
          data.map((song) => song.id),
        ),
      )
    } catch (e) {
      notify('ra.page.error', 'warning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          className={classes.button}
          onClick={handleClick}
          disabled={loading}
          aria-label={title}
        >
          {loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <FaShuffle size={18} />
          )}
        </IconButton>
      </span>
    </Tooltip>
  )
}
