import React from 'react'
import { IpodIcon } from './IpodIcon'
import { useIpodName } from './useIpodName'

// The iPod a song comes from, with the iPod logo before its name
export const IpodLabel = ({ libraryId, libraryName, className, size = 12 }) => {
  const name = useIpodName(libraryId, libraryName)
  if (!name) return null
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      <IpodIcon size={size} />
      <span className="ipodName">{name}</span>
    </span>
  )
}
