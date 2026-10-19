import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslate } from 'react-admin'
import { Button, Paper, Popper, Portal, Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { httpClient } from '../dataProvider'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'
import { TOUR_VERSION, stepsToShow, tourTarget } from './steps'
import {
  START_TOUR_EVENT,
  TOUR_START_DELAY,
  TOUR_URL,
  TOUR_VERSION_KEY,
} from './tourEvents'

const PADDING = 6
export const MENU_OPEN_DELAY = 350

// Closes the menus the tour opened, the way a click outside them does
const closeMenus = () =>
  document
    .querySelectorAll('.MuiPopover-root .MuiBackdrop-root')
    .forEach((backdrop) => backdrop.click())

const useStyles = makeStyles((theme) => ({
  // Blocks the app while the tour shows; the spotlight is drawn on top
  blocker: {
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modal,
  },
  dim: { background: 'rgba(0, 0, 0, 0.6)' },
  // Above menus the tour opens, so they are dimmed too, except the lit-up item
  spotlight: {
    position: 'fixed',
    zIndex: theme.zIndex.modal + 1,
    borderRadius: 8,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
    pointerEvents: 'none',
    transition: 'all 250ms ease-in-out',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
  popper: { zIndex: theme.zIndex.modal + 2 },
  bubble: {
    width: 340,
    maxWidth: 'calc(100vw - 32px)',
    padding: theme.spacing(2),
    margin: theme.spacing(1.5),
  },
  centred: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: theme.zIndex.modal + 2,
    margin: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  grow: { flex: 1 },
}))

const readLocalVersion = () => {
  try {
    return parseInt(localStorage.getItem(TOUR_VERSION_KEY), 10) || 0
  } catch (e) {
    return 0
  }
}

const saveVersion = (version) => {
  try {
    localStorage.setItem(TOUR_VERSION_KEY, String(version))
  } catch (e) {
    // The server copy is enough
  }
  return httpClient(TOUR_URL, {
    method: 'PUT',
    body: JSON.stringify({ version }),
  }).catch(() => {})
}

// The version of the tour the user saw, from the server (so it follows them on any device)
const loadVersion = () =>
  httpClient(TOUR_URL)
    .then(({ json }) => Math.max(json?.version || 0, readLocalVersion()))
    .catch(() => readLocalVersion())

const rectOf = (el) => {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + 2 * PADDING,
    height: r.height + 2 * PADDING,
  }
}

// The UI tour: it lights up one feature at a time, with a bubble explaining it. It shows once per
// user (after the welcome dialog), and again from the user menu
export const Tour = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const [steps, setSteps] = useState([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const t = (key, opts) => translate(`tour.${key}`, opts)

  const open = steps.length > 0
  const step = steps[index]

  const show = useCallback(() => {
    setIndex(0)
    setSteps(stepsToShow())
  }, [])

  // First visit: wait for the welcome dialog, then show the steps the user hasn't seen
  useEffect(() => {
    let cancelled = false
    let timer
    const start = () => {
      timer = setTimeout(() => {
        loadVersion().then((seen) => {
          if (!cancelled && seen < TOUR_VERSION) show()
        })
      }, TOUR_START_DELAY)
    }
    let welcomeOpen = false
    try {
      welcomeOpen = localStorage.getItem('show-welcome') === 'true'
    } catch (e) {
      // No storage: no welcome dialog either
    }
    const onWelcomeClosed = () => start()
    if (welcomeOpen) {
      window.addEventListener(WELCOME_CLOSED_EVENT, onWelcomeClosed)
    } else {
      start()
    }
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener(WELCOME_CLOSED_EVENT, onWelcomeClosed)
    }
  }, [show])

  useEffect(() => {
    const onStart = () => show()
    window.addEventListener(START_TOUR_EVENT, onStart)
    return () => window.removeEventListener(START_TOUR_EVENT, onStart)
  }, [show])

  // Follows the step's element as the window resizes or scrolls. For a step inside a menu, opens
  // the menu first, and closes it when moving on
  useLayoutEffect(() => {
    if (!step?.target) {
      setRect(null)
      return
    }
    const update = () => {
      const el = tourTarget(step.target)
      setRect(el ? rectOf(el) : null)
    }
    let opened = null
    if (step.opens) {
      tourTarget(step.opens)?.querySelector('button')?.click()
      // Once the menu has appeared
      opened = setTimeout(update, MENU_OPEN_DELAY)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      if (step.opens) {
        clearTimeout(opened)
        // After React is done updating: a click during an update is ignored
        setTimeout(closeMenus, 0)
      }
    }
  }, [step])

  const finish = useCallback(() => {
    setSteps([])
    saveVersion(TOUR_VERSION)
  }, [])
  const next = useCallback(() => {
    if (index + 1 >= steps.length) finish()
    else setIndex(index + 1)
  }, [index, steps.length, finish])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, finish, next, back])

  // The bubble is anchored to the lit-up area
  const anchor = useMemo(
    () =>
      rect && {
        getBoundingClientRect: () => ({
          ...rect,
          right: rect.left + rect.width,
          bottom: rect.top + rect.height,
          x: rect.left,
          y: rect.top,
        }),
        clientWidth: rect.width,
        clientHeight: rect.height,
      },
    [rect],
  )

  if (!open || !step) return null

  const last = index === steps.length - 1
  const bubble = (
    <Paper
      elevation={8}
      role="dialog"
      aria-label={t(`steps.${step.key}.title`)}
      className={`${classes.bubble} ${anchor ? '' : classes.centred}`}
    >
      {steps.length > 1 && (
        <Typography variant="caption" color="textSecondary">
          {t('progress', { current: index + 1, total: steps.length })}
        </Typography>
      )}
      <Typography variant="subtitle1">
        {t(`steps.${step.key}.title`)}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {t(`steps.${step.key}.text`)}
      </Typography>
      <div className={classes.actions}>
        {!last && (
          <Button size="small" onClick={finish}>
            {t('skip')}
          </Button>
        )}
        <span className={classes.grow} />
        {index > 0 && (
          <Button size="small" onClick={back}>
            {t('back')}
          </Button>
        )}
        <Button size="small" variant="contained" color="primary" onClick={next}>
          {last ? t('done') : t('next')}
        </Button>
      </div>
    </Paper>
  )

  // In a portal, so the dimming covers the whole page whatever holds the tour
  return (
    <Portal>
      <div className={`${classes.blocker} ${anchor ? '' : classes.dim}`} />
      {anchor && (
        <div
          className={classes.spotlight}
          data-testid="tour-spotlight"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      {anchor ? (
        <Popper
          open
          anchorEl={anchor}
          placement="bottom"
          className={classes.popper}
          modifiers={{
            flip: { enabled: true },
            preventOverflow: { enabled: true, boundariesElement: 'viewport' },
          }}
        >
          {bubble}
        </Popper>
      ) : (
        bubble
      )}
    </Portal>
  )
}

export default Tour
