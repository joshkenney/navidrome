import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PAGE,
  fetchAlbumSongs,
  fetchAlbums,
  fetchArtistAlbums,
  fetchArtists,
  fetchShuffle,
  fetchSongs,
} from './ipodBrowse'
import { formatTime } from './ipodLook'

// The phone iPod's menus, as a stack of screens, like an iPod: MENU goes back up it, the centre
// button (or a tap) goes down. Opening the player on a song stacks the screens leading to it, so
// MENU climbs from Now Playing to the album's songs, the artist's albums, the artists of the
// song's iPod, Music and the iPod's main menu
//
// A screen is { type, title?, artistId?, albumId?, selectId?, highlight? }: "selectId" is the item
// to highlight once the list is loaded, "highlight" the item the wheel is on

export const MENU_TYPES = [
  'main',
  'music',
  'artists',
  'albums',
  'songs',
  'artistAlbums',
  'albumSongs',
]

const songId = (song) => song?.mediaFileId || song?.id

export const stackFor = (song) => {
  const main = { type: 'main', selectId: 'nowPlaying' }
  const nowPlaying = { type: 'nowPlaying' }
  if (!song?.libraryId || !song.albumId) return [main, nowPlaying]
  const artistId = song.albumArtistId || song.artistId
  return [
    { ...main, selectId: 'music' },
    { type: 'music', selectId: 'artists' },
    { type: 'artists', selectId: artistId },
    {
      type: 'artistAlbums',
      artistId,
      title: song.albumArtist || song.artist,
      selectId: song.albumId,
    },
    {
      type: 'albumSongs',
      albumId: song.albumId,
      title: song.album,
      selectId: songId(song),
    },
    nowPlaying,
  ]
}

const cacheKey = (screen, ipodId) =>
  [screen.type, screen.artistId || screen.albumId || '', ipodId].join(':')

const toItems = (type, records) =>
  records.map((r) => {
    switch (type) {
      case 'artists':
        return { key: r.id, label: r.name, more: true, record: r }
      case 'albums':
        return {
          key: r.id,
          label: r.name,
          sub: r.albumArtist,
          more: true,
          record: r,
        }
      case 'artistAlbums':
        return {
          key: r.id,
          label: r.name,
          sub: r.maxYear ? String(r.maxYear) : '',
          more: true,
          record: r,
        }
      case 'albumSongs':
        return {
          key: r.id,
          label: r.title,
          sub: r.artist !== r.albumArtist ? r.artist : '',
          side: formatTime(r.duration),
          record: r,
        }
      default:
        return { key: r.id, label: r.title, sub: r.artist, record: r }
    }
  })

const loaders = {
  artists: (s, ipod, start) => fetchArtists(ipod, start),
  albums: (s, ipod, start) => fetchAlbums(ipod, start),
  songs: (s, ipod, start) => fetchSongs(ipod, start),
  artistAlbums: (s, ipod) => fetchArtistAlbums(ipod, s.artistId),
  albumSongs: (s) => fetchAlbumSongs(s.albumId),
}

// "t" translates player.mobile.* keys; "playSongs(records, selectedId)" plays a list of songs
export const useIpodNavigation = ({ song, t, playSongs, onClose }) => {
  const [stack, setStack] = useState(() => stackFor(song))
  const [ipod, setIpod] = useState({
    id: song?.libraryId,
    name: song?.libraryName,
  })
  const [cache, setCache] = useState({})
  const loading = useRef(new Set())
  const screen = stack[stack.length - 1]
  const key = cacheKey(screen, ipod.id)

  // Back to the song playing: its iPod, and the screens leading to it
  const reset = useCallback((s) => {
    setIpod({ id: s?.libraryId, name: s?.libraryName })
    setStack(stackFor(s))
  }, [])

  const load = useCallback(
    (sc, start = 0) => {
      const loader = loaders[sc.type]
      const k = cacheKey(sc, ipod.id)
      if (!loader || loading.current.has(`${k}@${start}`)) return
      loading.current.add(`${k}@${start}`)
      loader(sc, ipod.id, start)
        .then(({ data, total }) =>
          setCache((c) => {
            const before = start ? c[k]?.items || [] : []
            return {
              ...c,
              [k]: { items: [...before, ...toItems(sc.type, data)], total },
            }
          }),
        )
        .catch(() => setCache((c) => ({ ...c, [k]: { items: [], total: 0 } })))
    },
    [ipod.id],
  )

  // The fixed menus
  const staticItems = () => {
    if (screen.type === 'main') {
      return [
        ipod.id && { key: 'music', label: t('music'), more: true },
        ipod.id && { key: 'shuffle', label: t('shuffleSongs') },
        { key: 'nowPlaying', label: t('nowPlaying'), more: true },
        { key: 'upNext', label: t('upNext'), more: true },
      ].filter(Boolean)
    }
    if (screen.type === 'music') {
      return [
        { key: 'artists', label: t('artists'), more: true },
        { key: 'albums', label: t('albums'), more: true },
        { key: 'songs', label: t('songs'), more: true },
      ]
    }
    return null
  }
  const fixed = staticItems()
  const entry = fixed ? { items: fixed, total: fixed.length } : cache[key]
  const items = entry?.items || []
  const isMenu = MENU_TYPES.includes(screen.type)

  useEffect(() => {
    if (isMenu && !fixed && !cache[key]) load(screen)
  }, [isMenu, fixed, cache, key, load, screen])

  // The item to highlight: the one moved to, the one leading to the song playing, or the first.
  // When that one is further down a long list, the next pages load until it shows up
  const selectIndex = screen.selectId
    ? items.findIndex((i) => i.key === screen.selectId)
    : -1
  const highlight = screen.highlight ?? (selectIndex >= 0 ? selectIndex : 0)
  const loadedTotal = entry ? entry.total : -1
  useEffect(() => {
    if (
      screen.selectId &&
      screen.highlight === undefined &&
      loadedTotal >= 0 &&
      selectIndex < 0 &&
      items.length < loadedTotal
    ) {
      load(screen, items.length)
    }
  }, [screen, loadedTotal, selectIndex, items.length, load])

  const updateTop = (changes) =>
    setStack((s) => [...s.slice(0, -1), { ...s[s.length - 1], ...changes }])
  const push = (next) => setStack((s) => [...s, next])

  const setHighlight = (index) => {
    const last = Math.max(0, items.length - 1)
    const h = Math.max(0, Math.min(last, index))
    updateTop({ highlight: h })
    // Near the end of what is loaded: load the next page
    if (entry && items.length < entry.total && h >= items.length - 10) {
      load(screen, items.length)
    }
  }
  const moveHighlight = (clicks) => setHighlight(highlight + clicks)
  // The next page of a long list, when scrolled near its end
  const loadMore = () => {
    if (entry && items.length < entry.total) load(screen, items.length)
  }

  const playFrom = (index) => {
    const songs = items.map((i) => i.record)
    playSongs(songs, songs[index]?.id)
    push({ type: 'nowPlaying' })
  }

  const select = (index = highlight) => {
    const item = items[index]
    if (!item) return
    updateTop({ highlight: index })
    switch (screen.type) {
      case 'main':
        if (item.key === 'music') push({ type: 'music' })
        else if (item.key === 'shuffle')
          fetchShuffle(ipod.id).then(({ data }) => {
            if (!data.length) return
            playSongs(data, data[0].id)
            push({ type: 'nowPlaying' })
          })
        else push({ type: item.key })
        break
      case 'music':
        push({ type: item.key })
        break
      case 'artists':
        push({
          type: 'artistAlbums',
          artistId: item.key,
          title: item.label,
        })
        break
      case 'albums':
      case 'artistAlbums':
        push({ type: 'albumSongs', albumId: item.key, title: item.label })
        break
      case 'albumSongs':
      case 'songs':
        playFrom(index)
        break
      default:
    }
  }

  // MENU: up one screen, closing the player above the main menu. From Now Playing, it goes to the
  // album of the song playing, even when the queue moved on to another album
  const back = (current) => {
    if (stack.length <= 1) {
      onClose()
      return
    }
    if (screen.type === 'nowPlaying' && current?.albumId) {
      const below = stack[stack.length - 2]
      if (below.type !== 'albumSongs' || below.albumId !== current.albumId) {
        setIpod({ id: current.libraryId, name: current.libraryName })
        setStack(stackFor(current).slice(0, -1))
        return
      }
    }
    setStack((s) => s.slice(0, -1))
  }

  const titles = {
    main: ipod.name || t('ipod'),
    music: t('music'),
    artists: t('artists'),
    albums: t('albums'),
    songs: t('songs'),
  }

  return {
    screen,
    isMenu,
    title: screen.title || titles[screen.type],
    items,
    loaded: !!entry,
    total: entry?.total || 0,
    highlight,
    setHighlight,
    moveHighlight,
    loadMore,
    select,
    push,
    back,
    reset,
    page: PAGE,
  }
}
