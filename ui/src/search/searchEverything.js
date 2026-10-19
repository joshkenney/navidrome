import httpClient from '../dataProvider/httpClient'
import { REST_URL } from '../consts'
import { withoutCombinedLibraries } from '../common/combinedLibraries'

export const SEARCH_LIMIT = 5
export const RADIO_HISTORY_URL = '/api/ipods/radio/history'

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

// The REST endpoints are called directly, not through the dataProvider, so results come from every
// iPod the user can access, not only the ones picked in the library selector
const fetchList = (resource, field, query) => {
  const params = new URLSearchParams({
    _start: 0,
    _end: SEARCH_LIMIT,
    [field]: query,
  })
  return httpClient(`${REST_URL}/${resource}?${params}`).then(
    ({ json }) => json || [],
  )
}

export const fetchRadioHistory = () =>
  httpClient(RADIO_HISTORY_URL)
    .then(({ json }) => json || [])
    .catch(() => [])

// Searches artists, albums, songs, playlists, genres, iPods and the user's past iPod radios at once.
// A group whose request fails is left empty
export const searchEverything = async (
  query,
  { userLibraries = [], radioHistory = [] } = {},
) => {
  const [artists, albums, songs, playlists, genres] = (
    await Promise.allSettled([
      fetchList('artist', 'name', query),
      fetchList('album', 'name', query),
      fetchList('song', 'title', query),
      fetchList('playlist', 'q', query),
      fetchList('genre', 'name', query),
    ])
  ).map((result) => (result.status === 'fulfilled' ? result.value : []))

  const ipods = withoutCombinedLibraries(userLibraries)
    .filter((lib) => matches(query, lib.name))
    .slice(0, SEARCH_LIMIT)
  const radios = radioHistory
    .filter((r) => matches(query, r.title, r.artist, r.album, r.libraryName))
    .slice(0, SEARCH_LIMIT)

  return { ipods, artists, albums, songs, playlists, genres, radios }
}
