import React from 'react'
import { useTranslate } from 'react-admin'
import { Button } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert'
import { formatBytes } from '../utils'
import { DOWNLOAD_MENU_SONG } from '../actions'
import { formatQuality } from './bestCopy'

// Recommends downloading the best copy, when one is better than what is being downloaded
export const BestCopyRecommendation = ({ best, onDownload }) => {
  const translate = useTranslate()
  if (!best) {
    return null
  }

  if (best.recordType === DOWNLOAD_MENU_SONG) {
    if (!best.best) {
      return null
    }
    return (
      <Alert
        severity="info"
        action={
          <Button
            color="primary"
            variant="contained"
            size="small"
            onClick={() => onDownload(best.best.id)}
          >
            {translate('message.bestCopyDownload')}
          </Button>
        }
      >
        {translate('message.bestCopyRecommended', {
          ipod: best.best.libraryName,
          best: formatQuality(best.best),
          current: formatQuality(best.current),
        })}
      </Alert>
    )
  }

  if (!best.added && !best.better) {
    return null
  }
  const ids = best.tracks.map((t) => t.id)
  return (
    <Alert
      severity="info"
      action={
        <Button
          color="primary"
          variant="contained"
          size="small"
          onClick={() => onDownload(ids)}
        >
          {translate('message.completeAlbumDownload', {
            smart_count: ids.length,
          })}
        </Button>
      }
    >
      {[
        translate('message.completeAlbumRecommended', {
          ipods: best.ipods.join(', '),
        }),
        best.added > 0 &&
          translate('message.completeAlbumAdded', { smart_count: best.added }),
        best.better > 0 &&
          translate('message.completeAlbumBetter', {
            smart_count: best.better,
          }),
        `(${formatBytes(best.size)})`,
      ]
        .filter(Boolean)
        .join(' ')}
    </Alert>
  )
}
