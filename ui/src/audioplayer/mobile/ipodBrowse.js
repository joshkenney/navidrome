import { httpClient } from '../../dataProvider'
import { REST_URL } from '../../consts'

// What the phone iPod's menus list, all on one iPod (library), whatever the iPod selector says:
// its artists, albums and songs, an artist's albums and an album's songs. Long lists come a page
// at a time

export const PAGE = 100

const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    ),
  ).toString()

const list = (resource, params) =>
  httpClient(
    `${REST_URL}/${resource}?${query({ missing: false, ...params })}`,
  ).then(({ json, headers }) => ({
    data: json || [],
    total: Number(headers?.get?.('x-total-count')) || (json || []).length,
  }))

const page = (start = 0) => ({ _start: start, _end: start + PAGE })

export const fetchArtists = (libraryId, start) =>
  list('artist', {
    library_id: libraryId,
    role: 'albumartist',
    _sort: 'name',
    _order: 'ASC',
    ...page(start),
  })

export const fetchAlbums = (libraryId, start) =>
  list('album', {
    library_id: libraryId,
    _sort: 'name',
    _order: 'ASC',
    ...page(start),
  })

export const fetchSongs = (libraryId, start) =>
  list('song', {
    library_id: libraryId,
    _sort: 'title',
    _order: 'ASC',
    ...page(start),
  })

// An artist's albums on the iPod, oldest first
export const fetchArtistAlbums = (libraryId, artistId) =>
  list('album', {
    library_id: libraryId,
    artist_id: artistId,
    _sort: 'max_year',
    _order: 'ASC',
    _start: 0,
    _end: 500,
  })

// An album's songs, in order
export const fetchAlbumSongs = (albumId) =>
  list('song', {
    album_id: albumId,
    _sort: 'album',
    _order: 'ASC',
    _start: 0,
    _end: 500,
  })

// Songs of the iPod in a random order, for "Shuffle Songs"
export const fetchShuffle = (libraryId) =>
  list('song', {
    library_id: libraryId,
    _sort: 'random',
    _order: 'ASC',
    _start: 0,
    _end: 200,
  })
