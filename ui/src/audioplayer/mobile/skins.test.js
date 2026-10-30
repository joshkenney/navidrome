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
        'mini-silver',
        'mini-gold',
        'mini-pink',
        'mini-blue',
        'mini-green',
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
    // 1st and 2nd generation: an uneven mint glow, its pixel grid and smeared text
    const fugly = skinFor('1g').lcd
    expect(fugly).toBe(skinFor('2g').lcd)
    expect(fugly.background).toMatch(/radial-gradient/)
    expect(fugly.grid).toBeTruthy()
    expect(fugly.ghost).toBeTruthy()
    // 3rd generation: warm amber; 4th: bluish
    const warm = skinFor('3g').lcd.background
    const icy = skinFor('4g').lcd.background
    const rgb = (css) => {
      const hex = css.match(/#[0-9a-f]{6}/gi)[1]
      return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    }
    const [wr, , wb] = rgb(warm)
    const [ir, , ib] = rgb(icy)
    expect(wr).toBeGreaterThan(wb + 60)
    expect(ib).toBeGreaterThan(ir + 20)
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
