// The geometry of the click wheel. Angles are in degrees, measured on screen (y grows down), so
// they grow clockwise

// The angle of a point around the wheel's centre
export const angleAt = (cx, cy, x, y) =>
  (Math.atan2(y - cy, x - cx) * 180) / Math.PI

// The shortest turn from one angle to another: positive clockwise, negative counter-clockwise,
// across the ±180° seam too
export const angleDelta = (from, to) => {
  let d = to - from
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

// How many whole steps of "step" degrees a turn has made, towards zero (half a step back and
// forth doesn't click)
export const ticks = (turned, step) =>
  (turned >= 0 ? Math.floor(turned / step) : Math.ceil(turned / step)) || 0 // never -0

// Whether a point is on the ring: inside the wheel, outside the centre button. "inner" is the
// centre button's radius as a share of the wheel's
export const onRing = (cx, cy, radius, x, y, inner) => {
  const d = Math.hypot(x - cx, y - cy)
  return d <= radius && d >= radius * inner
}
