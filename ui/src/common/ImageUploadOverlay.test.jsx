import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageUploadOverlay } from './ImageUploadOverlay'
import { httpClient } from '../dataProvider'

vi.mock('../dataProvider', () => ({
  httpClient: vi.fn(() => Promise.resolve({})),
}))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useNotify: () => vi.fn(),
  useRefresh: () => vi.fn(),
}))

describe('<ImageUploadOverlay /> for albums', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('role', 'admin')
  })

  it('uploads an album cover', async () => {
    const { container } = render(
      <ImageUploadOverlay entityType="album" entityId="al-1" />,
    )
    const file = new File(['img'], 'cover.png', { type: 'image/png' })
    fireEvent.change(container.querySelector('input[type=file]'), {
      target: { files: [file] },
    })
    await waitFor(() => expect(httpClient).toHaveBeenCalled())
    expect(httpClient.mock.calls[0][0]).toBe('/api/album/al-1/image')
    expect(httpClient.mock.calls[0][1].method).toBe('POST')
  })

  it('offers to remove a cover only when the album has one', async () => {
    const { rerender } = render(
      <ImageUploadOverlay entityType="album" entityId="al-1" />,
    )
    expect(screen.queryByLabelText('message.removeCover')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(1)

    rerender(
      <ImageUploadOverlay
        entityType="album"
        entityId="al-1"
        hasUploadedImage
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[1])
    await waitFor(() =>
      expect(httpClient).toHaveBeenCalledWith('/api/album/al-1/image', {
        method: 'DELETE',
      }),
    )
  })

  it('is hidden from regular users when only admins can change the image', () => {
    localStorage.setItem('role', 'regular')
    const { container } = render(
      <ImageUploadOverlay entityType="album" entityId="al-1" adminOnly />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
