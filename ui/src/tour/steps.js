// The steps of the UI tour. Each one points at the element marked data-tour="<target>" (none: the
// step is centred), and is left out when that element isn't on screen. With "opens", the tour
// clicks that element's button first (a menu holding the target), and closes it afterwards.
//
// Every user sees the whole tour once, after logging in or opening the app. Each step they see is
// remembered (on the server), so adding a feature to the tour is just adding its step here:
// everyone who hasn't seen it gets a short "What's new" tour of the new steps next time
export const TOUR_STEPS = [
  { key: 'welcome' },
  { key: 'ipodSelector', target: 'ipodSelector' },
  { key: 'search', target: 'search' },
  { key: 'facts', target: 'facts' },
  { key: 'essentials', target: 'facts' },
  { key: 'network', target: 'network' },
  { key: 'shuffle', target: 'shuffle' },
  { key: 'radio', target: 'radio' },
  { key: 'radioPage', target: 'radioPage' },
  { key: 'nowPlaying', target: 'nowPlaying' },
  { key: 'player', target: 'player' },
  // The phones' player (only on phones, with something playing)
  { key: 'clickWheel', target: 'mobilePlayer' },
  { key: 'timeline', target: 'timeline' },
  { key: 'holes', target: 'holes' },
  { key: 'eras', target: 'eras' },
  { key: 'replay', target: 'playlists' },
  { key: 'downloads' },
  { key: 'listeningMatch' },
  // In the user menu, which the tour opens for it
  { key: 'takeTour', target: 'takeTour', opens: 'userMenu' },
]

// Before steps were remembered one by one, the tour had a version number: users who saw its
// version 3 have seen these steps
export const TOUR_V3 = 3
export const TOUR_V3_KEYS = [
  'welcome',
  'ipodSelector',
  'search',
  'facts',
  'network',
  'shuffle',
  'radio',
  'radioPage',
  'nowPlaying',
  'player',
  'takeTour',
]

// The card opening a "What's new" tour, for users who saw the tour before
export const WHATS_NEW = { key: 'whatsNew' }

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

// What to show a user who saw the given steps: the whole tour the first time, then only the new
// steps that can show now, after a "What's new" card (nothing when there are none)
export const newStepsToShow = (seen) => {
  const available = stepsToShow()
  if (!seen.length) return available
  const fresh = available.filter((s) => !seen.includes(s.key))
  return fresh.length ? [WHATS_NEW, ...fresh] : []
}
