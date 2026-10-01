import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { WelcomeDialog } from './WelcomeDialog'

describe('WelcomeDialog', () => {
  beforeEach(() => {
    localStorage.removeItem('show-welcome')
  })

  it('does not show without the login flag', () => {
    render(<WelcomeDialog />)
    expect(screen.queryByText(/Welcome to the iPod Repair NYC/)).toBeNull()
  })

  it('shows after login and clears the flag when closed', () => {
    localStorage.setItem('show-welcome', 'true')
    render(<WelcomeDialog />)
    expect(screen.getByText(/Welcome to the iPod Repair NYC/)).toBeTruthy()
    expect(screen.getByText('josh@ipodrepair.nyc').closest('a').href).toBe(
      'mailto:josh@ipodrepair.nyc',
    )

    fireEvent.click(screen.getByText('Start listening'))
    expect(localStorage.getItem('show-welcome')).toBeNull()
  })
})
