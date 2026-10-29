import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import { useNotify } from 'react-admin'
import { setSelectedLibraries } from '../actions'
import { useSelectIpod } from '../ipods/useSelectIpod'
import { playAlbum, playSong } from './api'

// Returns how to open each kind of listening item: artists and albums show their page (adding the
// album's iPod to the selection), songs play, and iPods list their albums
export const useOpenItem = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const notify = useNotify()
  const selectIpod = useSelectIpod()
  const failed = useCallback(() => notify('ra.page.error', 'warning'), [notify])

  const open = useCallback(
    (kind, item) => {
      switch (kind) {
        case 'artist':
          return history.push(`/artist/${item.id}/show`)
        case 'album':
          selectIpod(item.libraryId, item.libraryName)
          return history.push(`/album/${item.albumId || item.id}/show`)
        case 'song':
          selectIpod(item.libraryId, item.libraryName)
          return playSong(dispatch, item.id).catch(failed)
        case 'ipod':
          dispatch(setSelectedLibraries([Number(item.libraryId || item.id)]))
          return history.push('/album')
        default:
          return null
      }
    },
    [dispatch, history, selectIpod, failed],
  )

  const play = useCallback(
    (kind, item) => {
      selectIpod(item.libraryId, item.libraryName)
      const p =
        kind === 'album'
          ? playAlbum(dispatch, item.albumId || item.id)
          : playSong(dispatch, item.id)
      return p.catch(failed)
    },
    [dispatch, selectIpod, failed],
  )

  return { open, play }
}
