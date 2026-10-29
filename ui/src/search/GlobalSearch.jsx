import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router-dom'
import { useNotify, useTranslate } from 'react-admin'
import { GlobalHotKeys } from 'react-hotkeys'
import {
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  InputBase,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import SearchIcon from '@material-ui/icons/Search'
import AlbumIcon from '@material-ui/icons/Album'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import PersonIcon from '@material-ui/icons/Person'
import QueueMusicIcon from '@material-ui/icons/QueueMusic'
import LocalOfferIcon from '@material-ui/icons/LocalOffer'
import EventIcon from '@material-ui/icons/Event'
import PeopleIcon from '@material-ui/icons/People'
import HistoryIcon from '@material-ui/icons/History'
import TuneIcon from '@material-ui/icons/Tune'
import { FaRadio } from 'react-icons/fa6'
import { playTracks } from '../actions'
import { processSongsForPlayback } from '../common/playbackActions'
import { IpodIcon } from '../ipods/IpodIcon'
import { IpodLabel } from '../ipods/IpodLabel'
import { playIpodRadio } from '../ipods/radio'
import { useBrowseIpod } from '../ipods/useBrowseIpod'
import { useSelectIpod } from '../ipods/useSelectIpod'
import { keyMap } from '../hotkeys'
import { entryToSong } from '../listening/api'
import {
  PAGED_GROUPS,
  fetchRadioHistory,
  searchEverything,
  searchPageUrl,
} from './searchEverything'
import { ResultBadges } from './ResultBadges'

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_DELAY = 250

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  paper: {
    position: 'absolute',
    top: theme.spacing(8),
    margin: theme.spacing(0, 2),
    width: 640,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 128px)',
  },
  input: {
    padding: theme.spacing(1.5, 2),
    fontSize: '1.1rem',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  results: { overflowY: 'auto' },
  subheader: {
    backgroundColor: theme.palette.background.paper,
    lineHeight: '32px',
  },
  icon: { minWidth: 40 },
  secondary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  message: { padding: theme.spacing(3, 2), textAlign: 'center' },
  seeAll: { paddingLeft: theme.spacing(2) },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0.5, 1),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}))

// The order the result groups are shown in, with their icons
const GROUPS = [
  ['dates', <EventIcon key="dates" />],
  ['ipods', <IpodIcon size={20} key="ipods" />],
  ['artists', <PersonIcon key="artists" />],
  ['albums', <AlbumIcon key="albums" />],
  ['songs', <MusicNoteIcon key="songs" />],
  ['users', <PeopleIcon key="users" />],
  ['listens', <HistoryIcon key="listens" />],
  ['playlists', <QueueMusicIcon key="playlists" />],
  ['genres', <LocalOfferIcon key="genres" />],
  ['radios', <FaRadio size={18} key="radios" />],
]

const primaryText = (group, item, t) => {
  switch (group) {
    case 'dates':
      return t(`dates.${item.kind}`, { label: item.label })
    case 'users':
      return item.name || item.username
    case 'albums':
    case 'artists':
    case 'playlists':
    case 'genres':
    case 'ipods':
      return item.name
    default:
      return item.title
  }
}

const secondaryText = (group, item, t) => {
  switch (group) {
    case 'albums':
      return item.albumArtist
    case 'users':
      return t('userPlays', { smart_count: item.plays || 0 })
    case 'listens':
      return t('listenedBy', {
        name: item.username,
        artist: item.artist,
        smart_count: item.plays || 1,
      })
    case 'songs':
      return [item.artist, item.album].filter(Boolean).join(' - ')
    case 'radios':
      return item.artist
    case 'playlists':
      return item.ownerName
    default:
      return null
  }
}

// A search box in the header that searches everything at once: artists, albums, songs (also in
// lyrics, comments, credits and labels), iPods, listeners and what they played, playlists, genres,
// past iPod radios and dates, on every iPod
export const GlobalSearch = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const history = useHistory()
  const selectIpod = useSelectIpod()
  const userLibraries = useSelector((state) => state.library?.userLibraries)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const radioHistory = useRef([])
  const requestId = useRef(0)
  const t = (key, opts) => translate(`search.${key}`, opts)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults(null)
    setLoading(false)
    requestId.current++
  }, [])
  const browseIpod = useBrowseIpod(close)

  const keyHandlers = useMemo(
    () => ({
      SEARCH: (e) => {
        e?.preventDefault?.()
        setOpen(true)
      },
    }),
    [],
  )

  // The radio history is searched in the browser, so it is loaded once each time search opens
  useEffect(() => {
    if (!open) return
    fetchRadioHistory().then((list) => {
      radioHistory.current = list
    })
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < SEARCH_MIN_LENGTH) {
      requestId.current++
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++requestId.current
    const timer = setTimeout(() => {
      searchEverything(q, {
        userLibraries: userLibraries || [],
        radioHistory: radioHistory.current,
      }).then((found) => {
        // A slower, older search must not replace the results of a newer one
        if (id !== requestId.current) return
        setResults(found)
        setHighlight(0)
        setLoading(false)
      })
    }, SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [query, userLibraries])

  // Every result, in the order shown, for moving through them with the arrow keys
  const flat = useMemo(
    () =>
      results
        ? GROUPS.flatMap(([group]) =>
            (results[group] || []).map((item) => ({ group, item })),
          )
        : [],
    [results],
  )

  const go = (path) => {
    close()
    history.push(path)
  }

  const openAlbum = (albumId, libraryId, libraryName) => {
    selectIpod(libraryId, libraryName)
    go(`/album/${albumId}/show`)
  }

  const openResult = ({ group, item }) => {
    switch (group) {
      case 'dates':
        return item.kind === 'released'
          ? go(
              `/search?type=albums&year_from=${item.yearFrom}&year_to=${item.yearTo}`,
            )
          : go(`/timeline?from=${item.from}&to=${item.to}`)
      case 'users':
        return go(`/timeline?user=${encodeURIComponent(item.id)}`)
      case 'listens': {
        selectIpod(item.libraryId, item.libraryName)
        const { songData, ids } = processSongsForPlayback([entryToSong(item)])
        dispatch(playTracks(songData, ids))
        return close()
      }
      case 'ipods':
        return browseIpod(item.id)
      case 'artists':
        return go(`/artist/${item.id}/show`)
      case 'albums':
        return openAlbum(item.id, item.libraryId, item.libraryName)
      case 'songs': {
        selectIpod(item.libraryId, item.libraryName)
        const { songData, ids } = processSongsForPlayback([item])
        dispatch(playTracks(songData, ids))
        return close()
      }
      case 'playlists':
        return go(`/playlist/${item.id}/show`)
      case 'genres':
        return go(
          `/album?filter=${encodeURIComponent(
            JSON.stringify({ genre_id: [item.id] }),
          )}&order=ASC&sort=name`,
        )
      case 'radios':
        close()
        return playIpodRadio(dispatch, notify, {
          songId: item.seedId,
          adventure: item.adventure,
        }).catch(() => notify('ra.page.error', 'warning'))
      default:
        return null
    }
  }

  const handleKeyDown = (e) => {
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openResult(flat[Math.min(highlight, flat.length - 1)])
    }
  }

  const renderItem = (group, item, index) => {
    const secondary = secondaryText(group, item, t)
    const ipod = ['albums', 'songs', 'radios', 'listens'].includes(group) && (
      <IpodLabel libraryId={item.libraryId} libraryName={item.libraryName} />
    )
    const badges = PAGED_GROUPS.includes(group) && (
      <ResultBadges item={item} match={results.matches?.[item.id]} />
    )
    return (
      <ListItem
        key={`${group}-${item.userId || ''}${item.id || item.seedId}`}
        button
        dense
        selected={index === highlight}
        onClick={() => openResult({ group, item })}
        onMouseMove={() => index !== highlight && setHighlight(index)}
      >
        <ListItemText
          primary={primaryText(group, item, t)}
          secondary={
            (secondary || ipod || badges) && (
              <span className={classes.secondary}>
                {secondary && <span>{secondary}</span>}
                {ipod}
                {badges}
              </span>
            )
          }
          primaryTypographyProps={{ noWrap: true }}
          secondaryTypographyProps={{ component: 'span' }}
        />
        {group === 'songs' && item.albumId && (
          <ListItemSecondaryAction>
            <Tooltip title={t('goToAlbum')}>
              <IconButton
                edge="end"
                size="small"
                aria-label={t('goToAlbum')}
                onClick={() =>
                  openAlbum(item.albumId, item.libraryId, item.libraryName)
                }
              >
                <AlbumIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemSecondaryAction>
        )}
      </ListItem>
    )
  }

  const renderResults = () => {
    if (!results) return null
    if (!flat.length) {
      return (
        <Typography color="textSecondary" className={classes.message}>
          {t('noResults')}
        </Typography>
      )
    }
    let index = 0
    return (
      <List className={classes.results} dense>
        {GROUPS.filter(([group]) => results[group]?.length).map(
          ([group, icon]) => (
            <li key={group}>
              <ul style={{ padding: 0 }}>
                <ListSubheader className={classes.subheader}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <ListItemIcon className={classes.icon}>{icon}</ListItemIcon>
                    {t(`groups.${group}`)}
                  </span>
                </ListSubheader>
                {results[group].map((item) => renderItem(group, item, index++))}
                {results.more?.[group] && (
                  <ListItem
                    button
                    dense
                    className={classes.seeAll}
                    onClick={() => go(searchPageUrl(query.trim(), group))}
                  >
                    <ListItemText
                      primary={t('seeAll')}
                      primaryTypographyProps={{
                        color: 'primary',
                        variant: 'body2',
                      }}
                    />
                  </ListItem>
                )}
              </ul>
            </li>
          ),
        )}
      </List>
    )
  }

  return (
    <>
      <GlobalHotKeys keyMap={keyMap} handlers={keyHandlers} allowChanges />
      <Tooltip title={t('tooltip')}>
        <IconButton
          className={classes.button}
          aria-label={t('tooltip')}
          onClick={() => setOpen(true)}
        >
          <SearchIcon />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={close}
        classes={{ paper: classes.paper }}
        aria-label={t('tooltip')}
      >
        <InputBase
          autoFocus
          fullWidth
          className={classes.input}
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          inputProps={{ 'aria-label': t('placeholder') }}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          }
          endAdornment={
            loading && (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            )
          }
        />
        {renderResults()}
        <div className={classes.footer}>
          <Button
            size="small"
            startIcon={<TuneIcon fontSize="small" />}
            onClick={() => go(searchPageUrl(query.trim()))}
          >
            {t('withFilters')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

export default GlobalSearch
