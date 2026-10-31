import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { IpodBody } from './IpodBody'
import {
  bodyPicture,
  hasPicture,
  pictureKey,
  readyPicture,
} from './bodyPicture'

// How long after the player opens a front not drawn ahead is drawn: once it has slid open
const DRAW_AFTER_MS = 400

const useStyles = makeStyles(
  {
    '@keyframes ndIpodFrontIn': {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    front: { position: 'absolute', inset: 0 },
    layer: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      display: 'block',
    },
    // Fading in over the plain drawing, or over the picture before it (the 3rd generation's
    // buttons lighting up with the backlight, as their light did)
    fadeIn: { animation: '$ndIpodFrontIn 400ms ease-out' },
  },
  { name: 'NDIpodFront' },
)

// An element's size in device pixels, as the pictures are drawn
export const devicePixels = (el) => {
  const ratio = window.devicePixelRatio || 1
  return {
    w: Math.round(el.clientWidth * ratio),
    h: Math.round(el.clientHeight * ratio),
  }
}

// Shows a picture (a canvas) in place
const Picture = ({ source, className, canvasClass, onAnimationEnd }) => {
  const host = useRef(null)
  useLayoutEffect(() => {
    const el = host.current
    el.appendChild(source)
    return () => {
      if (source.parentNode === el) el.removeChild(source)
    }
  }, [source])
  useLayoutEffect(() => {
    source.setAttribute('class', canvasClass)
  }, [source, canvasClass])
  return (
    <div
      ref={host}
      className={className}
      onAnimationEnd={onAnimationEnd}
      aria-hidden
    />
  )
}

// The iPod's front, as a picture drawn once (see bodyPicture). Until it is drawn, the front without
// its filters, quick to draw; where it can't be drawn, the front as it is
export const IpodFront = ({ skin, lit, className }) => {
  const classes = useStyles()
  const box = useRef(null)
  const [size, setSize] = useState(null)
  // The pictures shown, the last on top, fading in over the one under it
  const [layers, setLayers] = useState([])
  const [failed, setFailed] = useState(false)
  const key = size && pictureKey(skin, lit, size.w, size.h)

  useLayoutEffect(() => {
    const el = box.current
    const measure = () => {
      const next = devicePixels(el)
      if (!next.w || !next.h) return
      setSize((s) => (s && s.w === next.w && s.h === next.h ? s : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const show = (canvas, fade) =>
    setLayers((shown) =>
      shown.length && shown[shown.length - 1].key === key
        ? shown
        : [
            ...shown.filter((l) => l.key !== key).slice(-1),
            { key, canvas, fade },
          ],
    )

  // A picture drawn ahead (see prepareFront) is shown at once, before the player is painted
  useLayoutEffect(() => {
    if (!key) return
    const ready = readyPicture(key)
    if (ready) show(ready, layers.length > 0)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Not drawn ahead, it is drawn once the player has slid open: drawing it takes a phone a moment,
  // which the opening would stutter through
  useEffect(() => {
    if (!size) return undefined
    let live = true
    const draw = () =>
      bodyPicture(skin, lit, size.w, size.h).then((canvas) => {
        if (!live) return
        if (canvas) show(canvas, true)
        else setFailed(true)
      })
    let later = null
    if (hasPicture(key)) draw()
    else later = setTimeout(draw, DRAW_AFTER_MS)
    return () => {
      live = false
      clearTimeout(later)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Once the top picture has faded in, the ones under it go
  const settle = () =>
    setLayers((shown) => shown.slice(-1).map((l) => ({ ...l, fade: false })))
  const covered = layers.length > 0 && !layers[layers.length - 1].fade
  const settled = layers.length === 1 && covered

  return (
    <div ref={box} className={`${classes.front} ${className || ''}`}>
      {failed ? (
        <IpodBody skin={skin} lit={lit} className={classes.layer} />
      ) : (
        !settled &&
        !(layers.length > 1) && (
          <IpodBody skin={skin} lit={lit} plain className={classes.layer} />
        )
      )}
      {!failed &&
        layers.map((l, i) => (
          <Picture
            key={l.key}
            source={l.canvas}
            className={`${classes.layer} ${l.fade ? classes.fadeIn : ''}`}
            canvasClass={classes.layer}
            onAnimationEnd={i === layers.length - 1 ? settle : undefined}
          />
        ))}
    </div>
  )
}

// Draws the front of an iPod ahead, at the size it will be shown ("el": an element of that size),
// lit and unlit, so the player opens at once
export const prepareFront = (skin, el) => {
  const { w, h } = devicePixels(el)
  if (!w || !h) return
  bodyPicture(skin, true, w, h)
  if (skin.row?.unlitLabel) bodyPicture(skin, false, w, h)
}
