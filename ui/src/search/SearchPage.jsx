import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import { Title, useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import SearchIcon from '@material-ui/icons/Search'
import AlbumIcon from '@material-ui/icons/Album'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import httpClient from '../dataProvider/httpClient'
import { REST_URL } from '../consts'
import { playTracks } from '../actions'
import { APP_NAME } from '../common/Title'
import { withoutCombinedLibraries } from '../common/combinedLibraries'
import { processSongsForPlayback } from '../common/playbackActions'
import { IpodLabel } from '../ipods/IpodLabel'
import { useSelectIpod } from '../ipods/useSelectIpod'
import { playAlbum } from '../listening/api'
import { parseDateQuery } from '../listening/dates'
import { PAGED_GROUPS, searchServer } from './searchEverything'
import { ResultBadges } from './ResultBadges'

export const PAGE_SIZE = 50
const DELAY = 300

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(2) },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    margin: theme.spacing(2, 0, 1),
  },
  query: { flex: '1 1 320px' },
  filter: { minWidth: 150 },
  year: { width: 110 },
  secondary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  message: { padding: theme.spacing(3, 0) },
  more: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(1),
  },
}))

const FILTER_KEYS = ['library_id', 'year_from', 'year_to', 'genre_id', 'played']

// Reads the search and its filters from the address, so a search can be shared or bookmarked
const readParams = (search) => {
  const p = new URLSearchParams(search)
  const type = PAGED_GROUPS.includes(p.get('type')) ? p.get('type') : 'songs'
  return {
    q: p.get('q') || '',
    type,
    library_id: p.get('library_id') || '',
    year_from: p.get('year_from') || '',
    year_to: p.get('year_to') || '',
    genre_id: p.get('genre_id') || '',
    played: p.get('played') || '',
  }
}

const toOptions = (params) => ({
  types: [params.type],
  libraryIds: params.library_id ? [params.library_id] : undefined,
  yearFrom: params.year_from,
  yearTo: params.year_to,
  genreId: params.genre_id,
  played: params.played,
})

// The full search: every result of one kind (songs, albums or artists), with filters for the iPod,
// release years, genre and whether the user has played it
const SearchPage = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const history = useHistory()
  const location = useLocation()
  const selectIpod = useSelectIpod()
  const userLibraries = useSelector((state) => state.library?.userLibraries)
  const params = useMemo(() => readParams(location.search), [location.search])
  const [text, setText] = useState(params.q)
  const [results, setResults] = useState(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [genres, setGenres] = useState([])
  const requestId = useRef(0)
  const t = (key, opts) => translate(`search.page.${key}`, opts)

  const ipods = useMemo(
    () => withoutCombinedLibraries(userLibraries || []),
    [userLibraries],
  )
  const hasFilters = FILTER_KEYS.some((k) => params[k])
  const date = parseDateQuery(params.q)

  const update = useCallback(
    (changes) => {
      const next = { ...readParams(location.search), ...changes }
      const search = new URLSearchParams(
        Object.entries(next).filter(([, v]) => v !== '' && v !== undefined),
      )
      history.replace({ pathname: '/search', search: `?${search}` })
    },
    [history, location.search],
  )

  useEffect(() => {
    httpClient(`${REST_URL}/genre?_start=0&_end=1000&_sort=name&_order=ASC`)
      .then(({ json }) => setGenres(json || []))
      .catch(() => setGenres([]))
  }, [])

  // The search box follows the address, when it changes from outside (like the header search)
  useEffect(() => {
    setText((current) => (current.trim() === params.q ? current : params.q))
  }, [params.q])

  // Typing updates the address after a pause, which runs the search
  useEffect(() => {
    if (text.trim() === params.q) return
    const timer = setTimeout(() => update({ q: text.trim() }), DELAY)
    return () => clearTimeout(timer)
  }, [text, params.q, update])

  const load = useCallback(
    (start) => {
      if (!params.q && !hasFilters) {
        setResults(null)
        return
      }
      const id = ++requestId.current
      setLoading(true)
      searchServer(params.q, {
        ...toOptions(params),
        start,
        end: start + PAGE_SIZE,
      })
        .then((found) => {
          if (id !== requestId.current) return
          const group = found[params.type] || { items: [] }
          setResults((prev) => ({
            items: start
              ? [...(prev?.items || []), ...group.items]
              : group.items,
            matches: { ...(start ? prev?.matches : {}), ...group.matches },
          }))
          setMore(!!group.more)
        })
        .catch(() => notify('ra.page.error', 'warning'))
        .finally(() => id === requestId.current && setLoading(false))
    },
    [params, hasFilters, notify],
  )

  useEffect(() => {
    load(0)
  }, [load])

  const openAlbum = (albumId, libraryId, libraryName) => {
    selectIpod(libraryId, libraryName)
    history.push(`/album/${albumId}/show`)
  }

  const play = (item) => {
    selectIpod(item.libraryId, item.libraryName)
    if (params.type === 'albums') {
      return playAlbum(dispatch, item.id).catch(() =>
        notify('ra.page.error', 'warning'),
      )
    }
    const { songData, ids } = processSongsForPlayback([item])
    dispatch(playTracks(songData, ids))
  }

  const open = (item) => {
    switch (params.type) {
      case 'artists':
        return history.push(`/artist/${item.id}/show`)
      case 'albums':
        return openAlbum(item.id, item.libraryId, item.libraryName)
      default:
        return play(item)
    }
  }

  const describe = (item) => {
    switch (params.type) {
      case 'albums':
        return [item.albumArtist, item.maxYear || null]
          .filter(Boolean)
          .join(' · ')
      case 'songs':
        return [item.artist, item.album, item.year || null]
          .filter(Boolean)
          .join(' · ')
      default:
        return translate('search.page.albumCount', {
          smart_count: item.albumCount || 0,
        })
    }
  }

  return (
    <Card className={classes.root}>
      <Title title={`${APP_NAME} - ${translate('search.page.title')}`} />
      <CardContent>
        <Typography variant="h5">{t('title')}</Typography>
        <Typography variant="body2" color="textSecondary">
          {t('help')}
        </Typography>

        <div className={classes.filters}>
          <TextField
            autoFocus
            className={classes.query}
            size="small"
            variant="outlined"
            placeholder={translate('search.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputProps={{ 'aria-label': translate('search.placeholder') }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: loading && (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ),
            }}
          />
          {ipods.length > 1 && (
            <TextField
              select
              size="small"
              variant="outlined"
              className={classes.filter}
              label={t('ipod')}
              value={params.library_id}
              onChange={(e) => update({ library_id: e.target.value })}
            >
              <MenuItem value="">{t('allIpods')}</MenuItem>
              {ipods.map((lib) => (
                <MenuItem key={lib.id} value={String(lib.id)}>
                  {lib.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            size="small"
            variant="outlined"
            type="number"
            className={classes.year}
            label={t('yearFrom')}
            value={params.year_from}
            onChange={(e) => update({ year_from: e.target.value })}
          />
          <TextField
            size="small"
            variant="outlined"
            type="number"
            className={classes.year}
            label={t('yearTo')}
            value={params.year_to}
            onChange={(e) => update({ year_to: e.target.value })}
          />
          <TextField
            select
            size="small"
            variant="outlined"
            className={classes.filter}
            label={t('genre')}
            value={params.genre_id}
            onChange={(e) => update({ genre_id: e.target.value })}
          >
            <MenuItem value="">{t('anyGenre')}</MenuItem>
            {genres.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            variant="outlined"
            className={classes.filter}
            label={t('played')}
            value={params.played}
            onChange={(e) => update({ played: e.target.value })}
          >
            <MenuItem value="">{t('playedAny')}</MenuItem>
            <MenuItem value="played">{t('playedYes')}</MenuItem>
            <MenuItem value="unplayed">{t('playedNo')}</MenuItem>
          </TextField>
          {hasFilters && (
            <Button
              size="small"
              onClick={() =>
                update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))
              }
            >
              {t('clear')}
            </Button>
          )}
        </div>

        {date?.yearFrom && !params.year_from && (
          <Button
            size="small"
            color="primary"
            onClick={() => {
              setText('')
              update({
                q: '',
                year_from: date.yearFrom,
                year_to: date.yearTo,
                type: 'albums',
              })
            }}
          >
            {translate('search.dates.released', { label: date.label })}
          </Button>
        )}

        <Tabs
          value={params.type}
          onChange={(_, type) => update({ type })}
          indicatorColor="primary"
          textColor="primary"
        >
          {PAGED_GROUPS.map((g) => (
            <Tab key={g} value={g} label={translate(`search.groups.${g}`)} />
          ))}
        </Tabs>

        {!results && !loading && (
          <Typography color="textSecondary" className={classes.message}>
            {t('start')}
          </Typography>
        )}
        {results?.items.length === 0 && !loading && (
          <Typography color="textSecondary" className={classes.message}>
            {translate('search.noResults')}
          </Typography>
        )}
        {results?.items.length > 0 && (
          <List dense>
            {results.items.map((item) => (
              <ListItem key={item.id} button divider onClick={() => open(item)}>
                <ListItemText
                  primary={item.title || item.name}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <div className={classes.secondary}>
                      <span>{describe(item)}</span>
                      {params.type !== 'artists' && (
                        <IpodLabel
                          libraryId={item.libraryId}
                          libraryName={item.libraryName}
                        />
                      )}
                      <ResultBadges
                        item={item}
                        match={results.matches?.[item.id]}
                      />
                    </div>
                  }
                />
                {params.type !== 'artists' && (
                  <ListItemSecondaryAction>
                    {params.type === 'songs' && item.albumId && (
                      <Tooltip title={translate('search.goToAlbum')}>
                        <IconButton
                          size="small"
                          aria-label={translate('search.goToAlbum')}
                          onClick={() =>
                            openAlbum(
                              item.albumId,
                              item.libraryId,
                              item.libraryName,
                            )
                          }
                        >
                          <AlbumIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={translate('ra.action.play', { _: 'Play' })}>
                      <IconButton
                        edge="end"
                        size="small"
                        aria-label={translate('ra.action.play', { _: 'Play' })}
                        onClick={() => play(item)}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        )}
        {more && (
          <div className={classes.more}>
            <Button
              onClick={() => load(results.items.length)}
              disabled={loading}
            >
              {t('more')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SearchPage
