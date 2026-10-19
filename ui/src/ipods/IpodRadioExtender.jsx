import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { extendRadio, stopRadioSession, useRadioSession } from './radio'

// Fewer songs than this left in the queue, and the radio queues the next batch
export const RADIO_REFILL_AT = 3

// Keeps iPod Radio going: queues more songs when the queue is about to run out, and ends the
// radio when the queue is replaced or cleared
export const IpodRadioExtender = () => {
  const dispatch = useDispatch()
  const queue = useSelector((state) => state.player?.queue || [])
  const current = useSelector((state) => state.player?.current)
  const session = useRadioSession()
  const fetching = useRef(false)

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
