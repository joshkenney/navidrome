import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { IpodFront } from './IpodFront'
import * as pictures from './bodyPicture'
import { skinFor } from './skins'

describe('<IpodFront />', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // A box of a size, as the player gives it
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the front drawn ahead at once, as a picture', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(pictures, 'readyPicture').mockReturnValue(canvas)
    vi.spyOn(pictures, 'hasPicture').mockReturnValue(true)
    vi.spyOn(pictures, 'bodyPicture').mockResolvedValue(canvas)
    const { container } = render(<IpodFront skin={skinFor('classic-silver')} />)
    expect(container.querySelector('canvas')).toBe(canvas)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('shows the front without its filters until it is drawn, after the player has opened', async () => {
    const canvas = document.createElement('canvas')
    const draw = vi.spyOn(pictures, 'bodyPicture').mockResolvedValue(canvas)
    const { container } = render(<IpodFront skin={skinFor('classic-silver')} />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('svg [filter]')).toBeNull()
    expect(draw).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(draw).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBe(canvas)
  })

  it("shows the front as it is where it can't be drawn", async () => {
    vi.spyOn(pictures, 'bodyPicture').mockResolvedValue(null)
    const { container } = render(<IpodFront skin={skinFor('classic-silver')} />)
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('svg [filter]')).not.toBeNull()
  })
})
