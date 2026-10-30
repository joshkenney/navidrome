import React, { Fragment, useEffect, useState } from 'react'
import {
  Button,
  useDataProvider,
  useListContext,
  useNotify,
  useRefresh,
  useUnselectAll,
} from 'react-admin'
import { MdOutlinePlaylistRemove } from 'react-icons/md'
import PropTypes from 'prop-types'
import { BatchDownloadButton } from '../common/BatchDownloadButton'
import config from '../config'

// Removes the selected songs from the playlist right away. React-admin's own bulk delete waits
// for its "Undo" notification to close before telling the server, and can't hide the rows in the
// meantime (they are listed as "playlistTrack", removed as "playlist/<id>/tracks"): the songs
// stayed on screen for seconds, and were never removed when the page was left before that
export const RemoveFromPlaylistButton = ({
  playlistId,
  selectedIds,
  onRemoved,
}) => {
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const refresh = useRefresh()
  const unselectAll = useUnselectAll()
  const [removing, setRemoving] = useState(false)

  const remove = () => {
    setRemoving(true)
    dataProvider
      .deleteMany(`playlist/${playlistId}/tracks`, { ids: selectedIds })
      .then(() => {
        notify('resources.playlist.message.songsRemoved', {
          type: 'info',
          messageArgs: { smart_count: selectedIds.length },
        })
        unselectAll('playlistTrack')
        onRemoved?.()
        refresh()
      })
      .catch(() => notify('ra.notification.http_error', { type: 'warning' }))
      .finally(() => setRemoving(false))
  }

  return (
    <Button
      label="ra.action.remove"
      onClick={remove}
      disabled={removing || !selectedIds.length}
    >
      <MdOutlinePlaylistRemove />
    </Button>
  )
}

const PlaylistSongBulkActions = ({
  playlistId,
  onUnselectItems,
  readOnly,
  selectedIds = [],
}) => {
  const unselectAll = useUnselectAll()
  const { data } = useListContext()
  useEffect(() => {
    unselectAll('playlistTrack')
  }, [unselectAll])

  // The selection holds playlist entries: download the songs they point to
  const songIds = selectedIds
    .map((id) => data?.[id]?.mediaFileId)
    .filter(Boolean)
  return (
    <Fragment>
      {config.enableDownloads && songIds.length > 0 && (
        <BatchDownloadButton resource="playlistTrack" selectedIds={songIds} />
      )}
      {!readOnly && (
        <RemoveFromPlaylistButton
          playlistId={playlistId}
          selectedIds={selectedIds}
          onRemoved={onUnselectItems}
        />
      )}
    </Fragment>
  )
}

PlaylistSongBulkActions.propTypes = {
  playlistId: PropTypes.string.isRequired,
}

export default PlaylistSongBulkActions
