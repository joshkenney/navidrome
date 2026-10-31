import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IpodBody } from './IpodBody'

// The iPod's front, drawn once into a picture. Drawn as it is (an SVG, with its grain, blurs and
// shadows), a phone takes up to a few hundred milliseconds to draw it, and would draw it again
// whenever anything on the screen over it changed. As a picture, showing it is a copy. Pictures
// are kept for the last few iPods and sizes, so the player opens at once, and can be drawn ahead,
// before the player is opened (see IpodFront)

// How many pictures are kept: a full-size front is a few megabytes
const KEEP = 4
// key: a promise of the picture; and the pictures drawn
const pictures = new Map()
const drawn = new Map()

// Only the 3rd generation's front changes with the backlight: its buttons light up
const litFront = (skin, lit) => (skin.row?.unlitLabel ? !!lit : true)

export const pictureKey = (skin, lit, width, height) =>
  `${skin.id}|${litFront(skin, lit) ? 1 : 0}|${width}x${height}`

const draw = async (skin, lit, width, height) => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext && canvas.getContext('2d')
  if (!ctx) return null
  const svg = renderToStaticMarkup(
    React.createElement(IpodBody, { skin, lit: litFront(skin, lit) }),
  ).replace(
    /^<svg([^>]*) width="100%" height="100%"/,
    `<svg xmlns="http://www.w3.org/2000/svg"$1 width="${width}" height="${height}"`,
  )
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

// The picture of a front ("lit": the backlight on), "width" and "height" in device pixels: a
// promise of a canvas, or of null where it can't be drawn (the SVG is shown instead)
export const bodyPicture = (skin, lit, width, height) => {
  const key = pictureKey(skin, lit, width, height)
  let picture = pictures.get(key)
  if (picture) {
    // The most recently used last
    pictures.delete(key)
  } else {
    picture = draw(skin, lit, width, height)
      .catch(() => null)
      .then((canvas) => {
        if (canvas && pictures.has(key)) drawn.set(key, canvas)
        return canvas
      })
    while (pictures.size >= KEEP) {
      const oldest = pictures.keys().next().value
      pictures.delete(oldest)
      drawn.delete(oldest)
    }
  }
  pictures.set(key, picture)
  return picture
}

// The picture, if it is drawn already
export const readyPicture = (key) => drawn.get(key) || null

// Whether the picture is drawn or being drawn
export const hasPicture = (key) => pictures.has(key)

// For tests
export const forgetPictures = () => {
  pictures.clear()
  drawn.clear()
}
