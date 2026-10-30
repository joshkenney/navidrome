import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { Marquee } from './Marquee'

// jsdom has no layout: give the text and its place a width
const layOut = (textWidth, placeWidth) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return textWidth
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return placeWidth
    },
  })
}

describe('<Marquee />', () => {
  afterEach(() => {
    delete HTMLElement.prototype.scrollWidth
    delete HTMLElement.prototype.clientWidth
  })

  it('scrolls back and forth a line too long for its place, as far as the overflow', () => {
    layOut(300, 200)
    render(<Marquee data-testid="m">The Blue Album (Deluxe Edition)</Marquee>)
    const m = screen.getByTestId('m')
    expect(m).toHaveAttribute('data-scrolling', 'true')
    expect(m.firstChild.style.getPropertyValue('--marquee-shift')).toBe(
      '-100px',
    )
  })

  it('stays still when the line fits', () => {
    layOut(150, 200)
    render(<Marquee data-testid="m">Buddy Holly</Marquee>)
    expect(screen.getByTestId('m')).not.toHaveAttribute('data-scrolling')
  })

  it('only scrolls when active, like the highlighted menu item', () => {
    layOut(300, 200)
    render(
      <Marquee data-testid="m" active={false}>
        A very long menu item
      </Marquee>,
    )
    expect(screen.getByTestId('m')).not.toHaveAttribute('data-scrolling')
  })
})
