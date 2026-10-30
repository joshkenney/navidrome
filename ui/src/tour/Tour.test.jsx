import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MENU_OPEN_DELAY, Tour } from './Tour'
import {
  startTour,
  TOUR_SEEN_KEY,
  TOUR_START_DELAY,
  TOUR_URL,
  TOUR_VERSION_KEY,
} from './tourEvents'
import { TOUR_STEPS, TOUR_V3_KEYS, stepsToShow } from './steps'
import { httpClient } from '../dataProvider'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

vi.mock('react-admin', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslate: () => (key, opts) =>
    opts ? `${key}:${opts.current}/${opts.total}` : key,
}))

// The elements the tour points at, minus the players (nothing is playing, on a computer)
const OFF_SCREEN = ['player', 'mobilePlayer']
const targets = [
  ...new Set(TOUR_STEPS.map((s) => s.target).filter(Boolean)),
].filter((t) => !OFF_SCREEN.includes(t))
// The steps shown on this page, and the ones added after the tour's version 3
const onScreen = TOUR_STEPS.filter((s) => !OFF_SCREEN.includes(s.target)).map(
  (s) => s.key,
)
const addedSinceV3 = onScreen.filter((k) => !TOUR_V3_KEYS.includes(k))

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
  // What the server remembers: the version of the tour seen (older UIs), and the steps seen
  let savedVersion
  let savedSeen

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    savedVersion = 0
    savedSeen = []
    httpClient.mockImplementation((url, options) => {
      if (options?.method === 'PUT') {
        const { seen = [] } = JSON.parse(options.body)
        savedSeen = [...new Set([...savedSeen, ...seen])]
      }
      return Promise.resolve({
        json: { version: savedVersion, seen: savedSeen },
      })
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
    const total = onScreen.length // The players aren't on screen
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
    expect(savedSeen.sort()).toEqual([...onScreen].sort())
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

  it("shows people who saw the tour before only what's new, after a welcome back", async () => {
    savedVersion = 3 // Seen before steps were remembered one by one
    render(<Page />)
    await waitForStart()
    expect(title()).toBe('tour.steps.whatsNew.title')
    const shown = []
    for (let i = 0; i < addedSinceV3.length; i++) {
      fireEvent.click(screen.getByText('tour.next'))
      shown.push(title().replace(/^tour\.steps\.|\.title$/g, ''))
    }
    expect(shown).toEqual(addedSinceV3)
    await act(async () => {
      fireEvent.click(screen.getByText('tour.done'))
    })
    // Remembered without the welcome-back card
    expect(savedSeen.sort()).toEqual([...addedSinceV3].sort())
  })

  it('shows nothing when no step is new', async () => {
    savedSeen = [...onScreen]
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits for a new step to be on screen, without remembering it until then', async () => {
    // Only the phone player's step is new, and nothing plays on a phone here
    savedSeen = [...onScreen, 'player']
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(savedSeen).not.toContain('clickWheel')
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
      body: JSON.stringify({ seen: onScreen }),
    })
    expect(JSON.parse(localStorage.getItem(TOUR_SEEN_KEY)).sort()).toEqual(
      [...onScreen].sort(),
    )
  })

  it('moves with the arrow keys', async () => {
    render(<Page />)
    await waitForStart()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(title()).toBe('tour.steps.ipodSelector.title')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(title()).toBe('tour.steps.welcome.title')
  })

  it('does not show again once seen, but can be replayed whole', async () => {
    savedSeen = [...onScreen]
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

  it('uses the steps saved in the browser when the server is unreachable', async () => {
    localStorage.setItem(TOUR_SEEN_KEY, JSON.stringify(onScreen))
    httpClient.mockRejectedValue(new Error('offline'))
    render(<Page />)
    await waitForStart()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("counts the version an older UI saved in the browser, showing only what's new", async () => {
    localStorage.setItem(TOUR_VERSION_KEY, '3')
    httpClient.mockRejectedValue(new Error('offline'))
    render(<Page />)
    await waitForStart()
    expect(title()).toBe('tour.steps.whatsNew.title')
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
    // The centred steps always show
    expect(keys).toEqual(['welcome', 'search', 'downloads', 'listeningMatch'])
  })
})
