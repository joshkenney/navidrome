import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'

// Songs played this far (in percent) are added to the user's "Replay" playlist
export const REPLAY_THRESHOLD = 85

export const addToReplay = (trackId) =>
  httpClient(`${REST_URL}/replay/${encodeURIComponent(trackId)}`, {
    method: 'POST',
  }).catch(() => {})
