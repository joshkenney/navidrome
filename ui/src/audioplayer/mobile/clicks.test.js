import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { click, resetClicks, setClicks } from './clicks'
import { buzz, resetHaptics } from './haptics'

// A stand-in for Web Audio: a clock to move, and a record of the clicks started
const fakeAudio = () => {
  const started = []
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  })
  class FakeContext {
    constructor() {
      this.currentTime = 0
      this.sampleRate = 8000
      this.state = 'running'
      this.destination = {}
      FakeContext.last = this
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) }
    }
    createBufferSource() {
      return {
        connect: vi.fn(),
        start: (at) => started.push(at),
        stop: vi.fn(),
      }
    }
    createBiquadFilter() {
      return { connect: vi.fn(), frequency: param(), Q: param() }
    }
    createGain() {
      return { connect: vi.fn(), gain: param() }
    }
  }
  return { FakeContext, started }
}

describe('click', () => {
  let audio
  beforeEach(() => {
    resetClicks()
    resetHaptics()
    audio = fakeAudio()
    window.AudioContext = audio.FakeContext
  })
  afterEach(() => {
    delete window.AudioContext
  })

  it('makes a click, and queues fast ones at most every 50ms', () => {
    click('tick')
    click('tick')
    click('tick')
    expect(audio.started).toEqual([0, 0.05, 0.1])
    // Too many waiting: dropped
    click('tick')
    expect(audio.started).toHaveLength(3)
    audio.FakeContext.last.currentTime = 1
    click('tick')
    expect(audio.started[3]).toBe(1)
  })

  it('clicks twice for a long press', () => {
    click('hold')
    expect(audio.started).toHaveLength(2)
  })

  it('is silent when turned off', () => {
    setClicks(false)
    click('press')
    buzz('press')
    expect(audio.started).toHaveLength(0)
  })

  it('clicks with every buzz of the wheel', () => {
    buzz('tick')
    expect(audio.started).toHaveLength(1)
  })

  it('does nothing where there is no Web Audio', () => {
    delete window.AudioContext
    expect(() => click('press')).not.toThrow()
  })
})
