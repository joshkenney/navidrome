import React, { Fragment, useEffect } from 'react'
import {
  BulkDeleteButton,
  useListContext,
  useUnselectAll,
  ResourceContextProvider,
} from 'react-admin'
import { MdOutlinePlaylistRemove } from 'react-icons/md'
import PropTypes from 'prop-types'
import { BatchDownloadButton } from '../common/BatchDownloadButton'
import config from '../config'

// Replace original resource with "fake" one for removing tracks from playlist
const PlaylistSongBulkActions = ({
  playlistId,
  resource,
  onUnselectItems,
  ...rest
}) => {
  const unselectAll = useUnselectAll()
  const { data } = useListContext()
  useEffect(() => {
    unselectAll('playlistTrack')
  }, [unselectAll])

  const mappedResource = `playlist/${playlistId}/tracks`
  // The selection holds playlist entries: download the songs they point to
  const songIds = (rest.selectedIds || [])
    .map((id) => data?.[id]?.mediaFileId)
    .filter(Boolean)
  return (
    <ResourceContextProvider value={mappedResource}>
      <Fragment>
        {config.enableDownloads && songIds.length > 0 && (
          <BatchDownloadButton resource="playlistTrack" selectedIds={songIds} />
        )}
        <BulkDeleteButton
          {...rest}
          label={'ra.action.remove'}
          icon={<MdOutlinePlaylistRemove />}
          resource={mappedResource}
          onClick={onUnselectItems}
        />
      </Fragment>
    </ResourceContextProvider>
  )
}

PlaylistSongBulkActions.propTypes = {
  playlistId: PropTypes.string.isRequired,
}

export default PlaylistSongBulkActions
