import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buzz, resetHaptics, setHaptics } from './haptics'

describe('buzz', () => {
  let now
  beforeEach(() => {
    resetHaptics()
    now = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete navigator.vibrate
    delete HTMLInputElement.prototype.switch
  })

  describe('on Android (Vibration API)', () => {
    beforeEach(() => {
      navigator.vibrate = vi.fn()
    })

    it('pulses long enough for phone motors to feel: wheel clicks, presses and long presses', () => {
      buzz('tick')
      now += 100
      buzz('press')
      now += 100
      buzz('hold')
      expect(navigator.vibrate.mock.calls).toEqual([[10], [15], [25]])
    })

    it('clicks no faster than the phone can, when the wheel spins fast', () => {
      buzz('tick')
      now += 10
      buzz('tick')
      now += 10
      buzz('tick')
      now += 30
      buzz('tick')
      expect(navigator.vibrate).toHaveBeenCalledTimes(2)
    })

    it('can be turned off', () => {
      setHaptics(false)
      buzz('press')
      expect(navigator.vibrate).not.toHaveBeenCalled()
      setHaptics(true)
      buzz('press')
      expect(navigator.vibrate).toHaveBeenCalled()
    })
  })

  describe('on iPhone (no Vibration API, iOS 18 switches)', () => {
    beforeEach(() => {
      // Safari's switch inputs: jsdom doesn't know them
      Object.defineProperty(HTMLInputElement.prototype, 'switch', {
        value: false,
        writable: true,
        configurable: true,
      })
    })

    it('flips a hidden switch, which plays the system haptic', () => {
      buzz('press')
      const input = document.head.querySelector('input[switch]')
      expect(input).toBeTruthy()
      expect(input.closest('label').style.display).toBe('none')
      expect(input.checked).toBe(true)
      now += 100
      buzz('tick')
      expect(input.checked).toBe(false)
      expect(document.head.querySelectorAll('input[switch]')).toHaveLength(1)
    })
  })

  it('does nothing where phones can neither vibrate nor flip switches', () => {
    expect(() => buzz('press')).not.toThrow()
    expect(document.head.querySelector('input[switch]')).toBeNull()
  })
})
