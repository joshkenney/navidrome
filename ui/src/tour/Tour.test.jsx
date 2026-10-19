import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MENU_OPEN_DELAY, Tour } from './Tour'
import {
  startTour,
  TOUR_START_DELAY,
  TOUR_URL,
  TOUR_VERSION_KEY,
} from './tourEvents'
import { TOUR_STEPS, TOUR_VERSION, stepsToShow } from './steps'
import { httpClient } from '../dataProvider'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) =>
    opts ? `${key}:${opts.current}/${opts.total}` : key,
}))

// The elements the tour points at, minus the player (nothing is playing)
const targets = TOUR_STEPS.map((s) => s.target).filter(
  (t) => t && t !== 'player',
)

// The user menu's button opens a menu holding "Take the tour"
const onMenu = vi.fn()
const Page = () => {
  const [menuOpen, setMenuOpen] = React.useState(false)
  return (
    <>
      {targets
        .filter((t) => t !== 'userMenu' && t !== 'takeTour')
        .map((t) => (
          <button key={t} data-tour={t}>
            {t}
          </button>
        ))}
      <span data-tour="userMenu">
        <button
          onClick={() => {
            onMenu('open')
            setMenuOpen(true)
          }}
        >
          user menu
        </button>
      </span>
      {menuOpen && (
        <div className="MuiPopover-root">
          <div
            className="MuiBackdrop-root"
            onClick={() => {
              onMenu('close')
              setMenuOpen(false)
            }}
          />
          <li data-tour="takeTour">take the tour</li>
        </div>
      )}
      <Tour />
    </>
  )
}

describe('<Tour />', () => {
  let savedVersion

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    savedVersion = 0
    httpClient.mockImplementation((url, options) => {
      if (options?.method === 'PUT') {
        savedVersion = JSON.parse(options.body).version
        return Promise.resolve({ json: { version: savedVersion } })
      }
      return Promise.resolve({ json: { version: savedVersion } })
    })
    // jsdom has no layout: give the marked elements a size
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        return this.dataset?.tour
          ? {
              top: 10,
              left: 10,
              width: 40,
              height: 40,
              right: 50,
              bottom: 50,
              x: 10,
              y: 10,
            }
          : {
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              right: 0,
              bottom: 0,
              x: 0,
              y: 0,
            }
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const waitForStart = async () => {
    await act(async () => {
      vi.advanceTimersByTime(TOUR_START_DELAY)
    })
    await act(async () => {})
  }
  const title = () => screen.getByRole('dialog').getAttribute('aria-label')

  it('shows on a first visit, one step at a time, leaving out what is not on screen', async () => {
    render(<Page />)
    await waitForStart()
    expect(title()).toBe('tour.steps.welcome.title')
    const total = TOUR_STEPS.length - 1 // The player isn't on screen
    expect(screen.getByText(`tour.progress:1/${total}`)).toBeInTheDocument()

    fireEvent.click(screen.getByText('tour.next'))
    expect(title()).toBe('tour.steps.ipodSelector.title')
    expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument()
    fireEvent.click(screen.getByText('tour.back'))
    expect(title()).toBe('tour.steps.welcome.title')

    for (let i = 1; i < total; i++) {
      fireEvent.click(screen.getByText('tour.next'))
    }
    expect(title()).toBe('tour.steps.takeTour.title')
    expect(screen.queryByText('tour.skip')).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByText('tour.done'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(savedVersion).toBe(TOUR_VERSION)
  })

  it('opens the user menu to show "Take the tour", and closes it after', async () => {
    render(<Page />)
    await waitForStart()
    while (title() !== 'tour.steps.takeTour.title') {
      fireEvent.click(screen.getByText('tour.next'))
    }
    expect(onMenu).toHaveBeenLastCalledWith('open')
    await act(async () => {
      vi.advanceTimersByTime(MENU_OPEN_DELAY)
    })
    expect(screen.getByText('take the tour')).toBeInTheDocument()
    expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument()

    fireEvent.click(screen.getByText('tour.back'))
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(onMenu).toHaveBeenLastCalledWith('close')
    expect(screen.queryByText('take the tour')).toBeNull()
  })

  it('shows to people who saw an older version of the tour', async () => {
    savedVersion = TOUR_VERSION - 1
    render(<Page />)
    await waitForStart()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('is remembered when skipped, with Esc too', async () => {
    render(<Page />)
    await waitForStart()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(httpClient).toHaveBeenCalledWith(TOUR_URL, {
      method: 'PUT',
      body: JSON.stringify({ version: TOUR_VERSION }),
    })
    expect(localStorage.getItem(TOUR_VERSION_KEY)).toBe(String(TOUR_VERSION))
  })

  it('moves with the arrow keys', async () => {
    render(<Page />)
    await waitForStart()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(title()).toBe('tour.steps.ipodSelector.title')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(title()).toBe('tour.steps.welcome.title')
  })

  it('does not show again once seen, but can be replayed', async () => {
    savedVersion = TOUR_VERSION
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => startTour())
    expect(title()).toBe('tour.steps.welcome.title')
  })

  it('waits for the welcome dialog to close', async () => {
    localStorage.setItem('show-welcome', 'true')
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => {
      window.dispatchEvent(new Event(WELCOME_CLOSED_EVENT))
    })
    await waitForStart()
    expect(title()).toBe('tour.steps.welcome.title')
  })

  it('uses the version saved in the browser when the server is unreachable', async () => {
    localStorage.setItem(TOUR_VERSION_KEY, String(TOUR_VERSION))
    httpClient.mockRejectedValue(new Error('offline'))
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('stepsToShow', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button data-tour="search"></button>'
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 10,
      height: 10,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('leaves out the steps whose element is not on screen', () => {
    const keys = stepsToShow().map((s) => s.key)
    expect(keys).toEqual(['welcome', 'search'])
  })
})
