// An Instagram-like burst of hearts floating up from an element, shown when something is loved.
// It uses plain DOM elements over the page (so containers can't clip it) and the Web Animations
// API, and cleans up after itself

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
const COLORS = ['#ed4956', '#ff6b81', '#ff4d6d', '#ff8fa3', '#e63946']
const HEARTS = 12

const prefersReducedMotion = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const heart = (size, color) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', HEART_PATH)
  path.setAttribute('fill', color)
  svg.appendChild(path)
  Object.assign(svg.style, {
    position: 'absolute',
    left: `${-size / 2}px`,
    top: `${-size / 2}px`,
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  })
  return svg
}

const between = (min, max, random) => min + random() * (max - min)

// burstHearts sends a stream of hearts up from the centre of the element. Returns the number of
// hearts started (0 when animations are not available or not wanted)
export const burstHearts = (element, { random = Math.random } = {}) => {
  if (!element || prefersReducedMotion()) return 0
  const rect = element.getBoundingClientRect()
  const layer = document.createElement('div')
  Object.assign(layer.style, {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    width: '0',
    height: '0',
    pointerEvents: 'none',
    zIndex: '2000',
  })
  layer.setAttribute('data-testid', 'heart-burst')
  document.body.appendChild(layer)

  let longest = 0
  let started = 0
  for (let i = 0; i < HEARTS; i++) {
    const size = Math.round(between(12, 26, random))
    const el = heart(size, COLORS[i % COLORS.length])
    layer.appendChild(el)
    if (typeof el.animate !== 'function') continue

    const rise = between(70, 150, random)
    const drift = between(-45, 45, random)
    const sway = between(-20, 20, random)
    const spin = between(-35, 35, random)
    const duration = between(900, 1400, random)
    const delay = between(0, 280, random)
    longest = Math.max(longest, duration + delay)
    el.animate(
      [
        { transform: 'translate(0, 0) scale(0.3) rotate(0deg)', opacity: 0 },
        {
          transform: `translate(${sway}px, ${-rise * 0.35}px) scale(1.15) rotate(${spin / 2}deg)`,
          opacity: 1,
          offset: 0.25,
        },
        {
          transform: `translate(${drift}px, ${-rise}px) scale(0.9) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    )
    started++
  }

  // A little "pop" on the button itself
  if (typeof element.animate === 'function') {
    element.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.35)' },
        { transform: 'scale(1)' },
      ],
      { duration: 350, easing: 'ease-out' },
    )
  }

  setTimeout(() => layer.remove(), longest + 100)
  return started
}
