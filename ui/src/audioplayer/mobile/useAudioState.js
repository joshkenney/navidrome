import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

const AUDIO_EVENTS = [
  'timeupdate',
  'play',
  'playing',
  'pause',
  'waiting',
  'canplay',
  'loadedmetadata',
  'durationchange',
  'ended',
  'emptied',
  'volumechange',
]

const readAudio = (audio) => ({
  currentTime: audio?.currentTime || 0,
  duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
  playing: !!audio && !audio.paused,
  // Playing, but waiting for data
  loading: !!audio && !audio.paused && audio.readyState < 3,
  // As the player's volume bar has it (see playerControls)
  volume: audio ? Math.sqrt(audio.volume) : 1,
})

// The state of the song playing, for the phone player: where it is, from the <audio> element, and
// what it is, from the queue
export const useAudioState = (audio) => {
  const [state, setState] = useState(() => readAudio(audio))
  useEffect(() => {
    const update = () => setState(readAudio(audio))
    update()
    if (!audio) return undefined
    AUDIO_EVENTS.forEach((e) => audio.addEventListener(e, update))
    return () =>
      AUDIO_EVENTS.forEach((e) => audio.removeEventListener(e, update))
  }, [audio])

  const queue = useSelector((s) => s.player?.queue || [])
  const current = useSelector((s) => s.player?.current || {})
  const found = queue.findIndex((item) => item.uuid === current.uuid)
  const index = found >= 0 ? found : 0
  const item = queue[index] || {}
  return {
    ...state,
    queue,
    index,
    item,
    song: item.song || {},
    isRadio: !!item.isRadio,
  }
}
