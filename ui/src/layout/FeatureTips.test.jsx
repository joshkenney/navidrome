import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FeatureTips, HIDE_TIPS_KEY } from './FeatureTips'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useTranslate: () => (x) => x }
})

describe('<FeatureTips />', () => {
  let anchor

  beforeEach(() => {
    localStorage.clear()
    anchor = document.createElement('span')
    document.body.appendChild(anchor)
  })

  const renderTips = (props = {}) =>
    render(<FeatureTips anchorEl={anchor} showNowPlaying {...props} />)

  it('shows the three new features', () => {
    renderTips()
    expect(screen.getByText('featureTips.facts.title')).toBeInTheDocument()
    expect(screen.getByText('featureTips.ipods.title')).toBeInTheDocument()
    expect(screen.getByText('featureTips.nowPlaying.title')).toBeInTheDocument()
  })

  it('leaves out Now Playing when it is disabled', () => {
    renderTips({ showNowPlaying: false })
    expect(screen.queryByText('featureTips.nowPlaying.title')).toBeNull()
  })

  it('starts with the checkbox unchecked', () => {
    renderTips()
    expect(screen.getByLabelText('featureTips.dontShowAgain')).not.toBeChecked()
  })

  it('shows again next time when closed without the checkbox', () => {
    const { unmount } = renderTips()
    fireEvent.click(screen.getByText('featureTips.gotIt'))
    expect(screen.queryByText('featureTips.title')).toBeNull()
    expect(localStorage.getItem(HIDE_TIPS_KEY)).toBeNull()

    unmount()
    renderTips()
    expect(screen.getByText('featureTips.title')).toBeInTheDocument()
  })

  it('never shows again when the checkbox is ticked', () => {
    const { unmount } = renderTips()
    fireEvent.click(screen.getByLabelText('featureTips.dontShowAgain'))
    fireEvent.click(screen.getByText('featureTips.gotIt'))
    expect(localStorage.getItem(HIDE_TIPS_KEY)).toBe('true')

    unmount()
    renderTips()
    expect(screen.queryByText('featureTips.title')).toBeNull()
  })

  it('waits for the welcome dialog to be closed', () => {
    localStorage.setItem('show-welcome', 'true')
    renderTips()
    expect(screen.queryByText('featureTips.title')).toBeNull()

    act(() => {
      window.dispatchEvent(new Event(WELCOME_CLOSED_EVENT))
    })
    expect(screen.getByText('featureTips.title')).toBeInTheDocument()
  })
})
