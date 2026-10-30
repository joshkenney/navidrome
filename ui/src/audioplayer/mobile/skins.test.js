import { describe, it, expect } from 'vitest'
import {
  AUTO_SKIN,
  MODELS,
  SKINS,
  SKIN_GROUPS,
  lcdVars,
  modelOf,
  screenOf,
  skinFor,
} from './skins'

describe('skins', () => {
  it('describes every iPod completely', () => {
    const ids = new Set()
    SKINS.forEach((s) => {
      expect(ids.has(s.id)).toBe(false)
      ids.add(s.id)
      expect(SKIN_GROUPS).toContain(s.group)
      expect(MODELS[s.model], `${s.id} model`).toBeTruthy()
      expect(['plastic', 'aluminium', 'clear']).toContain(s.face.kind)
      expect(s.wheel.surface).toHaveLength(2)
      expect(s.wheel.center).toHaveLength(2)
      expect(s.wheel.label).toBeTruthy()
      if (modelOf(s).controls === 'ring') expect(s.ring).toBeTruthy()
      if (modelOf(s).controls === 'row') expect(s.row).toBeTruthy()
      Object.values(lcdVars(s.lcd)).forEach((v) =>
        expect(v, `${s.id} screen`).toBeTruthy(),
      )
    })
  })

  it("keeps every model's screen above its wheel and buttons, inside the front", () => {
    Object.entries(MODELS).forEach(([name, m]) => {
      const screenBottom = m.window.y + m.window.h
      const wheelTop = m.wheel.cy - m.wheel.d / 2
      const tops = [wheelTop]
      if (m.ring) tops.push(m.ring.cy - m.ring.d / 2)
      if (m.row) tops.push(m.row.cy - m.row.d / 2)
      tops.forEach((top) => expect(top, name).toBeGreaterThan(screenBottom))
      // The screen inside its glass, the glass and the wheel inside the front
      expect(m.lcd.x).toBeGreaterThanOrEqual(m.window.x)
      expect(m.lcd.y).toBeGreaterThanOrEqual(m.window.y)
      expect(m.lcd.x + m.lcd.w).toBeLessThanOrEqual(m.window.x + m.window.w)
      expect(m.lcd.y + m.lcd.h).toBeLessThanOrEqual(screenBottom)
      expect(m.window.x + m.window.w).toBeLessThan(m.w)
      const outer = m.ring || m.wheel
      expect(outer.cy + outer.d / 2, name).toBeLessThan(m.h)
      expect(outer.d, name).toBeLessThan(m.w)
    })
  })

  it('has every generation, the minis, the transparent one and the special editions', () => {
    const ids = SKINS.map((s) => s.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        '1g',
        '2g',
        '3g',
        '4g',
        'photo',
        '5g-white',
        '5g-black',
        'classic-silver',
        'classic-black',
        'classic6-black',
        'mini-silver',
        'mini-gold',
        'mini-pink',
        'mini-blue',
        'mini-green',
        'mini2-pink',
        'mini2-blue',
        'mini2-green',
        'transparent',
        '4g-u2',
        '4g-hp',
        '5g-u2',
        'red',
      ]),
    )
  })

  it('gives the first iPods black and white screens: text only, and each generation its backlight', () => {
    const mono = ['1g', '2g', '3g', '4g', '4g-u2', 'mini-pink']
    mono.forEach((id) => {
      const lcd = skinFor(id).lcd
      expect(lcd.mono, id).toBe(true)
      expect(lcd.unlit, `${id} without its backlight`).toBeTruthy()
    })
    ;['photo', '4g-hp', '5g-black', 'classic-silver'].forEach((id) =>
      expect(skinFor(id).lcd.mono, id).toBeFalsy(),
    )
    const rgb = (css, i = 1) => {
      const hex = css.match(/#[0-9a-f]{6}/gi)[i]
      return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
    }
    // 1st and 2nd generation, after Apple's 25th-anniversary iPod: a pale, cool white, its bulbs
    // glowing at the edges, in a warm dark grey ink
    const fugly = skinFor('1g').lcd
    expect(fugly).toBe(skinFor('2g').lcd)
    const [fr, fg, fb] = rgb(fugly.background, 2)
    expect(fb).toBeGreaterThan(fr)
    expect(Math.min(fr, fg, fb)).toBeGreaterThan(190)
    expect(fugly.bulbs).toBeGreaterThan(0)
    // Every black and white screen: Apple's ink, the same warm grey unlit, the bulbs off then
    mono.forEach((id) => {
      const lcd = skinFor(id).lcd
      expect(lcd.text, id).toBe('#484647')
      expect(lcd.highlight, id).toBe('#484647')
      expect(lcd.bulbs, id).toBeGreaterThan(0)
      expect(lcd.unlit.background, id).toMatch(/#a5a59b.*#d6d5d0/)
      expect(screenOf(lcd, false).bulbs, id).toBe(0)
    })
    expect(skinFor('mini-pink').lcd.noAlbum).toBe(true)
    expect(skinFor('4g').lcd.noAlbum).toBeFalsy()
    // Its body: Apple's proportions, a chrome rim
    expect(MODELS.scroll.r).toBeCloseTo(5.7, 1)
    expect(skinFor('1g').rim).toBe('chrome')
    // 3rd generation: a muted blue; 4th: a stronger blue
    const [mr, , mb] = rgb(skinFor('3g').lcd.background)
    const [ir, , ib] = rgb(skinFor('4g').lcd.background)
    expect(mb).toBeGreaterThan(mr)
    expect(ib - ir).toBeGreaterThan(mb - mr)
  })

  it('gives the iPod Photo small, grainy covers and the classic covers in perspective', () => {
    ;['photo', '4g-hp'].forEach((id) =>
      expect(skinFor(id).lcd.cover, id).toBe('lowRes'),
    )
    ;['classic-silver', 'classic-black', 'classic6-black', 'red'].forEach(
      (id) => expect(skinFor(id).lcd.cover, id).toBe('tilt'),
    )
    ;['5g-white', '5g-black', 'transparent'].forEach((id) =>
      expect(skinFor(id).lcd.cover, id).toBeUndefined(),
    )
  })

  it('gives the colour screens an aqua bar, a deeper blue on the classic, and a green battery', () => {
    const hue = (hex) => {
      const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
      return { r, g, b }
    }
    // Aqua: green and blue both high, red low
    ;['photo', '5g-white', '5g-black'].forEach((id) => {
      const { r, g, b } = hue(skinFor(id).lcd.accent)
      expect(g, id).toBeGreaterThan(r + 100)
      expect(b, id).toBeGreaterThan(r + 100)
    })
    // Deep blue: blue well above green
    ;['classic-silver', 'classic-black', 'classic6-black'].forEach((id) => {
      const { g, b } = hue(skinFor(id).lcd.accent)
      expect(b, id).toBeGreaterThan(g + 80)
    })
    ;['photo', '5g-white', 'classic-black'].forEach((id) =>
      expect(lcdVars(skinFor(id).lcd)['--lcd-battery'], id).toMatch(/#63d13a/),
    )
    // The black and white screens keep a battery in their text's colour
    expect(lcdVars(skinFor('4g').lcd)['--lcd-battery']).toBe(
      skinFor('4g').lcd.text,
    )
  })

  it('makes the 6th generation classic a deeper black than the 7th', () => {
    const light = (hex) =>
      [1, 3, 5].reduce((sum, k) => sum + parseInt(hex.slice(k, k + 2), 16), 0)
    expect(light(skinFor('classic6-black').face.base)).toBeLessThan(
      light(skinFor('classic-black').face.base) - 60,
    )
  })

  it("gives the 2nd generation minis brighter colours, the wheel's labels in them, and no gold", () => {
    const minis2 = SKINS.filter((s) => s.id.startsWith('mini2-'))
    expect(minis2.map((s) => s.id)).toEqual([
      'mini2-pink',
      'mini2-blue',
      'mini2-green',
    ])
    minis2.forEach((s) => {
      expect(s.group).toBe('mini')
      expect(s.wheel.label).not.toBe(skinFor('mini-pink').wheel.label)
    })
    const saturation = (hex) => {
      const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
      return Math.max(r, g, b) - Math.min(r, g, b)
    }
    ;['pink', 'blue', 'green'].forEach((c) =>
      expect(saturation(skinFor(`mini2-${c}`).face.base)).toBeGreaterThan(
        saturation(skinFor(`mini-${c}`).face.base),
      ),
    )
    // Squarer corners than the other iPods
    expect(MODELS.mini.r).toBeLessThan(MODELS.click5.r / 2)
  })

  it('turns the black and white screens grey when their backlight goes out, and only them', () => {
    const lcd = skinFor('3g').lcd
    expect(screenOf(lcd, true)).toBe(lcd)
    expect(screenOf(lcd, false).background).toBe(lcd.unlit.background)
    const color = skinFor('5g-white').lcd
    expect(screenOf(color, false)).toBe(color)
  })

  it('matches the theme when none is chosen: black on dark themes, white on light ones', () => {
    expect(skinFor(AUTO_SKIN, { palette: { type: 'dark' } }).id).toBe(
      '5g-black',
    )
    expect(skinFor(AUTO_SKIN, { palette: { type: 'light' } }).id).toBe(
      '5g-white',
    )
    expect(skinFor(undefined, { palette: { type: 'dark' } }).id).toBe(
      '5g-black',
    )
    expect(skinFor('gone', { palette: { type: 'light' } }).id).toBe('5g-white')
  })
})
