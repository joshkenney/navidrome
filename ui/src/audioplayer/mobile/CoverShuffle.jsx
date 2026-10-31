import React, { useEffect, useRef, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import subsonic from '../../subsonic'
import { fetchRandomAlbums } from './ipodBrowse'
import { isRealCover } from './realCover'

// How long each cover shows, and how long the next takes to fade in over it
export const COVER_MS = 6000
const FADE_MS = 1000

const useStyles = makeStyles(
  {
    '@keyframes ndCoverIn': { from: { opacity: 0 } },
    // Drifting slowly across the cover, a little closer in
    '@keyframes ndCoverDrift': {
      from: { transform: 'translateX(0) scale(1.06)' },
      to: { transform: 'translateX(calc(100cqw - 100%)) scale(1.06)' },
    },
    shuffle: {
      position: 'relative',
      overflow: 'hidden',
      containerType: 'size',
      background: '#000',
    },
    cover: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      aspectRatio: '1 / 1',
      maxWidth: 'none',
      objectFit: 'cover',
      transformOrigin: 'left center',
      animation: `$ndCoverIn ${FADE_MS}ms ease-out, $ndCoverDrift ${COVER_MS + FADE_MS}ms linear forwards`,
      '@media (prefers-reduced-motion: reduce)': {
        animation: `$ndCoverIn ${FADE_MS}ms ease-out`,
      },
    },
    // Every other cover drifts back the other way
    back: { animationDirection: 'normal, reverse' },
  },
  { name: 'NDCoverShuffle' },
)

// The 6th and 7th generation's main menu showed, beside it, the covers of the iPod's albums, one
// after another, drifting slowly. "fallback": a cover to show if the albums can't be had
export const CoverShuffle = ({ libraryId, fallback, className }) => {
  const classes = useStyles()
  const [covers, setCovers] = useState([])
  // How many covers have been shown: a count, so that each has a key of its own
  const [at, setAt] = useState(0)

  useEffect(() => {
    let live = true
    fetchRandomAlbums(libraryId)
      .then(({ data }) => {
        if (!live) return
        setCovers(
          data.map((album) => subsonic.getCoverArtUrl(album, 300, true)),
        )
        setAt(0)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [libraryId])

  useEffect(() => {
    if (covers.length < 2) return undefined
    const timer = setInterval(
      () =>
        setAt((i) => {
          let next = i + 1
          const skip = placeholders.current
          while (
            skip.has(covers[next % covers.length]) &&
            next < i + covers.length
          )
            next++
          return next
        }),
      COVER_MS,
    )
    return () => clearInterval(timer)
  }, [covers])

  // The albums with no cover of their own (the server's placeholder) are passed over: the one
  // shown, at once, the next one when its time comes. The next one is fetched ahead (to know), so
  // it fades in whole
  const placeholders = useRef(new Set())
  useEffect(() => {
    if (!covers.length) return undefined
    let live = true
    const current = covers[at % covers.length]
    const next = covers[(at + 1) % covers.length]
    isRealCover(current).then((real) => {
      if (!live || real) return
      placeholders.current.add(current)
      if (placeholders.current.size < covers.length) setAt((i) => i + 1)
    })
    isRealCover(next).then((real) => {
      if (!real) placeholders.current.add(next)
    })
    return () => {
      live = false
    }
  }, [at, covers])

  const real = covers.filter((url) => !placeholders.current.has(url))
  const list = real.length ? covers : fallback ? [fallback] : []
  // The cover before, under the one fading in
  const shown = list.length > 1 ? [at - 1, at] : list.length ? [at] : []
  return (
    <div
      className={`${classes.shuffle} ${className || ''}`}
      data-testid="cover-shuffle"
      aria-hidden
    >
      {shown.map((i) => {
        const n = (i + list.length) % list.length
        return (
          <img
            key={i}
            className={`${classes.cover} ${i % 2 ? classes.back : ''}`}
            src={list[n]}
            alt=""
            draggable={false}
          />
        )
      })}
    </div>
  )
}
