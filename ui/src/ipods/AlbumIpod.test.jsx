import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { AlbumIpod } from './AlbumIpod'
import subsonic from '../subsonic'
import config from '../config'

const redirect = vi.fn()

vi.mock('../subsonic', () => ({ default: { download: vi.fn() } }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key) => key,
  useRedirect: () => redirect,
}))

describe('<AlbumIpod />', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    config.enableDownloads = true
    store = createStore((state = {}, action) =>
      action.type === 'SET_SELECTED_LIBRARIES'
        ? { ...state, selected: action.data }
        : state,
    )
  })

  const renderAlbum = (record) =>
    render(
      <Provider store={store}>
        <AlbumIpod record={record} />
      </Provider>,
    )

  it("shows the album's iPod, which opens it", () => {
    renderAlbum({ libraryId: 3, libraryName: "Alice's iPod" })
    fireEvent.click(screen.getByText("Alice's iPod"))
    expect(store.getState().selected).toEqual([3])
    expect(redirect).toHaveBeenCalledWith('/album')
  })

  it('downloads the whole iPod after confirming', () => {
    renderAlbum({ libraryId: 3, libraryName: "Alice's iPod" })
    fireEvent.click(screen.getByLabelText('ipods.download.button'))
    expect(screen.getByText('ipods.download.warning')).toBeInTheDocument()
    expect(subsonic.download).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('ra.action.download'))
    expect(subsonic.download).toHaveBeenCalledWith('ipod-3')
  })

  it('hides the download when downloads are disabled', () => {
    config.enableDownloads = false
    renderAlbum({ libraryId: 3, libraryName: "Alice's iPod" })
    expect(screen.queryByLabelText('ipods.download.button')).toBeNull()
  })

  it('shows nothing when the iPod is unknown', () => {
    const { container } = renderAlbum({})
    expect(container.textContent).toBe('')
  })
})
