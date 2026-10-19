import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  extendRadio,
  recordRadioListen,
  stopRadioSession,
  useRadioSession,
} from './radio'

// Fewer songs than this left in the queue, and the radio queues the next batch
export const RADIO_REFILL_AT = 3

// Keeps iPod Radio going: queues more songs when the queue is about to run out, notes which songs
// were listened to or skipped, and ends the radio when the queue is replaced or cleared
export const IpodRadioExtender = () => {
  const dispatch = useDispatch()
  const queue = useSelector((state) => state.player?.queue || [])
  const current = useSelector((state) => state.player?.current)
  const session = useRadioSession()
  const fetching = useRef(false)
  const previous = useRef(null)

  // When the player moves on to another song, note whether the last one was listened to or skipped
  useEffect(() => {
    const prev = previous.current
    if (prev && prev.uuid !== current?.uuid) {
      recordRadioListen(prev.trackId)
    }
    previous.current = current?.uuid ? current : null
  }, [current])

  useEffect(() => {
    if (!session) return
    const trackIds = queue.map((item) => item.trackId)
    if (!trackIds.some((id) => session.trackIds.has(id))) {
      stopRadioSession()
      return
    }
    const position = queue.findIndex((item) => item.uuid === current?.uuid)
    const remaining = queue.length - 1 - position
    if (position < 0 || remaining >= RADIO_REFILL_AT || fetching.current) {
      return
    }
    fetching.current = true
    extendRadio(dispatch, trackIds)
      .catch(() => {})
      .finally(() => {
        fetching.current = false
      })
  }, [queue, current, session, dispatch])

  return null
}
