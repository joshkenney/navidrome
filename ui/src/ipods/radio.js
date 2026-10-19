import { useEffect, useState } from 'react'
import { useTranslate } from 'react-admin'
import { httpClient } from '../dataProvider'
import { addTracks, playNext, playTracks } from '../actions'
import { processSongsForPlayback } from '../common/playbackActions'

const ADVENTURE_KEY = 'ipod-radio-adventure'
export const RADIO_BATCH = 10
const MAX_EXCLUDE = 500
const MAX_REACTIONS = 20
const MAX_DRIFT = 3

// The current radio session: its seed song, the "Mainstream - Deep cuts" setting, the tracks it
// added to the queue and why each one was picked. Kept outside Redux, as it is not persisted
let session = null
const listeners = new Set()

const emit = () => listeners.forEach((listener) => listener(session))

export const getRadioSession = () => session

export const startRadioSession = (data) => {
  session = {
    ...data,
    trackIds: new Set(data.trackIds),
    reasons: data.reasons,
    listened: [],
    skipped: [],
  }
  progress.clear()
  emit()
}

// How far each radio song was played, to tell listened-through songs from skipped ones
const progress = new Map()

export const noteRadioProgress = (trackId, currentTime, duration) => {
  if (session?.trackIds.has(trackId)) {
    progress.set(trackId, { currentTime, duration })
  }
}

// A song played (almost) to the end was liked; one left within 30 seconds, before its middle,
// was skipped
export const classifyListen = ({ currentTime = 0, duration = 0 } = {}) => {
  const played = duration > 0 ? currentTime / duration : 0
  if (played >= 0.7) return 'listened'
  if (currentTime < 30 && played < 0.5) return 'skipped'
  return 'neutral'
}

// Records how a radio song was received, once the player moved on from it
export const recordRadioListen = (trackId) => {
  if (!session?.trackIds.has(trackId)) return
  const kind = classifyListen(progress.get(trackId))
  progress.delete(trackId)
  if (kind === 'neutral') return
  const without = (list) => list.filter((id) => id !== trackId)
  session = {
    ...session,
    listened:
      kind === 'listened'
        ? [...without(session.listened), trackId]
        : without(session.listened),
    skipped:
      kind === 'skipped'
        ? [...without(session.skipped), trackId]
        : without(session.skipped),
  }
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
  drift = [],
  liked = [],
  skipped = [],
  count = RADIO_BATCH,
}) => {
  const params = new URLSearchParams()
  if (songId) params.set('songId', songId)
  params.set('adventure', adventure)
  params.set('count', count)
  exclude.forEach((id) => params.append('exclude', id))
  drift.forEach((id) => params.append('drift', id))
  liked.forEach((id) => params.append('liked', id))
  skipped.forEach((id) => params.append('skipped', id))
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
  recordRadioHistory(seed, adventure, !songId)
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

// Adds a radio to the user's iPod Radio history. Failing to record it doesn't stop the radio
export const recordRadioHistory = (seed, adventure, surprise) =>
  httpClient('/api/ipods/radio/history', {
    method: 'POST',
    body: JSON.stringify({
      seedId: seed.id,
      title: seed.title,
      artist: seed.artist,
      album: seed.album,
      albumId: seed.albumId,
      libraryId: seed.libraryId,
      libraryName: seed.libraryName,
      adventure,
      surprise,
    }),
  }).catch(() => {})

// Appends the next radio songs to the queue. They follow the anchor song and drift towards the
// songs listened through lately, avoid skipped artists, and never repeat a song of the session
export const extendRadio = async (dispatch, queuedIds) => {
  const current = getRadioSession()
  if (!current) return
  const anchor = current.radioSeedId || current.seed.id
  const json = await fetchIpodRadio({
    songId: anchor,
    adventure: current.adventure,
    exclude: [...new Set([...current.trackIds, ...queuedIds])].slice(
      -MAX_EXCLUDE,
    ),
    drift: [...current.listened]
      .reverse()
      .filter((id) => id !== anchor && id !== current.seed.id)
      .slice(0, MAX_DRIFT),
    liked: current.listened.slice(-MAX_REACTIONS),
    skipped: current.skipped.slice(-MAX_REACTIONS),
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
