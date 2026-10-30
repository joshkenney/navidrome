import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useImageUrl } from '../common/useImageUrl'
import { CountList } from './CountList'

vi.mock('../common/useImageUrl', () => ({ useImageUrl: vi.fn() }))
vi.mock('./useOpenItem', () => ({
  useOpenItem: () => ({ open: vi.fn(), play: vi.fn() }),
}))
vi.mock('react-admin', () => ({ useTranslate: () => (key) => key }))
vi.mock('../ipods/useIpodName', () => ({
  useIpodName: (id, name) => name,
}))

const requested = () => useImageUrl.mock.calls.map(([url]) => url)

describe('<CountList /> thumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('username', 'u')
    localStorage.setItem('subsonic-token', 't')
    localStorage.setItem('subsonic-salt', 's')
    useImageUrl.mockImplementation((url) => ({
      imgUrl: url ? `blob:${url}` : null,
    }))
  })

  it("shows each album's cover, by its album ID", () => {
    render(
      <CountList
        kind="album"
        items={[{ id: 'al1', name: 'Blue Album', updatedAt: '2026-01-01' }]}
      />,
    )
    expect(screen.getByTestId('thumb-album')).toBeInTheDocument()
    expect(requested()[0]).toMatch(/getCoverArt.*id=al-al1/)
    expect(requested()[0]).toMatch(/square=true/)
  })

  it("shows each song's cover, and each artist's picture", () => {
    render(
      <>
        <CountList kind="song" items={[{ id: 'mf1', name: 'Buddy Holly' }]} />
        <CountList kind="artist" items={[{ id: 'ar1', name: 'Weezer' }]} />
      </>,
    )
    const urls = requested()
    expect(urls.some((u) => /id=mf-mf1/.test(u))).toBe(true)
    expect(urls.some((u) => /id=ar-ar1/.test(u) && !/square/.test(u))).toBe(
      true,
    )
  })

  it('shows the iPod logo for iPods, without asking for a picture', () => {
    render(<CountList kind="ipod" items={[{ id: '2', name: "Bob's iPod" }]} />)
    expect(screen.getByTestId('thumb-ipod').querySelector('svg')).toBeTruthy()
    expect(requested()).toEqual([null])
  })

  it('keeps a placeholder while a picture loads', () => {
    useImageUrl.mockReturnValue({ imgUrl: null })
    render(<CountList kind="album" items={[{ id: 'al1', name: 'Blue' }]} />)
    expect(screen.getByTestId('thumb-album').querySelector('img')).toBeNull()
  })
})
