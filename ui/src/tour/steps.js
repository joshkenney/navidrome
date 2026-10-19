// The steps of the UI tour. Each one points at the element marked data-tour="<target>" (none: the
// step is centred), and is left out when that element isn't on screen. With "opens", the tour
// clicks that element's button first (a menu holding the target), and closes it afterwards.
//
// Every user sees the whole tour once, after logging in or opening the app: finishing or skipping it
// saves TOUR_VERSION for them, on the server. Raising it shows the tour to everyone again
export const TOUR_VERSION = 3

export const TOUR_STEPS = [
  { key: 'welcome' },
  { key: 'ipodSelector', target: 'ipodSelector' },
  { key: 'search', target: 'search' },
  { key: 'facts', target: 'facts' },
  { key: 'network', target: 'network' },
  { key: 'shuffle', target: 'shuffle' },
  { key: 'radio', target: 'radio' },
  { key: 'radioPage', target: 'radioPage' },
  { key: 'nowPlaying', target: 'nowPlaying' },
  { key: 'player', target: 'player' },
  // In the user menu, which the tour opens for it
  { key: 'takeTour', target: 'takeTour', opens: 'userMenu' },
]

export const tourTarget = (target) =>
  target ? document.querySelector(`[data-tour="${target}"]`) : null

// A step can show when it is centred, or its element is on screen
export const isStepAvailable = (step) => {
  if (!step.target) return true
  // A step inside a menu can show when the menu's button is on screen
  const el = tourTarget(step.opens || step.target)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

// The steps that can show now
export const stepsToShow = () => TOUR_STEPS.filter(isStepAvailable)
