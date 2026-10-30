// The colours of the phone player's screen, as CSS variables set by the iPod chosen (see skins.js,
// lcdVars), falling back on the colour screen of the later iPods
export const LCD = {
  background:
    'var(--lcd-bg, linear-gradient(180deg, #e4ebef 0%, #cfd9e0 100%))',
  text: 'var(--lcd-text, #1c2630)',
  muted: 'var(--lcd-muted, #4c5964)',
  bar: 'var(--lcd-bar, #1c2630)',
  // The scrubbing diamond's colour, and the battery's charge
  accent: 'var(--lcd-accent, #1c2630)',
  battery: 'var(--lcd-battery, #1c2630)',
  track: 'var(--lcd-track, rgba(28, 38, 48, 0.18))',
  highlight:
    'var(--lcd-highlight, linear-gradient(180deg, #4f8fd8 0%, #2d6cbf 100%))',
  highlightText: 'var(--lcd-highlight-text, #ffffff)',
  // Black and white screens show covers in grey
  coverFilter: 'var(--lcd-cover-filter, none)',
  bevel: 'inset 0 1px 3px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.35)',
}

// Sizes on the screen are shares of a menu row's height ("--row", set by the screen's frame from
// its own height, see MobilePlayer), so smaller screens show smaller text, like each iPod did
export const row = (k) => `calc(var(--row, 26px) * ${k})`

// "1:05", or "-1:05" for the time left
export const formatTime = (seconds, negative = false) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return negative ? `-${text}` : text
}
