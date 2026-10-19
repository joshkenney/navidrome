import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { burstHearts } from './heartBurst'

describe('burstHearts', () => {
  let button

  beforeEach(() => {
    vi.useFakeTimers()
    button = document.createElement('button')
    document.body.appendChild(button)
    Element.prototype.animate = vi.fn()
  })

  afterEach(() => {
    document
      .querySelectorAll('[data-testid="heart-burst"]')
      .forEach((el) => el.remove())
    vi.useRealTimers()
    delete Element.prototype.animate
    button.remove()
    window.matchMedia = undefined
  })

  it('sends a stream of hearts up from the element, then cleans up', () => {
    expect(burstHearts(button)).toBe(12)
    const layer = document.querySelector('[data-testid="heart-burst"]')
    expect(layer).not.toBeNull()
    expect(layer.querySelectorAll('svg')).toHaveLength(12)

    vi.advanceTimersByTime(2000)
    expect(document.querySelector('[data-testid="heart-burst"]')).toBeNull()
  })

  it('pops the button', () => {
    burstHearts(button)
    expect(Element.prototype.animate).toHaveBeenCalledWith(
      expect.arrayContaining([{ transform: 'scale(1.35)' }]),
      expect.anything(),
    )
  })

  it('stays still for people who prefer reduced motion', () => {
    window.matchMedia = () => ({ matches: true })
    expect(burstHearts(button)).toBe(0)
    expect(document.querySelector('[data-testid="heart-burst"]')).toBeNull()
  })

  it('does nothing without an element', () => {
    expect(burstHearts(null)).toBe(0)
  })
})
