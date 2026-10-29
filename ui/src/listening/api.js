import httpClient from '../dataProvider/httpClient'
import { REST_URL } from '../consts'
import { playTracks } from '../actions'
import { processSongsForPlayback } from '../common/playbackActions'
import { tzOffset } from './dates'

export const PLAYS_PAGE = 50

// Arrays become one parameter per value
const query = (params) => {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) =>
    (Array.isArray(v) ? v : [v])
      .filter((x) => x !== undefined && x !== null && x !== '')
      .forEach((x) => q.append(k, x)),
  )
  return q.toString()
}

// A user's listening between two days (both included). Without days, all of it. "artists" and
// "ipods" (IDs) narrow the plays list
export const fetchTimeline = ({
  from,
  to,
  user,
  artists,
  ipods,
  start = 0,
  end = PLAYS_PAGE,
}) =>
  httpClient(
    `/api/listening/timeline?${query({ from, to, user, artist: artists, ipod: ipods, tz: tzOffset(), _start: start, _end: end })}`,
  ).then(({ json }) => json)


// The listeners whose timeline can be seen: the ones sharing their activity, and the current user
export const fetchListeners = () =>
  httpClient('/api/listening/users')
    .then(({ json }) => json || [])
    .catch(() => [])

// A play from the timeline, as the player wants a song
export const entryToSong = (e) => ({
  id: e.id,
  title: e.title,
  artist: e.artist,
  album: e.album,
  albumId: e.albumId,
  artistId: e.artistId,
  albumArtistId: e.albumArtistId,
  duration: e.duration,
  updatedAt: e.updatedAt,
  libraryId: e.libraryId,
  libraryName: e.libraryName,
})

// Plays timeline entries in order, each song once
export const playEntries = (dispatch, entries) => {
  const seen = new Set()
  const songs = entries
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map(entryToSong)
  if (!songs.length) return
  const { songData, ids } = processSongsForPlayback(songs)
  dispatch(playTracks(songData, ids))
}

const playSongs = (dispatch, songs) => {
  if (!songs?.length) return
  const { songData, ids } = processSongsForPlayback(songs)
  dispatch(playTracks(songData, ids))
}

export const playSong = (dispatch, id) =>
  httpClient(`${REST_URL}/song/${id}`).then(({ json }) =>
    playSongs(dispatch, [json]),
  )

// Plays an album, wherever the iPod selection is
export const playAlbum = (dispatch, albumId) =>
  httpClient(
    `${REST_URL}/song?${query({ album_id: albumId, _sort: 'album', _order: 'ASC', _start: 0, _end: 500 })}`,
  ).then(({ json }) => playSongs(dispatch, json))
