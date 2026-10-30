// The colours of the phone player: an iPod classic, black on dark themes and white on light ones,
// with the same backlit grey-blue screen on every theme

export const LCD = {
  background: 'linear-gradient(180deg, #e4ebef 0%, #cfd9e0 100%)',
  text: '#1c2630',
  muted: '#4c5964',
  bar: '#1c2630',
  track: 'rgba(28, 38, 48, 0.18)',
  highlight: 'linear-gradient(180deg, #4f8fd8 0%, #2d6cbf 100%)',
  highlightText: '#ffffff',
  bevel: 'inset 0 1px 3px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.35)',
}

const EDITIONS = {
  black: {
    case: 'linear-gradient(180deg, #2c2c30 0%, #121214 100%)',
    wheel: 'radial-gradient(circle at 50% 35%, #2a2a2e 0%, #1a1a1d 70%)',
    wheelEdge: 'rgba(255, 255, 255, 0.08)',
    center: 'radial-gradient(circle at 50% 30%, #3a3a3f 0%, #232326 80%)',
    label: '#c9c9cf',
  },
  white: {
    case: 'linear-gradient(180deg, #fbfbfc 0%, #e6e7ea 100%)',
    wheel: 'radial-gradient(circle at 50% 35%, #f6f6f8 0%, #e2e3e7 70%)',
    wheelEdge: 'rgba(0, 0, 0, 0.12)',
    center: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #ececef 80%)',
    label: '#8d8f96',
  },
}

export const edition = (theme) =>
  theme.palette.type === 'dark' ? EDITIONS.black : EDITIONS.white

// "1:05", or "-1:05" for the time left
export const formatTime = (seconds, negative = false) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return negative ? `-${text}` : text
}
