import { describe, it, expect } from 'vitest'
import { AUTO_SKIN, SKINS, SKIN_GROUPS, lcdVars, skinFor } from './skins'

describe('skins', () => {
  it('describes every iPod completely', () => {
    const ids = new Set()
    SKINS.forEach((s) => {
      expect(ids.has(s.id)).toBe(false)
      ids.add(s.id)
      expect(SKIN_GROUPS).toContain(s.group)
      expect(['click', 'ring', 'row']).toContain(s.wheelType)
      ;['case', 'wheel', 'wheelEdge', 'center', 'label'].forEach((k) =>
        expect(s[k], `${s.id}.${k}`).toBeTruthy(),
      )
      Object.values(lcdVars(s.lcd)).forEach((v) =>
        expect(v, `${s.id} screen`).toBeTruthy(),
      )
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

  it('gives the first iPods a black and white screen, with covers in grey', () => {
    ;['1g', '2g', '3g', '4g', 'mini-pink'].forEach((id) =>
      expect(lcdVars(skinFor(id).lcd)['--lcd-cover-filter']).toMatch(
        /grayscale/,
      ),
    )
    ;['photo', '5g-black', 'classic-silver'].forEach((id) =>
      expect(lcdVars(skinFor(id).lcd)['--lcd-cover-filter']).toBe('none'),
    )
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
