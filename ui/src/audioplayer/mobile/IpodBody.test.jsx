import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { IpodBody } from './IpodBody'
import { lowResCover } from './IpodScreen'
import { skinFor } from './skins'

describe('<IpodBody />', () => {
  const rowButtons = (container) =>
    Array.from(container.querySelectorAll('g[data-lit]'))

  it("lights the 3rd generation's buttons red only while the backlight is on", () => {
    const skin = skinFor('3g')
    const { container, rerender } = render(<IpodBody skin={skin} lit />)
    expect(rowButtons(container)).toHaveLength(4)
    rowButtons(container).forEach((g) => {
      expect(g.getAttribute('fill')).toBe(skin.row.label)
      expect(g.getAttribute('filter')).toMatch(/glow/)
    })

    rerender(<IpodBody skin={skin} lit={false} />)
    rowButtons(container).forEach((g) => {
      expect(g.getAttribute('fill')).toBe(skin.row.unlitLabel)
      expect(g.getAttribute('filter')).toBeNull()
    })
  })

  it('draws the space grey classic in smooth anodized aluminium, not brushed', () => {
    const { container } = render(<IpodBody skin={skinFor('classic-black')} />)
    const filters = Array.from(container.querySelectorAll('rect[filter]')).map(
      (r) => r.getAttribute('filter'),
    )
    expect(filters.some((f) => /grain/.test(f))).toBe(true)
    expect(filters.some((f) => /brushed/.test(f))).toBe(false)
  })
})

describe('lowResCover', () => {
  it('asks the server for a small cover', () => {
    expect(lowResCover('/rest/getCoverArt?id=1&size=300&_=x')).toBe(
      '/rest/getCoverArt?id=1&size=72&_=x',
    )
    expect(lowResCover('/rest/getCoverArt?id=1')).toBe(
      '/rest/getCoverArt?id=1&size=72',
    )
    expect(lowResCover(undefined)).toBeUndefined()
  })
})
