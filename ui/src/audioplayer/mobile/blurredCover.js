// The song's cover, blurred, darkened and a little more saturated, for behind the iPod. A CSS blur
// as wide as the phone's screen costs a phone tens of milliseconds each time it is drawn (and it
// was, at each step of dragging the iPod down). Blurred as a tiny picture, a few dozen pixels
// across, it costs nothing, and stretched to the screen it is as smooth

// The tiny picture's size: tall, like a phone's screen
const W = 24
const H = 52
// How far it is blurred, in the tiny picture's pixels (three box blurs: about a Gaussian)
const RADIUS = 2
const PASSES = 3
const SATURATE = 1.3
const BRIGHTNESS = 0.5

// The covers blurred, by address: a promise of a picture (a data: URL), or of null
const blurred = new Map()
const KEEP = 8

// One box blur: along each row (step 1, stride W), or down each column (step W, stride 1)
const boxBlur = (src, dst, along, across, step, stride) => {
  for (let j = 0; j < across; j++) {
    for (let i = 0; i < along; i++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        let n = 0
        for (let k = -RADIUS; k <= RADIUS; k++) {
          const at = Math.min(along - 1, Math.max(0, i + k))
          sum += src[(j * stride + at * step) * 4 + c]
          n++
        }
        dst[(j * stride + i * step) * 4 + c] = sum / n
      }
      dst[(j * stride + i * step) * 4 + 3] = 255
    }
  }
}

// Blurs, saturates and darkens the tiny picture's pixels in place
export const blurPixels = (data) => {
  const a = Float32Array.from(data)
  const b = new Float32Array(a.length)
  for (let p = 0; p < PASSES; p++) {
    boxBlur(a, b, W, H, 1, W)
    boxBlur(b, a, H, W, W, 1)
  }
  for (let i = 0; i < a.length; i += 4) {
    const [r, g, bl] = [a[i], a[i + 1], a[i + 2]]
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * bl
    data[i] = (grey + (r - grey) * SATURATE) * BRIGHTNESS
    data[i + 1] = (grey + (g - grey) * SATURATE) * BRIGHTNESS
    data[i + 2] = (grey + (bl - grey) * SATURATE) * BRIGHTNESS
    data[i + 3] = 255
  }
  return data
}

const blur = async (url) => {
  const img = new Image()
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  // Its middle, as much as fills the tall picture
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const sw = Math.min(iw, (ih * W) / H) * 0.8
  const sh = Math.min(ih, (iw * H) / W) * 0.8
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H)
  const pixels = ctx.getImageData(0, 0, W, H)
  blurPixels(pixels.data)
  ctx.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}

// The cover at "url", blurred: a promise of a picture's address, or of null where the cover can't
// be read (the player blurs it with CSS instead)
export const blurredCover = (url) => {
  if (!url || typeof document === 'undefined') return Promise.resolve(null)
  let picture = blurred.get(url)
  if (!picture) {
    picture = blur(url).catch(() => null)
    while (blurred.size >= KEEP) blurred.delete(blurred.keys().next().value)
    blurred.set(url, picture)
  }
  return picture
}
