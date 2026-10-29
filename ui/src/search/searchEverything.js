import httpClient from '../dataProvider/httpClient'
import { REST_URL } from '../consts'
import { withoutCombinedLibraries } from '../common/combinedLibraries'
import { parseDateQuery } from '../listening/dates'

export const SEARCH_LIMIT = 5
export const RADIO_HISTORY_URL = '/api/ipods/radio/history'
export const SEARCH_URL = '/api/search'

// The groups the server searches, and the ones that can be seen in full on the search page
export const SERVER_GROUPS = ['artists', 'albums', 'songs', 'users', 'listens']
export const PAGED_GROUPS = ['artists', 'albums', 'songs']

// Lowercase, without accents, so "beyonce" finds "Beyoncé"
export const normalize = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const matches = (query, ...fields) => {
  const q = normalize(query).trim()
  return fields.some((field) => normalize(field).includes(q))
}

const params = (values) => {
  const p = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((v) => p.append(key, v))
    else if (value !== undefined && value !== null && value !== '')
      p.set(key, value)
  })
  return p.toString()
}

// The REST endpoints are called directly, not through the dataProvider, so results come from every
// iPod the user can access, not only the ones picked in the library selector
const fetchList = (resource, field, query) =>
  httpClient(
    `${REST_URL}/${resource}?${params({ _start: 0, _end: SEARCH_LIMIT, [field]: query })}`,
  ).then(({ json }) => json || [])

// Searches the server: artists, albums and songs (also in comments, lyrics, credits and record
// labels), listeners and what they played. Filters: libraryIds, yearFrom, yearTo, genreId, played
export const searchServer = (
  query,
  { types = SERVER_GROUPS, start = 0, end = SEARCH_LIMIT, ...filters } = {},
) =>
  httpClient(
    `${SEARCH_URL}?${params({
      q: query,
      types: types.join(','),
      library_id: filters.libraryIds,
      year_from: filters.yearFrom,
      year_to: filters.yearTo,
      genre_id: filters.genreId,
      played: filters.played,
      _start: start,
      _end: end,
    })}`,
  ).then(({ json }) => json || {})

export const fetchRadioHistory = () =>
  httpClient(RADIO_HISTORY_URL)
    .then(({ json }) => json || [])
    .catch(() => [])

// What a date typed in search leads to: the listening on those days, and music released then
export const dateResults = (date) => {
  if (!date) return []
  const res = [{ id: 'timeline', kind: 'timeline', ...date }]
  if (date.yearFrom) res.push({ id: 'released', kind: 'released', ...date })
  return res
}

const settled = (result, fallback) =>
  result.status === 'fulfilled' ? result.value : fallback

// Searches artists, albums, songs, playlists, genres, iPods, listeners, what listeners played, the
// user's past iPod radios and dates, at once. A group whose request fails is left empty.
// "more" tells which groups have more results, and "matches" where a result was found when it
// wasn't in its name (like "lyrics")
export const searchEverything = async (
  query,
  { userLibraries = [], radioHistory = [], now = new Date() } = {},
) => {
  const date = parseDateQuery(query, now)
  const [server, playlists, genres] = await Promise.allSettled([
    searchServer(query),
    fetchList('playlist', 'q', query),
    fetchList('genre', 'name', query),
  ])
  const found = settled(server, {})
  const group = (name) => found[name]?.items || []

  const ipods = withoutCombinedLibraries(userLibraries)
    .filter((lib) => matches(query, lib.name))
    .slice(0, SEARCH_LIMIT)
  const radios = radioHistory
    .filter((r) => matches(query, r.title, r.artist, r.album, r.libraryName))
    .slice(0, SEARCH_LIMIT)

  return {
    dates: dateResults(date),
    ipods,
    artists: group('artists'),
    albums: group('albums'),
    songs: group('songs'),
    users: group('users'),
    listens: group('listens'),
    playlists: settled(playlists, []),
    genres: settled(genres, []),
    radios,
    more: Object.fromEntries(PAGED_GROUPS.map((g) => [g, !!found[g]?.more])),
    matches: { ...found.albums?.matches, ...found.songs?.matches },
  }
}

// The search page, for the query and one kind of results
export const searchPageUrl = (query, type) => {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (type) params.set('type', type)
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}
