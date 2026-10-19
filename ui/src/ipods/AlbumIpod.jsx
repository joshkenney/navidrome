import React from 'react'
import { Link as MuiLink, Typography } from '@material-ui/core'
import { IpodLabel } from './IpodLabel'
import { useBrowseIpod } from './useBrowseIpod'
import { DownloadIpodButton } from './DownloadIpodButton'
import { useIpodName } from './useIpodName'

const noop = () => {}

// The iPod an album comes from, with links to browse it or download it whole
export const AlbumIpod = ({ record, className }) => {
  const browseIpod = useBrowseIpod(noop)
  const name = useIpodName(record?.libraryId, record?.libraryName)
  if (!name) return null
  return (
    <Typography component="div" className={className}>
      <MuiLink
        component="button"
        variant="body1"
        color="inherit"
        underline="hover"
        onClick={() => browseIpod(record.libraryId)}
      >
        <IpodLabel libraryName={name} size={16} />
      </MuiLink>{' '}
      <DownloadIpodButton libraryId={record.libraryId} name={name} />
    </Typography>
  )
}
