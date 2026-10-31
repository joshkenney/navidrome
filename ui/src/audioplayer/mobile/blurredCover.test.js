import { describe, it, expect } from 'vitest'
import { blurPixels } from './blurredCover'

describe('blurPixels', () => {
  it('blurs the tiny cover, darkens it by half and keeps it opaque', () => {
    // 24 x 52 pixels, alternately black and white
    const data = new Uint8ClampedArray(24 * 52 * 4)
    for (let p = 0; p < 24 * 52; p++) {
      const v = (p + Math.floor(p / 24)) % 2 ? 255 : 0
      data.set([v, v, v, 255], p * 4)
    }
    blurPixels(data)
    const reds = []
    for (let i = 0; i < data.length; i += 4) {
      reds.push(data[i])
      expect(data[i + 3]).toBe(255)
    }
    // Smooth (it was black and white, 0 to 255): all about the same grey, half of the mean 127.5
    expect(Math.max(...reds) - Math.min(...reds)).toBeLessThan(24)
    expect(reds.reduce((a, b) => a + b) / reds.length).toBeCloseTo(64, -1)
  })
})
