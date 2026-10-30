// The iPods the phone player can look like (Personal settings): each generation's case, wheel and
// screen. The first iPods (1st to 4th generation, and the mini) had a black and white screen, so
// covers show in grey there.
//
// wheel: "click" (a click wheel, with MENU and the arrows printed on it), "ring" (1st and 2nd
// generation: a scroll or touch wheel, with four buttons around it) or "row" (3rd generation: four
// lit buttons in a row above a touch wheel)

// The screens
const COLOR_LCD = {
  background: 'linear-gradient(180deg, #e4ebef 0%, #cfd9e0 100%)',
  text: '#1c2630',
  muted: '#4c5964',
  bar: '#1c2630',
  track: 'rgba(28, 38, 48, 0.18)',
  highlight: 'linear-gradient(180deg, #4f8fd8 0%, #2d6cbf 100%)',
  highlightText: '#ffffff',
  coverFilter: 'none',
}
// 1st and 2nd generation: a grey-green screen with a white backlight
const MONO_GREEN = {
  background: 'linear-gradient(180deg, #cfd3c4 0%, #b8bda8 100%)',
  text: '#22261d',
  muted: '#4c5244',
  bar: '#22261d',
  track: 'rgba(34, 38, 29, 0.2)',
  highlight: '#2a2f24',
  highlightText: '#cfd3c4',
  coverFilter: 'grayscale(1) contrast(1.15) sepia(0.15)',
}
// 3rd and 4th generation and the mini: a grey screen with a bluish backlight
const MONO_BLUE = {
  background: 'linear-gradient(180deg, #d6dfe4 0%, #bdcad1 100%)',
  text: '#1c2830',
  muted: '#46545e',
  bar: '#1c2830',
  track: 'rgba(28, 40, 48, 0.2)',
  highlight: '#1c2830',
  highlightText: '#d6dfe4',
  coverFilter: 'grayscale(1) contrast(1.15)',
}

// Cases and wheels
const BRUSHED =
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, rgba(0,0,0,0.035) 1px 3px)'
const WHITE = {
  case: 'linear-gradient(180deg, #ffffff 0%, #eef0f2 55%, #dcdfe3 100%)',
  wheel: 'radial-gradient(circle at 50% 35%, #fbfbfc 0%, #e4e5e9 70%)',
  wheelEdge: 'rgba(0, 0, 0, 0.12)',
  center: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #ececef 80%)',
  label: '#9a9ca2',
}
const BLACK = {
  case: 'linear-gradient(180deg, #2c2c30 0%, #121214 100%)',
  wheel: 'radial-gradient(circle at 50% 35%, #2a2a2e 0%, #1a1a1d 70%)',
  wheelEdge: 'rgba(255, 255, 255, 0.08)',
  center: 'radial-gradient(circle at 50% 30%, #3a3a3f 0%, #232326 80%)',
  label: '#c9c9cf',
}

// An iPod mini in one of its anodized colours
const mini = (id, name, face, wheel, label) => ({
  id,
  name,
  group: 'mini',
  wheelType: 'click',
  lcd: MONO_BLUE,
  case: `${BRUSHED}, linear-gradient(160deg, ${face[0]} 0%, ${face[1]} 50%, ${face[2]} 100%)`,
  wheel: `radial-gradient(circle at 50% 35%, ${wheel[0]} 0%, ${wheel[1]} 75%)`,
  wheelEdge: 'rgba(0, 0, 0, 0.12)',
  center: `radial-gradient(circle at 50% 30%, ${face[0]} 0%, ${face[1]} 85%)`,
  label,
})

export const SKINS = [
  {
    id: '1g',
    name: '1st generation (2001)',
    group: 'classic',
    wheelType: 'ring',
    lcd: MONO_GREEN,
    ...WHITE,
    // The mechanical scroll wheel's grip
    wheel:
      'repeating-conic-gradient(from 0deg, #ecedef 0deg 3deg, #dcdde1 3deg 6deg)',
    ring: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #e9eaed 80%)',
  },
  {
    id: '2g',
    name: '2nd generation (2002)',
    group: 'classic',
    wheelType: 'ring',
    lcd: MONO_GREEN,
    ...WHITE,
    ring: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #e9eaed 80%)',
  },
  {
    id: '3g',
    name: '3rd generation (2003)',
    group: 'classic',
    wheelType: 'row',
    lcd: MONO_BLUE,
    ...WHITE,
    // Its buttons were lit red
    rowLabel: '#e5482b',
    rowButton: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #e6e7ea 85%)',
  },
  {
    id: '4g',
    name: '4th generation (2004)',
    group: 'classic',
    wheelType: 'click',
    lcd: MONO_BLUE,
    ...WHITE,
  },
  {
    id: 'photo',
    name: 'iPod Photo (2004)',
    group: 'classic',
    wheelType: 'click',
    lcd: COLOR_LCD,
    ...WHITE,
  },
  {
    id: '5g-white',
    name: '5th generation, white (2005)',
    group: 'classic',
    wheelType: 'click',
    lcd: COLOR_LCD,
    ...WHITE,
  },
  {
    id: '5g-black',
    name: '5th generation, black (2005)',
    group: 'classic',
    wheelType: 'click',
    lcd: COLOR_LCD,
    ...BLACK,
  },
  {
    id: 'classic-silver',
    name: '6th/7th generation classic, silver (2007)',
    group: 'classic',
    wheelType: 'click',
    lcd: COLOR_LCD,
    case: `${BRUSHED}, linear-gradient(160deg, #f1f2f4 0%, #c8cbd0 40%, #e6e8eb 60%, #b3b7bd 100%)`,
    wheel: 'radial-gradient(circle at 50% 35%, #e6e8eb 0%, #c9ccd1 75%)',
    wheelEdge: 'rgba(0, 0, 0, 0.15)',
    center: 'radial-gradient(circle at 50% 30%, #f4f5f7 0%, #d4d7db 85%)',
    label: '#6f737a',
  },
  {
    id: 'classic-black',
    name: '6th/7th generation classic, black (2009)',
    group: 'classic',
    wheelType: 'click',
    lcd: COLOR_LCD,
    case: `${BRUSHED}, linear-gradient(160deg, #4b4c50 0%, #2a2b2e 50%, #3b3c40 100%)`,
    wheel: 'radial-gradient(circle at 50% 35%, #2b2c30 0%, #18181b 75%)',
    wheelEdge: 'rgba(255, 255, 255, 0.1)',
    center: 'radial-gradient(circle at 50% 30%, #3b3c41 0%, #222327 85%)',
    label: '#a9abb1',
  },
  mini(
    'mini-silver',
    'mini, silver (2004)',
    ['#eceef0', '#c4c7cc', '#a9adb3'],
    ['#f2f3f5', '#d7d9dd'],
    '#8c9097',
  ),
  mini(
    'mini-gold',
    'mini, gold (2004)',
    ['#f0e2b8', '#d4b97a', '#b89a5a'],
    ['#f6ecd0', '#e2cf9c'],
    '#a68a4f',
  ),
  mini(
    'mini-pink',
    'mini, pink (2004)',
    ['#f6cfe0', '#e3a1bf', '#c97fa2'],
    ['#fae2ec', '#efc0d5'],
    '#b8738f',
  ),
  mini(
    'mini-blue',
    'mini, blue (2004)',
    ['#cfe2f4', '#93b9df', '#6f9cc9'],
    ['#e1edf8', '#bcd4ec'],
    '#5f88b4',
  ),
  mini(
    'mini-green',
    'mini, green (2004)',
    ['#dcefcd', '#a9d38e', '#86b96a'],
    ['#e8f5dd', '#c7e3b2'],
    '#73a35a',
  ),
  {
    id: 'transparent',
    name: 'Transparent',
    group: 'transparent',
    wheelType: 'click',
    lcd: COLOR_LCD,
    // A clear case over the circuit board, its gold traces, chips and battery
    case: [
      'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.14) 100%)',
      'radial-gradient(ellipse 22% 9% at 28% 63%, #2b2b2f 0 60%, transparent 62%)',
      'radial-gradient(ellipse 14% 6% at 74% 58%, #2b2b2f 0 60%, transparent 62%)',
      'linear-gradient(90deg, transparent 8%, #9c8a5d 8% 92%, transparent 92%) 0 86% / 100% 9% no-repeat',
      'repeating-linear-gradient(90deg, rgba(214,178,74,0.35) 0 2px, transparent 2px 26px)',
      'repeating-linear-gradient(0deg, rgba(214,178,74,0.22) 0 1px, transparent 1px 34px)',
      'linear-gradient(160deg, #22603f 0%, #184a30 60%, #123a26 100%)',
    ].join(', '),
    wheel:
      'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.22) 75%)',
    wheelEdge: 'rgba(255, 255, 255, 0.45)',
    center:
      'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 85%)',
    label: 'rgba(255, 255, 255, 0.92)',
    glass: true,
  },
  {
    id: '4g-u2',
    name: '4th generation U2 Special Edition (2004)',
    group: 'special',
    wheelType: 'click',
    lcd: MONO_BLUE,
    ...BLACK,
    wheel: 'radial-gradient(circle at 50% 35%, #e0283a 0%, #b30f22 75%)',
    center: 'radial-gradient(circle at 50% 30%, #2c2c30 0%, #151517 85%)',
    label: '#1a1a1a',
  },
  {
    id: '4g-hp',
    name: '4th generation Harry Potter (2005)',
    group: 'special',
    wheelType: 'click',
    lcd: COLOR_LCD,
    ...BLACK,
    wheel: 'radial-gradient(circle at 50% 35%, #46464b 0%, #2f2f33 75%)',
    label: '#d8d8dc',
  },
  {
    id: '5g-u2',
    name: '5th generation U2 Special Edition (2006)',
    group: 'special',
    wheelType: 'click',
    lcd: COLOR_LCD,
    ...BLACK,
    wheel: 'radial-gradient(circle at 50% 35%, #e0283a 0%, #b30f22 75%)',
    center: 'radial-gradient(circle at 50% 30%, #2c2c30 0%, #151517 85%)',
    label: '#1a1a1a',
  },
  {
    id: 'red',
    name: 'Red, in the style of (PRODUCT)RED',
    group: 'special',
    wheelType: 'click',
    lcd: COLOR_LCD,
    case: `${BRUSHED}, linear-gradient(160deg, #ea3445 0%, #c4142a 55%, #a30e21 100%)`,
    ...{
      wheel: WHITE.wheel,
      wheelEdge: WHITE.wheelEdge,
      center: WHITE.center,
      label: '#b4b6bb',
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

// The screen's colours, as the CSS variables the screen's styles read (see LCD in ipodLook)
export const lcdVars = (lcd) => ({
  '--lcd-bg': lcd.background,
  '--lcd-text': lcd.text,
  '--lcd-muted': lcd.muted,
  '--lcd-bar': lcd.bar,
  '--lcd-track': lcd.track,
  '--lcd-highlight': lcd.highlight,
  '--lcd-highlight-text': lcd.highlightText,
  '--lcd-cover-filter': lcd.coverFilter,
})
