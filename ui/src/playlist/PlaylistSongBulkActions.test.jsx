import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RemoveFromPlaylistButton } from './PlaylistSongBulkActions'

const { deleteMany, notify, refresh, unselectAll } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
  unselectAll: vi.fn(),
}))

vi.mock('react-admin', () => ({
  Button: ({ label, onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
      {children}
    </button>
  ),
  useDataProvider: () => ({ deleteMany }),
  useNotify: () => notify,
  useRefresh: () => refresh,
  useUnselectAll: () => unselectAll,
  useListContext: () => ({ data: {} }),
}))

describe('RemoveFromPlaylistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes the selected songs at once, then refreshes the list', async () => {
    deleteMany.mockResolvedValue({ data: ['1', '3'] })
    const onRemoved = vi.fn()
    render(
      <RemoveFromPlaylistButton
        playlistId="pls1"
        selectedIds={['1', '3']}
        onRemoved={onRemoved}
      />,
    )
    fireEvent.click(screen.getByText('ra.action.remove'))
    expect(deleteMany).toHaveBeenCalledWith('playlist/pls1/tracks', {
      ids: ['1', '3'],
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith(
      'resources.playlist.message.songsRemoved',
      { type: 'info', messageArgs: { smart_count: 2 } },
    )
    expect(unselectAll).toHaveBeenCalledWith('playlistTrack')
    expect(onRemoved).toHaveBeenCalled()
  })

  it('tells when the server could not remove them, keeping the selection', async () => {
    deleteMany.mockRejectedValue(new Error('nope'))
    render(<RemoveFromPlaylistButton playlistId="pls1" selectedIds={['1']} />)
    fireEvent.click(screen.getByText('ra.action.remove'))
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('ra.notification.http_error', {
        type: 'warning',
      }),
    )
    expect(unselectAll).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('is disabled without a selection', () => {
    render(<RemoveFromPlaylistButton playlistId="pls1" selectedIds={[]} />)
    expect(
      screen.getByText('ra.action.remove').closest('button'),
    ).toBeDisabled()
  })
})
