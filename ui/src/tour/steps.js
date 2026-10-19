// The steps of the UI tour. Each one points at the element marked data-tour="<target>" (none: the
// step is centred), and is left out when that element isn't on screen. "since" is the tour version
// the step was added in: users who saw an older version only see the newer steps
export const TOUR_VERSION = 1

export const TOUR_STEPS = [
  { key: 'welcome', since: 1 },
  { key: 'ipodSelector', target: 'ipodSelector', since: 1 },
  { key: 'search', target: 'search', since: 1 },
  { key: 'facts', target: 'facts', since: 1 },
  { key: 'network', target: 'network', since: 1 },
  { key: 'shuffle', target: 'shuffle', since: 1 },
  { key: 'radio', target: 'radio', since: 1 },
  { key: 'nowPlaying', target: 'nowPlaying', since: 1 },
  { key: 'player', target: 'player', since: 1 },
  { key: 'userMenu', target: 'userMenu', since: 1 },
]

export const tourTarget = (target) =>
  target ? document.querySelector(`[data-tour="${target}"]`) : null

// A step can show when it is centred, or its element is on screen
export const isStepAvailable = (step) => {
  if (!step.target) return true
  const el = tourTarget(step.target)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

// The steps to show: all of them when replaying, otherwise those newer than the version seen
export const stepsToShow = (seenVersion, replay = false) =>
  TOUR_STEPS.filter(
    (step) => (replay || step.since > seenVersion) && isStepAvailable(step),
  )
