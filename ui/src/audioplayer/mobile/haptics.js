// The click wheel's click, felt through the phone.
//
// Android: the Vibration API. Pulses shorter than about 10ms don't move most phones' motors, so a
// wheel click is 10ms, a button press 15ms and a long press 25ms.
//
// iPhone: Safari has no Vibration API, but since iOS 18 flipping a switch (<input type="checkbox"
// switch>) plays the system's light haptic, also when the switch is hidden and flipped from code
// during a touch. So on iPhones a hidden switch is flipped instead. Older iPhones can't vibrate
// from a web page at all.

import { click } from './clicks'

const PULSES = { tick: 10, press: 15, hold: 25 }
// The fastest the phone is asked to click: spinning the wheel fast makes many ticks
const MIN_GAP_MS = 30

let enabled = true
let last = 0
let iosSwitch = null

const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

// Whether the browser knows switch inputs (Safari 17.4+): elsewhere flipping one does nothing
const knowsSwitches = () => {
  if (typeof document === 'undefined') return false
  const input = document.createElement('input')
  input.type = 'checkbox'
  return 'switch' in input
}

const flipSwitch = () => {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label')
    iosSwitch.setAttribute('aria-hidden', 'true')
    iosSwitch.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    iosSwitch.appendChild(input)
    document.head.appendChild(iosSwitch)
  }
  iosSwitch.click()
}

// "kind": tick (a wheel click), press (a button) or hold (a long press). Each is heard too, when
// the click sounds are on (see clicks.js)
export const buzz = (kind = 'press') => {
  click(kind)
  if (!enabled) return
  const now = Date.now()
  if (kind === 'tick' && now - last < MIN_GAP_MS) return
  last = now
  try {
    if (canVibrate()) {
      navigator.vibrate(PULSES[kind] || PULSES.press)
    } else if (knowsSwitches()) {
      flipSwitch()
    }
  } catch (e) {
    // A nicety: never let it break a control
  }
}

// Turns the clicks on or off (Personal settings)
export const setHaptics = (on) => {
  enabled = !!on
}

// For tests
export const resetHaptics = () => {
  enabled = true
  last = 0
  iosSwitch?.remove()
  iosSwitch = null
}
