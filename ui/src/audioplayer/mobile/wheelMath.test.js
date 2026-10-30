import { describe, it, expect } from 'vitest'
import { angleAt, angleDelta, onRing, ticks } from './wheelMath'

describe('wheelMath', () => {
  it('measures angles clockwise on screen', () => {
    expect(angleAt(0, 0, 10, 0)).toBe(0) // right
    expect(angleAt(0, 0, 0, 10)).toBe(90) // down
    expect(angleAt(0, 0, -10, 0)).toBe(180) // left
    expect(angleAt(0, 0, 0, -10)).toBe(-90) // up
  })

  it('takes the shortest turn, across the seam too', () => {
    expect(angleDelta(0, 30)).toBe(30) // clockwise
    expect(angleDelta(30, 0)).toBe(-30) // counter-clockwise
    expect(angleDelta(170, -170)).toBe(20) // clockwise across ±180°
    expect(angleDelta(-170, 170)).toBe(-20)
    expect(angleDelta(-90, 90)).toBe(180)
  })

  it('counts whole steps towards zero', () => {
    expect(ticks(0, 6)).toBe(0)
    expect(ticks(5.9, 6)).toBe(0)
    expect(ticks(6, 6)).toBe(1)
    expect(ticks(25, 6)).toBe(4)
    expect(ticks(-5, 6)).toBe(0)
    expect(ticks(-13, 6)).toBe(-2)
  })

  it('tells the ring from the centre button and the outside', () => {
    const at = (x, y) => onRing(100, 100, 100, x, y, 0.34)
    expect(at(100, 100)).toBe(false) // centre button
    expect(at(100, 120)).toBe(false) // still the centre button
    expect(at(100, 160)).toBe(true) // ring
    expect(at(100, 199)).toBe(true) // edge of the ring
    expect(at(100, 205)).toBe(false) // outside
  })
})
