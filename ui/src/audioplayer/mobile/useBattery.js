import { useEffect, useState } from 'react'

// The phone's battery, for the iPod's battery icon: its level (0 to 1) and whether it is charging,
// kept up to date. Through the Battery Status API, which Chrome on Android has. Safari, and so every
// iPhone browser, keeps the battery to itself: there it is null
export const useBattery = () => {
  const [battery, setBattery] = useState(null)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.getBattery) {
      return undefined
    }
    let manager = null
    let cancelled = false
    const update = () => {
      if (!cancelled && manager) {
        setBattery({ level: manager.level, charging: manager.charging })
      }
    }
    navigator
      .getBattery()
      .then((b) => {
        manager = b
        update()
        b.addEventListener('levelchange', update)
        b.addEventListener('chargingchange', update)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      manager?.removeEventListener('levelchange', update)
      manager?.removeEventListener('chargingchange', update)
    }
  }, [])
  return battery
}
