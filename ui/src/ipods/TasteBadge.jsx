import React from 'react'
import { useTranslate } from 'react-admin'
import { Chip, Tooltip } from '@material-ui/core'

// Shows how niche (100) or mainstream (0) an iPod's or a listener's artists are
export const TasteBadge = ({ score, label, size = 'small' }) => {
  const translate = useTranslate()
  if (score == null || !label) return null
  return (
    <Tooltip title={translate('ipods.taste.help')}>
      <Chip
        size={size}
        variant="outlined"
        label={translate('ipods.taste.badge', {
          score,
          label: translate(`ipods.taste.labels.${label}`),
        })}
      />
    </Tooltip>
  )
}
