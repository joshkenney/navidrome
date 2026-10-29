import { useEffect, useState } from 'react'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'
import { DOWNLOAD_MENU_ALBUM, DOWNLOAD_MENU_SONG } from '../actions'

// "FLAC 24-bit/96 kHz" or "MP3 320 kbps"
export const formatQuality = (copy) => {
  const suffix = (copy.suffix || '').toUpperCase()
  if (copy.lossless) {
    const parts = []
    if (copy.bitDepth > 0) parts.push(`${copy.bitDepth}-bit`)
    if (copy.sampleRate > 0) parts.push(`${copy.sampleRate / 1000} kHz`)
    return parts.length ? `${suffix} ${parts.join('/')}` : suffix
  }
  return copy.bitRate > 0 ? `${suffix} ${copy.bitRate} kbps` : suffix
}

// Asks the server for a better copy of a song, or the complete album, on all the iPods
export const useBestCopy = (record, recordType) => {
  const [best, setBest] = useState(null)
  const id = record?.mediaFileId || record?.id
  useEffect(() => {
    setBest(null)
    const endpoint =
      recordType === DOWNLOAD_MENU_SONG
        ? 'best'
        : recordType === DOWNLOAD_MENU_ALBUM
          ? 'album'
          : null
    if (!id || !endpoint) {
      return
    }
    let cancelled = false
    httpClient(`${REST_URL}/ipods/${endpoint}?id=${encodeURIComponent(id)}`)
      .then(({ json }) => !cancelled && setBest({ recordType, ...json }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, recordType])
  return best
}
