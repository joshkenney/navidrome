// The iPods the phone player can look like (Personal settings). Each is drawn from a real model's
// front (see IpodBody): its size, where its screen and wheel are, and its materials. The sizes are
// in millimetres, measured from Apple's specifications and front drawings of each model, so the
// screen and the wheel sit where they did, never over each other.

// The fronts. "window" is the glass over the screen, "lcd" the lit screen inside it. "controls":
// "click" (a click wheel with MENU and the arrows printed on it), "ring" (1st and 2nd generation:
// four buttons on a ring around a scroll or touch wheel) or "row" (3rd generation: four buttons in
// a row above a touch wheel)
export const MODELS = {
  // 1st (2001) and 2nd (2002) generation: 102 x 61.8 mm, 2" 160x128 screen. Its proportions are
  // those of Apple's own drawing of it, for the iPod's 25th anniversary (2026)
  scroll: {
    w: 61.8,
    h: 102,
    r: 5.7,
    window: { x: 9.5, y: 4.8, w: 42.8, h: 35, r: 1.3 },
    lcd: { x: 11.3, y: 6.6, w: 39.2, h: 31.4 },
    controls: 'ring',
    ring: { cx: 30.9, cy: 70, d: 52 },
    wheel: { cx: 30.9, cy: 70, d: 40.2 },
    center: 14.5,
  },
  // 3rd generation (2003): 104.1 x 61.8 mm, four buttons above a touch wheel, all sunk into the
  // front. Measured from Apple's photo of it: a thin frame round the screen, big buttons close
  // together
  row: {
    w: 61.8,
    h: 104.1,
    r: 6,
    window: { x: 9.7, y: 6.3, w: 42.4, h: 34.8, r: 1.1 },
    lcd: { x: 10.6, y: 7.1, w: 40.6, h: 33.1 },
    controls: 'row',
    row: { cy: 50.3, d: 11.6, xs: [10.7, 24.17, 37.63, 51.1] },
    wheel: { cx: 30.9, cy: 77.9, d: 39.6 },
    center: 14,
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
    r: 6,
    window: { x: 4.7, y: 4.6, w: 52.4, h: 39.9, r: 1 },
    lcd: { x: 5.5, y: 5.5, w: 50.8, h: 38.1 },
    controls: 'click',
    wheel: { cx: 30.9, cy: 73.2, d: 38.2 },
    center: 13.5,
  },
  // 6th and 7th generation classic (2007-2009): anodized aluminium front, a black bezel round the
  // screen. Measured, like the 5th generation, from Apple's photos
  classic: {
    w: 61.8,
    h: 103.5,
    r: 6,
    window: { x: 4.5, y: 4.6, w: 52.8, h: 40, r: 0.6 },
    lcd: { x: 5.5, y: 5.55, w: 50.8, h: 38.1 },
    controls: 'click',
    wheel: { cx: 30.9, cy: 73.2, d: 38.2 },
    center: 13.7,
  },
  // iPod mini (2004-2005): 91 x 51 mm, 1.67" 138x110 screen, an aluminium tube. Seen from the
  // front its corners are nearly square: the tube's roundness is on its sides
  mini: {
    w: 50.8,
    h: 91.4,
    r: 1.4,
    window: { x: 7.4, y: 5.3, w: 36, h: 29.7, r: 1 },
    lcd: { x: 8.4, y: 6.4, w: 34, h: 27.2 },
    controls: 'click',
    wheel: { cx: 25.4, cy: 63.3, d: 38.8 },
    center: 13.2,
  },
}

// The screens

// The colour screens' green battery
const GREEN_BATTERY =
  'linear-gradient(180deg, #b8f58c 0%, #63d13a 55%, #3fa923 100%)'

// The 5th generation's colour screen (2005): a glossy aqua progress bar and scrubbing diamond
const COLOR_LCD = {
  background: 'linear-gradient(180deg, #e9eff3 0%, #d3dde4 100%)',
  text: '#1c2630',
  muted: '#4c5964',
  bar: 'linear-gradient(180deg, #b9f4ff 0%, #5fd8ee 45%, #1fb3d4 55%, #2cc3df 100%)',
  accent: '#27bcdb',
  track: 'rgba(28, 38, 48, 0.18)',
  highlight: 'linear-gradient(180deg, #5b9be0 0%, #2d6cbf 100%)',
  highlightText: '#ffffff',
  battery: GREEN_BATTERY,
  coverFilter: 'none',
}
// The iPod Photo's screen (2004): colour, but small (220x176) and coarse. Its covers were tiny,
// blocky and grainy (see IpodScreen)
const PHOTO_LCD = {
  ...COLOR_LCD,
  coverFilter: 'contrast(1.06) saturate(1.12)',
  cover: 'lowRes',
}
// The 6th and 7th generation classic's screen (2007): a deeper blue bar with a tighter shine, and
// the cover leaning back in perspective over its reflection
const CLASSIC_LCD = {
  ...COLOR_LCD,
  bar: 'linear-gradient(180deg, #7fa6f0 0%, #2f63d6 40%, #1442b5 52%, #1d4fc4 100%)',
  accent: '#1a4bc0',
  highlight: 'linear-gradient(180deg, #4f86e8 0%, #1f55c9 100%)',
  cover: 'tilt',
}
// The black and white screens (1st to 4th generation, and the mini) showed no covers, only text,
// and lit up with a backlight that went out after a few seconds (see MobilePlayer), leaving the
// bare reflective screen: "unlit". They are drawn after Apple's 25th-anniversary iPod: a warm
// dark grey ink, a solid ink bar on the item the wheel is on, and the backlight's bulbs glowing
// at the screen's edges ("bulbs": how brightly). The backlights' colours differed from one
// generation to the next
const INK = '#484647'
// The screen's glass, set in the dark frame round it
const GLASS = 'inset 0 0 10px 2px rgba(77, 77, 77, 0.85)'

// The bare screen, its backlight off: a warm grey, readable by the light falling on it
const UNLIT = {
  background: 'linear-gradient(135deg, #a5a59b 0%, #d6d5d0 100%)',
  text: INK,
  muted: '#5e5c5b',
  bar: INK,
  track: 'rgba(72, 70, 71, 0.12)',
  highlight: INK,
  highlightText: '#afaea7',
  glow: GLASS,
  bulbs: 0,
}

// The parts every black and white screen shares
const MONO = {
  mono: true,
  text: INK,
  muted: '#5e5c5b',
  bar: INK,
  track: 'rgba(72, 70, 71, 0.12)',
  highlight: INK,
  unlit: UNLIT,
}

// 1st and 2nd generation: the grey screen lit a pale, cool white, brighter towards the bulbs at
// its edges, a ring of shadow inside the frame and a soft white bloom
const FUGLY = {
  ...MONO,
  background: 'linear-gradient(135deg, #b3bfd1 0%, #c7d2e4 45%, #d8e2f3 100%)',
  highlightText: '#b5c3d8',
  glow: `${GLASS}, inset 0 0 0 4px rgba(71, 71, 71, 0.55), inset 0 0 14px 7px rgba(255, 255, 255, 0.22)`,
  bulbs: 0.16,
}

// The later black and white screens, as in Apple's photos of them: a navy ink and highlight bar
const navy = (text, highlight) => ({
  text,
  bar: text,
  muted: text,
  highlight,
  track: 'rgba(30, 36, 72, 0.14)',
})

// 3rd generation: a muted, greyish blue, not as blue as the 4th generation's. Even across, as in
// Apple's photo, with a fine light edge inside the frame
const MUTED_BLUE = {
  ...MONO,
  ...navy('#1c1f45', '#1c2042'),
  background:
    'radial-gradient(ellipse 90% 80% at 50% 40%, #b2c3da 0%, #abbcd3 60%, #a3b4cc 100%)',
  highlightText: '#dfe6f0',
  glow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), inset 0 0 6px rgba(30, 40, 70, 0.3)',
  bulbs: 0.05,
}

// 4th generation: a cool periwinkle
const ICY = {
  ...MONO,
  ...navy('#1b2850', '#303c6a'),
  background:
    'radial-gradient(ellipse 90% 80% at 50% 35%, #d2dcf8 0%, #bfcdf2 50%, #a8b7dc 100%)',
  highlightText: '#e3e9fb',
  glow: `${GLASS}, inset 0 0 10px rgba(40, 70, 150, 0.3)`,
  bulbs: 0.1,
}

// The mini: a cool, pale blue. Its small screen showed the song and the artist playing, not the
// album
const MINI_LIGHT = {
  ...MONO,
  ...navy('#1e2348', '#383964'),
  background: 'linear-gradient(180deg, #c6d0e2 0%, #b4c0d5 100%)',
  highlightText: '#e6eaf3',
  glow: GLASS,
  bulbs: 0.08,
  noAlbum: true,
}

// Materials. "face" is the front: glossy plastic, brushed aluminium or clear acrylic. The polished
// steel back shows as a rim around the plastic fronts: "thin" on the 5th generation and the
// classics, where it shows only as a fine, dark edge in Apple's photos
const plastic = (top, bottom) => ({ kind: 'plastic', top, bottom })
// The 1st and 2nd generation, as Apple drew them for the iPod's 25th anniversary: white plastic
// greying towards the bottom left, a polished chrome rim, a raised ring of buttons catching the
// light, a finely textured scroll wheel set into it and a bordered centre button
const ANNIVERSARY = {
  face: { kind: 'plastic', top: '#f6f6f6', bottom: '#d6d6d6', diagonal: true },
  rim: 'chrome',
  windowFrame: '#525254',
  ring: {
    surface: ['#f4f4f4', '#e6e6e6'],
    label: '#898989',
    lower: true,
    raised: true,
  },
}
const aluminium = (light, base, dark, finish) => ({
  kind: 'aluminium',
  light,
  base,
  dark,
  finish,
})

// The 4th and 5th generation's wheels, their colours from Apple's photos: a cool grey wheel with
// white labels on the white iPods, a near black one with light labels on the black
const WHITE_WHEEL = {
  surface: ['#cfd3d6', '#bdc2c5'],
  label: '#ffffff',
  center: ['#f9fafa', '#eceef0'],
}
// The 4th generation's, lighter
const CLICK4_WHEEL = {
  surface: ['#e4e7e5', '#d4d7d6'],
  label: '#ffffff',
  center: ['#ffffff', '#eff0f1'],
}
const BLACK_WHEEL = {
  surface: ['#20262a', '#14191c'],
  label: '#d9dbdd',
  center: ['#0e1215', '#06090b'],
}
// The 5th generation's glossy plastic: greying towards the bottom left, the black with a faint
// blue in it. "reflection": as in Apple's photos, the room reflected in the right of its front,
// beyond a straight edge running from the top left to the bottom right, fading downwards: [where
// (0 the top, 1 the bottom), colour, opacity]
const GLOSS_WHITE = {
  kind: 'plastic',
  top: '#f6f7f8',
  bottom: '#c7cbce',
  diagonal: true,
  reflection: [
    [0, '#ffffff', 0.5],
    [0.6, '#ffffff', 0.3],
    [1, '#ffffff', 0.12],
  ],
}
const GLOSS_BLACK = {
  kind: 'plastic',
  top: '#080e10',
  bottom: '#04090b',
  diagonal: true,
  reflection: [
    [0, '#848e93', 1],
    [0.2, '#6d797e', 1],
    [0.39, '#495358', 1],
    [0.58, '#272d30', 1],
    [0.68, '#171c1d', 1],
    [0.77, '#0f1314', 1],
    [0.92, '#070d0f', 1],
  ],
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
    ...ANNIVERSARY,
    // Its mechanical scroll wheel turned, a fine grain on it
    wheel: {
      surface: ['#f1eeee', '#e4e4e4'],
      label: '#898989',
      center: ['#f2f2f2', '#c9c8c8'],
      border: '#7e7e7e',
      textured: true,
    },
  },
  {
    id: '2g',
    name: '2nd generation (2002)',
    group: 'classic',
    model: 'scroll',
    lcd: FUGLY,
    ...ANNIVERSARY,
    // Its touch wheel didn't turn: smooth, a little whiter
    wheel: {
      surface: ['#f6f5f5', '#ebebeb'],
      label: '#898989',
      center: ['#f4f4f4', '#cdcccc'],
      border: '#858585',
    },
  },
  {
    id: '3g',
    name: '3rd generation (2003)',
    group: 'classic',
    model: 'row',
    lcd: MUTED_BLUE,
    // A thick, rounded plastic front, a light grey, as in Apple's photo
    face: { ...plastic('#eceeec', '#d7dad8'), rounded: true },
    windowFrame: '#06090b',
    // Its buttons lit up red with the backlight, and were plain grey without it
    row: {
      surface: ['#e9ebe9', '#dee0de'],
      label: '#e8331e',
      unlitLabel: '#a7a9ae',
      glow: true,
    },
    // The wheel and its buttons, sunk into the front, the same plastic
    wheel: {
      surface: ['#e6e8e6', '#dcdedc'],
      label: '#9a9ca1',
      center: ['#e8eae8', '#dcdedc'],
      sunken: true,
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
    wheel: CLICK4_WHEEL,
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
    wheel: CLICK4_WHEEL,
  },
  {
    id: '5g-white',
    name: '5th generation, white (2005)',
    group: 'classic',
    model: 'click5',
    lcd: COLOR_LCD,
    face: GLOSS_WHITE,
    rim: 'thin',
    windowFrame: '#0b0b0c',
    wheel: WHITE_WHEEL,
  },
  {
    id: '5g-black',
    name: '5th generation, black (2005)',
    group: 'classic',
    model: 'click5',
    lcd: COLOR_LCD,
    face: GLOSS_BLACK,
    rim: 'thin',
    windowFrame: '#050506',
    wheel: BLACK_WHEEL,
  },
  {
    id: 'classic-silver',
    name: '6th/7th generation classic, silver (2007)',
    group: 'classic',
    model: 'classic',
    lcd: CLASSIC_LCD,
    face: aluminium('#ebebeb', '#d8d8d8', '#a2a2a2', 'satin'),
    rim: 'thin',
    windowFrame: '#0b0b0c',
    // A white wheel, grey labels, and a centre button of the front's aluminium, dished: in
    // shadow at the top, lit at the bottom
    wheel: {
      surface: ['#f8fbfc', '#f1f4f6'],
      label: '#9da8b3',
      center: ['#e0e0e0', '#b8b8b8'],
      dished: true,
    },
  },
  {
    id: 'classic6-black',
    name: '6th generation classic, black (2007)',
    group: 'classic',
    model: 'classic',
    lcd: CLASSIC_LCD,
    // A deep black front
    face: aluminium('#3c3b3e', '#262528', '#0d0d0e', 'satin'),
    rim: 'thin',
    windowFrame: '#050506',
    wheel: {
      surface: ['#161616', '#0b0b0b'],
      label: '#c9c9cb',
      center: ['#3a393b', '#1c1b1d'],
      dished: true,
    },
  },
  {
    id: 'classic-black',
    name: '7th generation classic, black (2009)',
    group: 'classic',
    model: 'classic',
    lcd: CLASSIC_LCD,
    // The 2008-2009 "black": space grey, lighter than the 6th generation's
    face: aluminium('#555356', '#434144', '#1d1d1e', 'satin'),
    rim: 'thin',
    windowFrame: '#050506',
    wheel: {
      surface: ['#232323', '#1a1a1b'],
      label: '#dcdcde',
      center: ['#5c5a5d', '#2e2d2e'],
      dished: true,
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
    wheel: CLICK4_WHEEL,
  },
  {
    id: '5g-u2',
    name: '5th generation U2 Special Edition (2006)',
    group: 'special',
    model: 'click5',
    lcd: COLOR_LCD,
    face: GLOSS_BLACK,
    rim: 'thin',
    windowFrame: '#050506',
    wheel: U2_WHEEL,
  },
  {
    id: 'red',
    name: 'Red, in the style of (PRODUCT)RED',
    group: 'special',
    model: 'classic',
    lcd: CLASSIC_LCD,
    face: aluminium('#d93444', '#c42132', '#a3172a', 'satin'),
    rim: 'thin',
    windowFrame: '#0b0b0c',
    wheel: {
      surface: ['#fbfbfb', '#efefef'],
      label: '#b6b8bc',
      center: ['#ececee', '#cfd1d5'],
      dished: true,
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
  '--lcd-accent': lcd.accent || lcd.bar,
  '--lcd-battery': lcd.battery || lcd.text,
  '--lcd-cover-filter': lcd.coverFilter || 'none',
  '--lcd-glow': lcd.glow || 'none',
  '--lcd-grid': lcd.grid || 'none',
  '--lcd-ghost': lcd.ghost || 'none',
  '--lcd-bulbs': String(lcd.bulbs || 0),
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
