import httpClient from '../dataProvider/httpClient'
import { playTracks } from '../actions'
import { processSongsForPlayback } from '../common/playbackActions'

export const SHUFFLE = 'shuffle'
export const JOURNEY = 'journey'
// How many songs a play button queues
export const ERA_SONGS = 60

const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && v !== false,
    ),
  ).toString()

export const fetchEras = () => httpClient('/api/eras').then(({ json }) => json)

export const fetchEra = (from, to) =>
  httpClient(`/api/eras/era?${query({ from, to })}`).then(({ json }) => json)

// Plays songs released between two years: shuffled, or year by year for a journey. Resolves with
// how many songs were queued
export const playEra = (
  dispatch,
  { from, to, mode = SHUFFLE, genre, unplayed, count = ERA_SONGS },
) =>
  httpClient(
    `/api/eras/play?${query({ from, to, mode, genre, unplayed, count })}`,
  ).then(({ json }) => {
    const songs = json || []
    if (songs.length) {
      const { songData, ids } = processSongsForPlayback(songs)
      dispatch(playTracks(songData, ids))
    }
    return songs.length
  })

// The decades of the years with music, with their songs and how many were played
export const toDecades = (years) => {
  const decades = []
  ;(years || []).forEach((y) => {
    const decade = Math.floor(y.year / 10) * 10
    let d = decades[decades.length - 1]
    if (!d || d.decade !== decade) {
      d = { decade, from: decade, to: decade + 9, songs: 0, played: 0 }
      decades.push(d)
    }
    d.songs += y.songs
    d.played += y.played
  })
  return decades
}

export const isDecade = (from, to) => from % 10 === 0 && to === from + 9

// The name of an era: "1970s", "1977" or "1965–1972"
export const eraName = (from, to) => {
  if (from === to) return String(from)
  if (isDecade(from, to)) return `${from}s`
  return `${from}–${to}`
}

// The era just before or after, of the same length
export const shiftEra = (from, to, direction) => {
  const length = to - from + 1
  return { from: from + direction * length, to: to + direction * length }
}

// The decade with the most music, to start with
export const biggestDecade = (years) =>
  toDecades(years).reduce(
    (best, d) => (!best || d.songs > best.songs ? d : best),
    null,
  )

// One bar per year from the first to the last year with music, years without music included
export const yearBars = (years) => {
  if (!years?.length) return []
  const byYear = new Map(years.map((y) => [y.year, y]))
  const bars = []
  for (let y = years[0].year; y <= years[years.length - 1].year; y++) {
    const songs = byYear.get(y)?.songs || 0
    bars.push({ key: String(y), from: y, to: y, plays: songs, seconds: 0 })
  }
  return bars
}
