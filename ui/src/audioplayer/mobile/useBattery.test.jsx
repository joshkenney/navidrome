import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { useBattery } from './useBattery'

const Show = () => {
  const b = useBattery()
  return <span data-testid="b">{b ? `${b.level}:${b.charging}` : 'none'}</span>
}

// A phone's battery, as the Battery Status API gives it
const fakeBattery = (level, charging) => {
  const listeners = {}
  return {
    level,
    charging,
    addEventListener: (e, f) => (listeners[e] = f),
    removeEventListener: (e) => delete listeners[e],
    fire: (e) => listeners[e]?.(),
    listeners,
  }
}

describe('useBattery', () => {
  afterEach(() => {
    delete navigator.getBattery
  })

  it("follows the phone's battery, as it drains and charges", async () => {
    const battery = fakeBattery(0.64, false)
    navigator.getBattery = () => Promise.resolve(battery)
    render(<Show />)
    expect(await screen.findByText('0.64:false')).toBeInTheDocument()
    battery.level = 0.63
    act(() => battery.fire('levelchange'))
    expect(screen.getByText('0.63:false')).toBeInTheDocument()
    battery.charging = true
    act(() => battery.fire('chargingchange'))
    expect(screen.getByText('0.63:true')).toBeInTheDocument()
  })

  it('knows nothing where the phone keeps its battery to itself (iPhones)', () => {
    render(<Show />)
    expect(screen.getByTestId('b')).toHaveTextContent('none')
  })
})
