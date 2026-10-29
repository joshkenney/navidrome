import { refreshView } from 'react-admin'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'

// Songs played this far (in percent) are added to the user's "Replay" playlist
export const REPLAY_THRESHOLD = 85

// Tells whether the player is far enough into a song (not a radio stream) to add it to Replay
export const reachedReplay = (info) =>
  !info.isRadio &&
  !!info.trackId &&
  info.duration > 0 &&
  (info.currentTime / info.duration) * 100 >= REPLAY_THRESHOLD

const showing = (playlistId) =>
  `${window.location.pathname}${window.location.hash}`.includes(
    `/playlist/${playlistId}/`,
  )

// Adds a song to the user's Replay playlist. The server creates the playlist the first time:
// the page is then refreshed so it shows up in the menu, as it is when the Replay playlist itself
// is on screen and gets a new song
export const addToReplay = (dispatch, trackId) =>
  httpClient(`${REST_URL}/replay/${encodeURIComponent(trackId)}`, {
    method: 'POST',
  })
    .then(({ json }) => {
      if (json?.created || (json?.added && showing(json.playlistId))) {
        dispatch(refreshView())
      }
    })
    .catch(() => {})
