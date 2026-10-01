import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PathField } from './PathField'
import { usePermissions, useRecordContext, useRedirect } from 'react-admin'
import config from '../config'

// Mock react-admin hooks
vi.mock('react-admin', () => ({
  usePermissions: vi.fn(),
  useRecordContext: vi.fn(),
  useRedirect: vi.fn(),
}))

// Mock config
vi.mock('../config', () => ({
  default: {
    separator: '/',
  },
}))

describe('PathField', () => {
  const redirect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useRedirect.mockReturnValue(redirect)
  })

  it('renders path without libraryPath for non-admin users', () => {
    // Setup
    usePermissions.mockReturnValue({ permissions: 'user' })
    useRecordContext.mockReturnValue({
      path: 'music/song.mp3',
      libraryPath: '/data/media',
    })

    // Act
    const { container } = render(<PathField />)

    // Assert
    expect(container.textContent).toBe('music/song.mp3')
    expect(container.textContent).not.toContain('/data/media')
  })

  it('renders combined path for admin users when libraryPath does not end with separator', () => {
    // Setup
    usePermissions.mockReturnValue({ permissions: 'admin' })
    useRecordContext.mockReturnValue({
      path: 'music/song.mp3',
      libraryPath: '/data/media',
    })

    // Act
    const { container } = render(<PathField />)

    // Assert
    expect(container.textContent).toBe('/data/media/music/song.mp3')
  })

  it('renders combined path for admin users when libraryPath ends with separator', () => {
    // Setup
    usePermissions.mockReturnValue({ permissions: 'admin' })
    useRecordContext.mockReturnValue({
      path: 'music/song.mp3',
      libraryPath: '/data/media/',
    })

    // Act
    const { container } = render(<PathField />)

    // Assert
    expect(container.textContent).toBe('/data/media/music/song.mp3')
  })

  it('works with a different separator from config', () => {
    // Setup
    config.separator = '\\'
    usePermissions.mockReturnValue({ permissions: 'admin' })
    useRecordContext.mockReturnValue({
      path: 'music\\song.mp3',
      libraryPath: 'C:\\data',
    })

    // Act
    const { container } = render(<PathField />)

    // Assert
    expect(container.textContent).toBe('C:\\data\\music\\song.mp3')
  })

  it('browses to the folder when the record has a folderId', () => {
    config.separator = '/'
    usePermissions.mockReturnValue({ permissions: 'user' })
    useRecordContext.mockReturnValue({
      path: 'music/song.mp3',
      folderId: 'folder-1',
    })

    render(<PathField />)
    const button = screen.getByRole('button')
    expect(button.disabled).toBe(false)

    fireEvent.click(button)
    expect(redirect).toHaveBeenCalledWith('show', '/folder', 'folder-1')
  })

  it('disables the browse button when the record has no folderId', () => {
    config.separator = '/'
    usePermissions.mockReturnValue({ permissions: 'user' })
    useRecordContext.mockReturnValue({ path: 'music/song.mp3' })

    render(<PathField />)
    const button = screen.getByRole('button')
    expect(button.disabled).toBe(true)

    fireEvent.click(button)
    expect(redirect).not.toHaveBeenCalled()
  })
})
