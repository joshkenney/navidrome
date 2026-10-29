import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import { Title, useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  ListSubheader,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import EventIcon from '@material-ui/icons/Event'
import { APP_NAME } from '../common/Title'
import { IpodLabel } from '../ipods/IpodLabel'
import { ActivityChart } from './ActivityChart'
import { CountList } from './CountList'
import { useOpenItem } from './useOpenItem'
import { PLAYS_PAGE, fetchListeners, fetchTimeline, playEntries } from './api'
import {
  fillDays,
  formatDuration,
  formatRange,
  parseDateQuery,
  presetRange,
  toDay,
} from './dates'

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(2) },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    margin: theme.spacing(2, 0),
  },
  jump: { minWidth: 260, flex: '1 1 260px' },
  presets: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) },
  totals: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    margin: theme.spacing(2, 0),
  },
  total: { minWidth: 72 },
  gaps: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  subheader: {
    backgroundColor: theme.palette.background.paper,
    lineHeight: '32px',
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  empty: { padding: theme.spacing(3, 0) },
  more: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(1),
  },
}))

const PRESETS = ['today', 'week', 'month', 'last30', 'year', 'all']

// The day a play happened on, in words, to group the plays list
const dayHeading = (time) =>
  new Date(time).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

// The listening history, between any two days: when, what and how much was played, and the
// silences in between. Other listeners' timelines can be seen when they share their activity
const TimelinePage = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const history = useHistory()
  const location = useLocation()
  const { open } = useOpenItem()
  const t = (key, opts) => translate(`listening.timeline.${key}`, opts)

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const fallback = useMemo(() => presetRange('last30'), [])
  const from = params.get('from') || fallback.from
  const to = params.get('to') || fallback.to
  const user = params.get('user') || ''

  const [data, setData] = useState(null)
  const [plays, setPlays] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listeners, setListeners] = useState([])
  const [jump, setJump] = useState('')
  const [jumpError, setJumpError] = useState(false)

  const go = useCallback(
    (changes) => {
      const next = new URLSearchParams(location.search)
      Object.entries(changes).forEach(([k, v]) =>
        v ? next.set(k, v) : next.delete(k),
      )
      history.push({ pathname: '/timeline', search: `?${next}` })
    },
    [history, location.search],
  )
  const setRange = useCallback((r) => go({ from: r.from, to: r.to }), [go])

  useEffect(() => {
    fetchListeners().then(setListeners)
  }, [])

  useEffect(() => {
    let current = true
    setLoading(true)
    fetchTimeline({ from, to, user })
      .then((json) => {
        if (!current) return
        setData(json)
        setPlays(json.plays || [])
      })
      .catch(() => current && notify('ra.page.error', 'warning'))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [from, to, user, notify])

  const loadMore = () => {
    setLoadingMore(true)
    fetchTimeline({
      from,
      to,
      user,
      start: plays.length,
      end: plays.length + PLAYS_PAGE,
    })
      .then((json) => setPlays((p) => [...p, ...(json.plays || [])]))
      .catch(() => notify('ra.page.error', 'warning'))
      .finally(() => setLoadingMore(false))
  }

  const submitJump = (e) => {
    e.preventDefault()
    const r = parseDateQuery(jump)
    setJumpError(!r)
    if (r) setRange(r)
  }

  const { bars } = useMemo(
    () => fillDays(data?.days, from, to),
    [data, from, to],
  )
  const playsLabel = (n) => translate('listening.plays', { smart_count: n })
  const totals = data?.totals || {}
  const me = localStorage.getItem('userId')
  const whose =
    user && user !== me && data?.user?.id === user
      ? data.user.name || data.user.username
      : null

  const playsByDay = useMemo(() => {
    const groups = []
    plays.forEach((p) => {
      const heading = dayHeading(p.submissionTime)
      if (!groups.length || groups[groups.length - 1].heading !== heading) {
        groups.push({ heading, plays: [] })
      }
      groups[groups.length - 1].plays.push(p)
    })
    return groups
  }, [plays])

  const presetFirst = data?.first ? toDay(new Date(data.first)) : null

  return (
    <Card className={classes.root}>
      <Title title={`${APP_NAME} - ${t('title')}`} />
      <CardContent>
        <div className={classes.header}>
          <div>
            <Typography variant="h5">
              {whose ? t('titleOf', { name: whose }) : t('title')}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {formatRange(from, to)}
            </Typography>
          </div>
          {listeners.some((l) => l.id !== me) && (
            <TextField
              select
              size="small"
              variant="outlined"
              label={t('whose')}
              value={user === me ? '' : user}
              onChange={(e) => go({ user: e.target.value })}
              style={{ minWidth: 180 }}
            >
              <MenuItem value="">{t('me')}</MenuItem>
              {listeners
                .filter((l) => l.id !== me)
                .map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name || l.username}
                  </MenuItem>
                ))}
            </TextField>
          )}
        </div>

        <form className={classes.controls} onSubmit={submitJump}>
          <TextField
            className={classes.jump}
            size="small"
            variant="outlined"
            placeholder={t('jumpPlaceholder')}
            value={jump}
            error={jumpError}
            helperText={jumpError ? t('jumpError') : null}
            onChange={(e) => {
              setJump(e.target.value)
              setJumpError(false)
            }}
            inputProps={{ 'aria-label': t('jumpPlaceholder') }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EventIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            type="date"
            size="small"
            variant="outlined"
            label={t('from')}
            value={from}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: to }}
            onChange={(e) => e.target.value && go({ from: e.target.value })}
          />
          <TextField
            type="date"
            size="small"
            variant="outlined"
            label={t('to')}
            value={to}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: from }}
            onChange={(e) => e.target.value && go({ to: e.target.value })}
          />
        </form>
        <div className={classes.presets}>
          {PRESETS.map((preset) => {
            const r = presetRange(preset, new Date(), presetFirst)
            return (
              <Chip
                key={preset}
                label={t(`presets.${preset}`)}
                size="small"
                color={r.from === from && r.to === to ? 'primary' : 'default'}
                onClick={() => setRange(r)}
              />
            )
          })}
        </div>

        <div className={classes.totals}>
          {[
            ['plays', totals.plays || 0],
            ['time', formatDuration(totals.seconds)],
            ['songs', totals.songs || 0],
            ['albums', totals.albums || 0],
            ['artists', totals.artists || 0],
          ].map(([key, value]) => (
            <div key={key} className={classes.total}>
              <Typography variant="h5">{value}</Typography>
              <Typography variant="caption" color="textSecondary">
                {t(`totals.${key}`)}
              </Typography>
            </div>
          ))}
          {loading && <CircularProgress size={20} />}
        </div>

        <ActivityChart
          bars={bars}
          playsLabel={playsLabel}
          onSelect={(bar) => setRange({ from: bar.from, to: bar.to })}
        />
        {data?.gaps?.length > 0 && (
          <div className={classes.gaps}>
            <Typography variant="body2" color="textSecondary">
              {t('silences')}
            </Typography>
            {data.gaps.map((gap) => (
              <Chip
                key={gap.from}
                size="small"
                variant="outlined"
                label={t('silence', {
                  range: formatRange(gap.from, gap.to),
                  smart_count: gap.days,
                })}
              />
            ))}
          </div>
        )}

        {data && !loading && totals.plays === 0 && (
          <Typography color="textSecondary" className={classes.empty}>
            {data.first
              ? t('emptyRange', {
                  first: new Date(data.first).toLocaleDateString(),
                })
              : t('emptyEver')}
          </Typography>
        )}

        {totals.plays > 0 && (
          <>
            <Grid container spacing={2}>
              {[
                ['ipod', 'topIpods'],
                ['artist', 'topArtists'],
                ['album', 'topAlbums'],
                ['song', 'topSongs'],
              ].map(([kind, key]) => (
                <Grid item xs={12} sm={6} md={3} key={key}>
                  <CountList
                    title={t(key)}
                    kind={kind}
                    items={data[key]}
                    limit={5}
                    detail={(item) => playsLabel(item.plays)}
                  />
                </Grid>
              ))}
            </Grid>

            <div className={classes.header} style={{ marginTop: 16 }}>
              <Typography variant="h6">{t('plays')}</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => playEntries(dispatch, [...plays].reverse())}
              >
                {t('replay')}
              </Button>
            </div>
            <List dense>
              {playsByDay.map((group) => (
                <li key={group.heading}>
                  <ul style={{ padding: 0 }}>
                    <ListSubheader className={classes.subheader}>
                      {group.heading}
                    </ListSubheader>
                    {group.plays.map((p, i) => (
                      <ListItem
                        key={`${p.id}-${p.submissionTime}-${i}`}
                        button
                        onClick={() => open('album', { ...p, id: p.albumId })}
                      >
                        <ListItemText
                          primary={`${p.title} — ${p.artist}`}
                          primaryTypographyProps={{ noWrap: true }}
                          secondaryTypographyProps={{ component: 'div' }}
                          secondary={
                            <div className={classes.meta}>
                              <span>
                                {new Date(p.submissionTime).toLocaleTimeString(
                                  undefined,
                                  {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  },
                                )}
                              </span>
                              {p.album && <span>· {p.album}</span>}
                              <IpodLabel
                                libraryId={p.libraryId}
                                libraryName={p.libraryName}
                              />
                            </div>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={t('playSong')}>
                            <IconButton
                              edge="end"
                              size="small"
                              aria-label={t('playSong')}
                              onClick={() => playEntries(dispatch, [p])}
                            >
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </ul>
                </li>
              ))}
            </List>
            {plays.length < totals.plays && (
              <div className={classes.more}>
                <Button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <CircularProgress size={16} /> : t('more')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default TimelinePage
