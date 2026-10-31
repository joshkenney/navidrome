import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  bodyPicture,
  forgetPictures,
  hasPicture,
  pictureKey,
  readyPicture,
} from './bodyPicture'
import { skinFor } from './skins'

describe('bodyPicture', () => {
  let drawImage
  let sources
  beforeEach(() => {
    forgetPictures()
    drawImage = vi.fn()
    sources = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage }),
    )
    vi.stubGlobal(
      'Image',
      class {
        set src(value) {
          sources.push(decodeURIComponent(value))
        }
        decode() {
          return Promise.resolve()
        }
      },
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("draws a front once, as an SVG picture of the phone's size, and keeps it", async () => {
    const skin = skinFor('classic-silver')
    const canvas = await bodyPicture(skin, true, 600, 1000)
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(1000)
    expect(drawImage).toHaveBeenCalledTimes(1)
    expect(sources[0]).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]* width="600" height="1000"/,
    )
    const key = pictureKey(skin, true, 600, 1000)
    expect(readyPicture(key)).toBe(canvas)
    expect(await bodyPicture(skin, true, 600, 1000)).toBe(canvas)
    expect(drawImage).toHaveBeenCalledTimes(1)
  })

  it('draws one front for the backlight on and off, but for the 3rd generation, whose buttons lit up', () => {
    const fifth = skinFor('5g-white')
    expect(pictureKey(fifth, false, 1, 2)).toBe(pictureKey(fifth, true, 1, 2))
    const third = skinFor('3g')
    expect(pictureKey(third, false, 1, 2)).not.toBe(
      pictureKey(third, true, 1, 2),
    )
  })

  it('keeps only the last few pictures', async () => {
    const skin = skinFor('5g-black')
    for (let w = 100; w <= 600; w += 100) await bodyPicture(skin, true, w, 200)
    expect(hasPicture(pictureKey(skin, true, 100, 200))).toBe(false)
    expect(hasPicture(pictureKey(skin, true, 600, 200))).toBe(true)
  })

  it("gives no picture where it can't be drawn", async () => {
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null)
    expect(await bodyPicture(skinFor('1g'), true, 100, 200)).toBeNull()
  })
})
