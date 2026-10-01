import PropTypes from 'prop-types'
import React from 'react'
import { usePermissions, useRecordContext, useRedirect } from 'react-admin'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import config from '../config'

export const PathField = (props) => {
  const record = useRecordContext(props)
  const { permissions } = usePermissions()
  const redirect = useRedirect()
  let path = permissions === 'admin' ? record.libraryPath : ''

  if (path && path.endsWith(config.separator)) {
    path = `${path}${record.path}`
  } else {
    path = path ? `${path}${config.separator}${record.path}` : record.path
  }

  const hasFolderId = !!record.folderId
  const tooltipTitle = hasFolderId
    ? 'Browse folder'
    : 'Run a library scan to enable folder browsing'

  const handleBrowse = () => {
    if (hasFolderId) {
      redirect('show', '/folder', record.folderId)
    }
  }

  return (
    <span>
      {path}
      <Tooltip title={tooltipTitle}>
        <span>
          <IconButton
            size="small"
            onClick={handleBrowse}
            disabled={!hasFolderId}
            style={{ marginLeft: 4 }}
          >
            <FolderOpenIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </span>
  )
}

PathField.propTypes = {
  record: PropTypes.object,
}
