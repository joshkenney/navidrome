import React, { useLayoutEffect, useRef, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'

// How fast the text scrolls (pixels a second), and the share of the time it rests at each end
const SPEED = 32
const MIN_SECONDS = 4

const useStyles = makeStyles(
  {
    // Scroll left until the end shows, rest, scroll back, rest: like the iPod's long lines
    '@keyframes ndIpodMarquee': {
      '0%, 15%': { transform: 'translateX(0)' },
      '45%, 60%': { transform: 'translateX(var(--marquee-shift))' },
      '90%, 100%': { transform: 'translateX(0)' },
    },
    outer: {
      display: 'block',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      minWidth: 0,
      maxWidth: '100%',
    },
    scrolling: { textOverflow: 'clip' },
    inner: { display: 'inline-block', whiteSpace: 'nowrap' },
    moving: {
      animationName: '$ndIpodMarquee',
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      willChange: 'transform',
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    },
  },
  { name: 'NDMarquee' },
)

// A line of text that scrolls back and forth when it is too long for its place, as long as it is
// "active" (on the iPod: the highlighted menu item, Now Playing's lines). Otherwise it is cut
// short with an ellipsis
export const Marquee = ({ children, active = true, className, ...rest }) => {
  const classes = useStyles()
  const outer = useRef(null)
  const inner = useRef(null)
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const o = outer.current
      const i = inner.current
      if (!o || !i) return
      const overflow = i.scrollWidth - o.clientWidth
      setShift(overflow > 1 ? Math.ceil(overflow) : 0)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    if (outer.current) observer.observe(outer.current)
    return () => observer.disconnect()
  }, [children])

  const scrolling = active && shift > 0
  // A third of the time scrolling each way
  const seconds = Math.max(MIN_SECONDS, shift / SPEED / 0.3)
  return (
    <span
      ref={outer}
      className={[classes.outer, scrolling && classes.scrolling, className]
        .filter(Boolean)
        .join(' ')}
      data-scrolling={scrolling ? 'true' : undefined}
      {...rest}
    >
      <span
        ref={inner}
        className={`${classes.inner} ${scrolling ? classes.moving : ''}`}
        style={
          scrolling
            ? {
                '--marquee-shift': `-${shift}px`,
                animationDuration: `${seconds}s`,
              }
            : undefined
        }
      >
        {children}
      </span>
    </span>
  )
}
