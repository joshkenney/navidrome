// Shared by the tour and what starts it (the user menu)
export const TOUR_URL = '/api/ipods/tour'
export const START_TOUR_EVENT = 'nd-start-tour'
// Where the version seen is kept when the server can't be reached
export const TOUR_VERSION_KEY = 'tour-version'
// Leaves the app time to show the sidebar and header before looking for the steps' elements
export const TOUR_START_DELAY = 1500

// Replays the whole tour (the user menu's "Take the tour")
export const startTour = () => window.dispatchEvent(new Event(START_TOUR_EVENT))
