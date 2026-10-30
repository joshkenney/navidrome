// The iPods the phone player can look like (Personal settings). Each is drawn from a real model's
// front (see IpodBody): its size, where its screen and wheel are, and its materials. The sizes are
// in millimetres, measured from Apple's specifications and front drawings of each model, so the
// screen and the wheel sit where they did, never over each other.

// The fronts. "window" is the glass over the screen, "lcd" the lit screen inside it. "controls":
// "click" (a click wheel with MENU and the arrows printed on it), "ring" (1st and 2nd generation:
// four buttons on a ring around a scroll or touch wheel) or "row" (3rd generation: four buttons in
// a row above a touch wheel)
export const MODELS = {
  // 1st (2001) and 2nd (2002) generation: 102 x 61.8 mm, 2" 160x128 screen
  scroll: {
    w: 61.8,
    h: 102,
    r: 7.5,
    window: { x: 8.9, y: 4.6, w: 44, h: 32, r: 1.4 },
    lcd: { x: 11.1, y: 5.6, w: 39.6, h: 30 },
    controls: 'ring',
    ring: { cx: 30.9, cy: 70.4, d: 56 },
    wheel: { cx: 30.9, cy: 70.4, d: 41.5 },
    center: 13,
  },
  // 3rd generation (2003): 104.1 x 61.8 mm, four buttons above a touch wheel
  row: {
    w: 61.8,
    h: 104.1,
    r: 7.5,
    window: { x: 8, y: 5.2, w: 45.8, h: 38, r: 1.6 },
    lcd: { x: 11.1, y: 8.3, w: 39.6, h: 31.7 },
    controls: 'row',
    row: { cy: 49.6, d: 10.6, xs: [12.6, 24.8, 37, 49.2] },
    wheel: { cx: 30.9, cy: 76.8, d: 42 },
    center: 15.2,
  },
  // 4th generation and iPod Photo (2004): the first click wheel
  click4: {
    w: 61.8,
    h: 104.1,
    r: 7.5,
    window: { x: 10.6, y: 6.6, w: 40.6, h: 32.4, r: 0.8 },
    lcd: { x: 11.1, y: 7.1, w: 39.6, h: 31.4 },
    controls: 'click',
    wheel: { cx: 30.9, cy: 69.6, d: 42.5 },
    center: 15.6,
  },
  // 5th generation (2005): 103.5 x 61.8 mm, 2.5" 320x240 screen, smaller wheel
  click5: {
    w: 61.8,
    h: 103.5,
    r: 7.5,
    window: { x: 4.7, y: 4.6, w: 52.4, h: 39.4, r: 1 },
    lcd: { x: 5.5, y: 5.25, w: 50.8, h: 38.1 },
    controls: 'click',
    wheel: { cx: 30.9, cy: 73.2, d: 38.6 },
    center: 15,
  },
  // 6th and 7th generation classic (2007-2009): anodized aluminium front, flatter corners
  classic: {
    w: 61.8,
    h: 103.5,
    r: 5.6,
    window: { x: 4.25, y: 4.4, w: 53.3, h: 41.2, r: 0.6 },
    lcd: { x: 5.5, y: 5.8, w: 50.8, h: 38.1 },
    controls: 'click',
    wheel: { cx: 30.9, cy: 75.2, d: 38.7 },
    center: 13.6,
  },
  // iPod mini (2004-2005): 91 x 51 mm, 1.67" 138x110 screen, an aluminium tube. Seen from the
  // front its corners are nearly square: the tube's roundness is on its sides
  mini: {
    w: 50.8,
    h: 91.4,
    r: 3.2,
    window: { x: 7.4, y: 5.3, w: 36, h: 29.7, r: 1 },
    lcd: { x: 8.4, y: 6.4, w: 34, h: 27.2 },
    controls: 'click',
    wheel: { cx: 25.4, cy: 63.3, d: 38.8 },
    center: 13.2,
  },
}

// The screens
const COLOR_LCD = {
  background: 'linear-gradient(180deg, #e9eff3 0%, #d3dde4 100%)',
  text: '#1c2630',
  muted: '#4c5964',
  bar: '#1c2630',
  track: 'rgba(28, 38, 48, 0.18)',
  highlight: 'linear-gradient(180deg, #5b9be0 0%, #2d6cbf 100%)',
  highlightText: '#ffffff',
  coverFilter: 'none',
}
// The iPod Photo's screen (2004): colour, but small (220x176) and coarse. Its covers were tiny,
// blocky and grainy (see IpodScreen)
const PHOTO_LCD = {
  ...COLOR_LCD,
  coverFilter: 'contrast(1.06) saturate(1.12)',
  lowRes: true,
}
// The black and white screens (1st to 4th generation, and the mini) showed no covers, only text,
// and lit up with a backlight that went out after a few seconds (see MobilePlayer), leaving the
// bare reflective screen: "unlit". The backlights differed a lot from one generation to the next

// The bare screen, its backlight off: grey-olive, readable by the light falling on it
const UNLIT = {
  background: 'linear-gradient(180deg, #b4b7a4 0%, #9fa38f 100%)',
  text: '#25281e',
  muted: '#4a4e40',
  bar: '#25281e',
  track: 'rgba(37, 40, 30, 0.22)',
  highlight: '#2b2e23',
  highlightText: '#aeb19e',
  glow: 'inset 0 0 6px rgba(0, 0, 0, 0.35)',
}

// The pixel grid of the early screens, which showed between the dots
const PIXEL_GRID =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 3px)'
// The 1st and 2nd generation's coarser dots
const COARSE_GRID =
  'repeating-linear-gradient(0deg, rgba(40,46,52,0.09) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(40,46,52,0.09) 0 1px, transparent 1px 4px)'

// 1st and 2nd generation: a cheap, uneven white backlight turned up too far. It glows, blown out
// near the top left and dimmer in the corners, the light bleeding round the text, which smears a
// little, and the coarse pixel grid shows
const FUGLY = {
  mono: true,
  background:
    'radial-gradient(ellipse 80% 70% at 36% 30%, #ffffff 0%, #fdfefe 34%, #eef1f3 66%, #d6dcdf 100%)',
  text: '#2a2f34',
  muted: '#545b62',
  bar: '#2a2f34',
  track: 'rgba(42, 47, 52, 0.2)',
  highlight: '#2a2f34',
  highlightText: '#ffffff',
  glow: 'inset 0 0 16px rgba(255, 255, 255, 0.85), inset 0 0 3px rgba(0, 0, 0, 0.4)',
  grid: COARSE_GRID,
  ghost:
    '0 0 1.5px rgba(255, 255, 255, 0.95), 0.6px 0.4px 0 rgba(42, 47, 52, 0.3), -0.4px 0 1px rgba(42, 47, 52, 0.22)',
  unlit: UNLIT,
}

// 3rd generation: a muted, greyish blue, not as blue as the 4th generation's
const MUTED_BLUE = {
  mono: true,
  background:
    'radial-gradient(ellipse 85% 75% at 50% 38%, #eef2f5 0%, #d6dfe7 50%, #bccad6 88%, #abbbca 100%)',
  text: '#1c2733',
  muted: '#425060',
  bar: '#1c2733',
  track: 'rgba(28, 39, 51, 0.18)',
  highlight: '#1c2733',
  highlightText: '#e1e8ee',
  glow: 'inset 0 0 10px rgba(60, 82, 108, 0.3), inset 0 0 2px rgba(0, 0, 0, 0.3)',
  grid: PIXEL_GRID,
  unlit: UNLIT,
}

// 4th generation: a cooler, bluer white
const ICY = {
  mono: true,
  background:
    'radial-gradient(ellipse 90% 80% at 50% 35%, #eef6ff 0%, #c9e1f8 50%, #9fc4ea 88%, #86b0dc 100%)',
  text: '#0e2340',
  muted: '#2f4a6e',
  bar: '#0e2340',
  track: 'rgba(14, 35, 64, 0.18)',
  highlight: '#0e2340',
  highlightText: '#dcecfc',
  glow: 'inset 0 0 10px rgba(40, 90, 160, 0.35), inset 0 0 2px rgba(0, 0, 0, 0.3)',
  unlit: UNLIT,
}

// The mini: a plain white backlight
const MINI_LIGHT = {
  mono: true,
  background: 'linear-gradient(180deg, #e2e9ec 0%, #c7d2d8 100%)',
  text: '#1c2830',
  muted: '#46545e',
  bar: '#1c2830',
  track: 'rgba(28, 40, 48, 0.2)',
  highlight: '#1c2830',
  highlightText: '#dde5e9',
  glow: 'inset 0 0 8px rgba(0, 0, 0, 0.2)',
  unlit: UNLIT,
}

// Materials. "face" is the front: glossy plastic, brushed aluminium or clear acrylic. The polished
// steel back shows as a rim around the plastic fronts
const plastic = (top, bottom) => ({ kind: 'plastic', top, bottom })
const aluminium = (light, base, dark, finish) => ({
  kind: 'aluminium',
  light,
  base,
  dark,
  finish,
})

const WHITE_WHEEL = {
  surface: ['#dadbde', '#cfd0d4'],
  label: '#ffffff',
  center: ['#ffffff', '#ebecee'],
}
const BLACK_WHEEL = {
  surface: ['#2e2e31', '#232326'],
  label: '#8e8e93',
  center: ['#2a2a2d', '#151517'],
}
const U2_WHEEL = {
  surface: ['#d4202f', '#b0101f'],
  label: '#1b1b1d',
  center: ['#2a2a2d', '#141416'],
}

// An iPod mini in one of its anodized colours, with an off-white wheel. The first ones (2004) had
// soft colours and grey labels on the wheel; the second (2005) brighter colours, labels in the
// body's colour, and no gold
const MINI_LABEL = '#a3a6ab'
const mini = (id, name, light, base, dark, label = MINI_LABEL) => ({
  id,
  name,
  group: 'mini',
  model: 'mini',
  lcd: MINI_LIGHT,
  face: aluminium(light, base, dark),
  tube: true,
  wheel: {
    surface: ['#f4f4f2', '#e6e6e3'],
    label,
    center: ['#fbfbfa', '#ecece9'],
  },
})

export const SKINS = [
  {
    id: '1g',
    name: '1st generation (2001)',
    group: 'classic',
    model: 'scroll',
    lcd: FUGLY,
    face: plastic('#fdfdfd', '#e8e9eb'),
    rim: true,
    windowFrame: '#2a2c27',
    ring: { surface: ['#fdfdfd', '#e9eaec'], label: '#8f9196', lower: true },
    wheel: {
      surface: ['#fafafa', '#e9eaec'],
      label: '#8f9196',
      center: ['#ffffff', '#ebecee'],
    },
  },
  {
    id: '2g',
    name: '2nd generation (2002)',
    group: 'classic',
    model: 'scroll',
    lcd: FUGLY,
    face: plastic('#fdfdfd', '#e8e9eb'),
    rim: true,
    windowFrame: '#2a2c27',
    ring: { surface: ['#fdfdfd', '#e9eaec'], label: '#8f9196', lower: true },
    wheel: {
      surface: ['#f6f6f7', '#ececee'],
      label: '#8f9196',
      center: ['#ffffff', '#ebecee'],
    },
  },
  {
    id: '3g',
    name: '3rd generation (2003)',
    group: 'classic',
    model: 'row',
    lcd: MUTED_BLUE,
    face: plastic('#fdfdfd', '#e6e7e9'),
    rim: true,
    windowFrame: '#0d0d0e',
    // Its buttons lit up red with the backlight, and were plain grey without it
    row: {
      surface: ['#ffffff', '#eaebed'],
      label: '#e8331e',
      unlitLabel: '#a7a9ae',
      glow: true,
    },
    wheel: {
      surface: ['#f7f7f8', '#ebebed'],
      label: '#9a9ca1',
      center: ['#ffffff', '#ebecee'],
    },
  },
  {
    id: '4g',
    name: '4th generation (2004)',
    group: 'classic',
    model: 'click4',
    lcd: ICY,
    face: plastic('#fdfdfd', '#e6e7e9'),
    rim: true,
    windowFrame: '#0d0d0e',
    wheel: WHITE_WHEEL,
  },
  {
    id: 'photo',
    name: 'iPod Photo (2004)',
    group: 'classic',
    model: 'click4',
    lcd: PHOTO_LCD,
    face: plastic('#fdfdfd', '#e6e7e9'),
    rim: true,
    windowFrame: '#0d0d0e',
    wheel: WHITE_WHEEL,
  },
  {
    id: '5g-white',
    name: '5th generation, white (2005)',
    group: 'classic',
    model: 'click5',
    lcd: COLOR_LCD,
    face: plastic('#ffffff', '#e9eaec'),
    rim: true,
    windowFrame: '#0b0b0c',
    wheel: WHITE_WHEEL,
  },
  {
    id: '5g-black',
    name: '5th generation, black (2005)',
    group: 'classic',
    model: 'click5',
    lcd: COLOR_LCD,
    face: plastic('#2c2c2f', '#0f0f11'),
    rim: true,
    windowFrame: '#050506',
    wheel: BLACK_WHEEL,
  },
  {
    id: 'classic-silver',
    name: '6th/7th generation classic, silver (2007)',
    group: 'classic',
    model: 'classic',
    lcd: COLOR_LCD,
    face: aluminium('#f3f4f6', '#d3d6da', '#aeb2b8'),
    rim: true,
    windowFrame: '#0b0b0c',
    wheel: {
      surface: ['#fbfbfb', '#efefef'],
      label: '#a1a3a8',
      center: ['#e9eaec', '#c3c6cb'],
    },
  },
  {
    id: 'classic-black',
    name: '6th/7th generation classic, black (2009)',
    group: 'classic',
    model: 'classic',
    lcd: COLOR_LCD,
    // The 2008-2009 "black" was a space grey front, smooth anodized aluminium with a soft sheen
    // and a polished edge, and a black wheel
    face: aluminium('#777a80', '#56595f', '#36383c', 'satin'),
    rim: true,
    windowFrame: '#050506',
    wheel: {
      surface: ['#26272a', '#141416'],
      label: '#94969b',
      center: ['#3a3b3f', '#1b1c1e'],
    },
  },
  mini('mini-silver', 'mini, silver (2004)', '#f1f2f4', '#c9ccd1', '#9fa3aa'),
  mini('mini-gold', 'mini, gold (2004)', '#f3e6c0', '#d6bd82', '#b0935a'),
  mini('mini-pink', 'mini, pink (2004)', '#f8dce8', '#e8b4cb', '#c48ea6'),
  mini('mini-blue', 'mini, blue (2004)', '#dcebf3', '#a9cbdf', '#7da2b9'),
  mini('mini-green', 'mini, green (2004)', '#e2f1d6', '#b6d9a1', '#88ad73'),
  mini(
    'mini2-pink',
    'mini 2nd generation, pink (2005)',
    '#ffc8df',
    '#f47fb4',
    '#c94d88',
    '#ee6aa6',
  ),
  mini(
    'mini2-blue',
    'mini 2nd generation, blue (2005)',
    '#b8e6fa',
    '#2fade3',
    '#137cad',
    '#209fd8',
  ),
  mini(
    'mini2-green',
    'mini 2nd generation, green (2005)',
    '#d6f7bb',
    '#82d64e',
    '#4c9d27',
    '#6cc63b',
  ),
  {
    id: 'transparent',
    name: 'Transparent',
    group: 'transparent',
    model: 'click5',
    lcd: COLOR_LCD,
    // A clear acrylic front over the insides: circuit board, hard drive, battery
    face: { kind: 'clear' },
    rim: true,
    windowFrame: '#0b0b0c',
    wheel: {
      surface: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.28)'],
      label: 'rgba(255,255,255,0.95)',
      center: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.4)'],
    },
  },
  {
    id: '4g-u2',
    name: '4th generation U2 Special Edition (2004)',
    group: 'special',
    model: 'click4',
    lcd: ICY,
    face: plastic('#2a2a2d', '#0e0e10'),
    rim: true,
    windowFrame: '#050506',
    wheel: U2_WHEEL,
  },
  {
    id: '4g-hp',
    name: 'Harry Potter Collector’s Edition (2005)',
    group: 'special',
    // A white iPod Photo, the Hogwarts crest engraved on its back
    model: 'click4',
    lcd: PHOTO_LCD,
    face: plastic('#fdfdfd', '#e6e7e9'),
    rim: true,
    windowFrame: '#0d0d0e',
    wheel: WHITE_WHEEL,
  },
  {
    id: '5g-u2',
    name: '5th generation U2 Special Edition (2006)',
    group: 'special',
    model: 'click5',
    lcd: COLOR_LCD,
    face: plastic('#2c2c2f', '#0f0f11'),
    rim: true,
    windowFrame: '#050506',
    wheel: U2_WHEEL,
  },
  {
    id: 'red',
    name: 'Red, in the style of (PRODUCT)RED',
    group: 'special',
    model: 'classic',
    lcd: COLOR_LCD,
    face: aluminium('#f04a58', '#cc1b2d', '#8f0f1d'),
    rim: true,
    windowFrame: '#0b0b0c',
    wheel: {
      surface: ['#fbfbfb', '#efefef'],
      label: '#b6b8bc',
      center: ['#ececee', '#cfd1d5'],
    },
  },
]

export const AUTO_SKIN = 'auto'
export const SKIN_GROUPS = ['classic', 'mini', 'transparent', 'special']

// The iPod chosen, or one matching the theme: the black 5th generation on dark themes, the white
// one on light themes
export const skinFor = (id, theme) =>
  SKINS.find((s) => s.id === id) ||
  SKINS.find(
    (s) => s.id === (theme?.palette?.type === 'dark' ? '5g-black' : '5g-white'),
  )

export const modelOf = (skin) => MODELS[skin.model]

// Whether the front is dark (black and space grey iPods), for what is drawn on it
export const isDark = (skin) => {
  const f = skin.face
  const hex =
    f.kind === 'plastic' ? f.top : f.kind === 'aluminium' ? f.base : '#1a5536'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

// The front's colour, as a CSS background (for the screen strip)
export const faceCss = (skin) => {
  const f = skin.face
  if (f.kind === 'clear')
    return 'linear-gradient(160deg, #2b6b49 0%, #184a30 100%)'
  if (f.kind === 'aluminium')
    return `linear-gradient(160deg, ${f.light} 0%, ${f.base} 55%, ${f.dark} 100%)`
  return `linear-gradient(180deg, ${f.top} 0%, ${f.bottom} 100%)`
}

// The screen's colours, as the CSS variables the screen's styles read (see LCD in ipodLook)
export const lcdVars = (lcd) => ({
  '--lcd-bg': lcd.background,
  '--lcd-text': lcd.text,
  '--lcd-muted': lcd.muted,
  '--lcd-bar': lcd.bar,
  '--lcd-track': lcd.track,
  '--lcd-highlight': lcd.highlight,
  '--lcd-highlight-text': lcd.highlightText,
  '--lcd-cover-filter': lcd.coverFilter || 'none',
  '--lcd-glow': lcd.glow || 'none',
  '--lcd-grid': lcd.grid || 'none',
  '--lcd-ghost': lcd.ghost || 'none',
})

// The screen's colours with its backlight on or off (only the black and white screens go dark)
export const screenOf = (lcd, lit = true) =>
  lit || !lcd.unlit
    ? lcd
    : { ...lcd, ...lcd.unlit, grid: lcd.grid, ghost: 'none' }

// Where something is on the front, as percentages of it (for the parts drawn over it in HTML)
export const percentBox = (model, { x, y, w, h }) => ({
  left: `${(x / model.w) * 100}%`,
  top: `${(y / model.h) * 100}%`,
  width: `${(w / model.w) * 100}%`,
  height: `${(h / model.h) * 100}%`,
})
export const circleBox = (model, { cx, cy, d }) =>
  percentBox(model, { x: cx - d / 2, y: cy - d / 2, w: d, h: d })
