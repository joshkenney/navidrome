// Shared by the tour and what starts it (the user menu)
export const TOUR_URL = '/api/ipods/tour'
export const START_TOUR_EVENT = 'nd-start-tour'
// Where the steps seen are kept when the server can't be reached (and where an older UI kept
// the version of the tour seen)
export const TOUR_SEEN_KEY = 'tour-seen'
export const TOUR_VERSION_KEY = 'tour-version'
// Leaves the app time to show the sidebar and header before looking for the steps' elements
export const TOUR_START_DELAY = 1500

// Replays the whole tour (the user menu's "Take the tour")
export const startTour = () => window.dispatchEvent(new Event(START_TOUR_EVENT))
