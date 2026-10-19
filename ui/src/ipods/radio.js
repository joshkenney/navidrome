import { useEffect, useState } from 'react'
import { useTranslate } from 'react-admin'
import { httpClient } from '../dataProvider'
import { addTracks, playNext, playTracks } from '../actions'
import { processSongsForPlayback } from '../common/playbackActions'

const ADVENTURE_KEY = 'ipod-radio-adventure'
export const RADIO_BATCH = 20

// The current radio session: its seed song, the "Mainstream - Deep cuts" setting, the tracks it
// added to the queue and why each one was picked. Kept outside Redux, as it is not persisted
let session = null
const listeners = new Set()

const emit = () => listeners.forEach((listener) => listener(session))

export const getRadioSession = () => session

export const startRadioSession = (data) => {
  session = { ...data, trackIds: new Set(data.trackIds), reasons: data.reasons }
  emit()
}

export const extendRadioSession = (ids, reasons) => {
  if (!session) return
  session = {
    ...session,
    trackIds: new Set([...session.trackIds, ...ids]),
    reasons: { ...session.reasons, ...reasons },
  }
  emit()
}

export const stopRadioSession = () => {
  session = null
  emit()
}

export const useRadioSession = () => {
  const [current, setCurrent] = useState(session)
  useEffect(() => {
    listeners.add(setCurrent)
    setCurrent(session)
    return () => listeners.delete(setCurrent)
  }, [])
  return current
}

export const getAdventure = () => {
  try {
    const value = parseFloat(localStorage.getItem(ADVENTURE_KEY))
    return Number.isFinite(value) ? value : 0
  } catch (e) {
    return 0
  }
}

export const saveAdventure = (value) => {
  try {
    localStorage.setItem(ADVENTURE_KEY, String(value))
  } catch (e) {
    // The setting just won't be remembered
  }
}

// Asks the server for radio songs. Without a songId, the server picks a random seed
export const fetchIpodRadio = async ({
  songId,
  adventure = 0,
  exclude = [],
  count = RADIO_BATCH,
}) => {
  const params = new URLSearchParams()
  if (songId) params.set('songId', songId)
  params.set('adventure', adventure)
  params.set('count', count)
  exclude.forEach((id) => params.append('exclude', id))
  const { status, json } = await httpClient(`/api/ipods/radio?${params}`)
  if (status === 204 || !json?.seed) return null
  return json
}

// Starts iPod Radio from a song (or a random one). With keepPlaying, the radio songs are queued
// after the song that is playing, instead of replacing the queue
export const playIpodRadio = async (
  dispatch,
  notify,
  { songId, adventure = getAdventure(), keepPlaying = false } = {},
) => {
  const json = await fetchIpodRadio({ songId, adventure })
  if (!json || !json.songs.length) {
    notify('ipods.radio.nothingFound', 'warning')
    return
  }
  const seed = json.seed
  const radioSeedId = json.radioSeedId || seed.id
  const others = json.songs.filter((s) => s.id !== seed.id)
  if (json.seedFallback) {
    notify('ipods.radio.standIn', 'info')
  }
  if (keepPlaying) {
    const { songData, ids } = processSongsForPlayback(others)
    dispatch(playNext(songData, ids))
    startRadioSession({
      seed,
      radioSeedId,
      adventure,
      trackIds: [seed.id, ...ids],
      reasons: json.reasons,
    })
  } else {
    const { songData, ids } = processSongsForPlayback([seed, ...others])
    dispatch(playTracks(songData, ids))
    startRadioSession({
      seed,
      radioSeedId,
      adventure,
      trackIds: ids,
      reasons: json.reasons,
    })
  }
}

// Appends the next radio songs to the queue
export const extendRadio = async (dispatch, queuedIds) => {
  const current = getRadioSession()
  if (!current) return
  const json = await fetchIpodRadio({
    songId: current.radioSeedId || current.seed.id,
    adventure: current.adventure,
    exclude: queuedIds,
  })
  const queued = new Set(queuedIds)
  const songs = (json?.songs || []).filter((s) => !queued.has(s.id))
  if (!songs.length || getRadioSession() !== current) return
  const { songData, ids } = processSongsForPlayback(songs)
  extendRadioSession(ids, json.reasons)
  dispatch(addTracks(songData, ids))
}

// Turns the reason a radio song was picked into text
export const useRadioReason = () => {
  const translate = useTranslate()
  return (reason) => {
    if (!reason) return null
    return translate(`ipods.radio.reasons.${reason.type}`, {
      smart_count: reason.count || 0,
      from: reason.from,
      artist: reason.artist,
    })
  }
}
