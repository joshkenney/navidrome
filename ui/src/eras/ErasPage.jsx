import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import { Title, useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import ShuffleIcon from '@material-ui/icons/Shuffle'
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat'
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import { APP_NAME } from '../common/Title'
import { ActivityChart } from '../listening/ActivityChart'
import { CountList } from '../listening/CountList'
import {
  JOURNEY,
  SHUFFLE,
  biggestDecade,
  eraName,
  fetchEra,
  fetchEras,
  isDecade,
  playEra,
  shiftEra,
  toDecades,
  yearBars,
} from './eras'

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(2) },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  decades: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    margin: theme.spacing(2, 0),
  },
  era: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(3),
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    margin: theme.spacing(1.5, 0),
  },
  genres: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}))

const percent = (played, total) =>
  total ? Math.round((played / total) * 100) : 0

// Eras: the history of the music on every iPod, year by year. Pick a decade or a year, see who
// made it and play it shuffled, or as a journey through the years in the order the songs came out
const ErasPage = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const history = useHistory()
  const location = useLocation()
  const t = (key, opts) => translate(`eras.${key}`, opts)

  const [eras, setEras] = useState(null)
  const [era, setEra] = useState(null)
  const [unplayed, setUnplayed] = useState(false)
  // The play button busy loading songs, so it can show a spinner
  const [starting, setStarting] = useState(null)

  useEffect(() => {
    fetchEras()
      .then(setEras)
      .catch(() => notify('ra.page.error', 'warning'))
  }, [notify])

  const params = new URLSearchParams(location.search)
  const fallback = useMemo(() => biggestDecade(eras?.years), [eras])
  const from = Number(params.get('from')) || fallback?.from
  const to =
    Number(params.get('to')) || (params.get('from') ? from : fallback?.to)

  const go = useCallback(
    (range) => history.push(`/eras?from=${range.from}&to=${range.to}`),
    [history],
  )

  useEffect(() => {
    if (!from || !to) return
    let current = true
    setEra(null)
    fetchEra(from, to)
      .then((json) => current && setEra(json))
      .catch(() => current && notify('ra.page.error', 'warning'))
    return () => {
      current = false
    }
  }, [from, to, notify])

  const decades = useMemo(() => toDecades(eras?.years), [eras])
  const bars = useMemo(() => yearBars(eras?.years), [eras])
  const firstYear = eras?.years?.[0]?.year
  const lastYear = eras?.years?.[eras.years.length - 1]?.year
  const songsLabel = (n) => t('songs', { smart_count: n })

  const play = (key, options) => {
    setStarting(key)
    playEra(dispatch, { unplayed, ...options })
      .then((count) => !count && notify('eras.nothingToPlay', 'info'))
      .catch(() => notify('ra.page.error', 'warning'))
      .finally(() => setStarting(null))
  }

  const playButton = (key, label, icon, options, variant = 'outlined') => (
    <Button
      variant={variant}
      color={variant === 'contained' ? 'primary' : 'default'}
      startIcon={
        starting === key ? <CircularProgress size={14} color="inherit" /> : icon
      }
      disabled={!!starting}
      onClick={() => play(key, options)}
    >
      {label}
    </Button>
  )

  const name = from && to ? eraName(from, to) : ''
  const prev = from && shiftEra(from, to, -1)
  const next = from && shiftEra(from, to, 1)

  return (
    <Card className={classes.root}>
      <Title title={`${APP_NAME} - ${t('title')}`} />
      <CardContent>
        <div className={classes.header}>
          <div>
            <Typography variant="h5">{t('title')}</Typography>
            <Typography variant="body2" color="textSecondary">
              {t('pageHelp')}
            </Typography>
          </div>
          {firstYear &&
            playButton(
              'all',
              t('playHistory'),
              <TrendingFlatIcon />,
              { from: firstYear, to: lastYear, mode: JOURNEY },
              'contained',
            )}
        </div>

        {!eras && (
          <div className={classes.loading}>
            <CircularProgress />
          </div>
        )}
        {eras && !eras.years.length && (
          <Typography color="textSecondary">{t('empty')}</Typography>
        )}

        {eras?.years.length > 0 && (
          <>
            <div className={classes.decades}>
              {decades.map((d) => (
                <Chip
                  key={d.decade}
                  label={`${d.decade}s · ${d.songs.toLocaleString()}`}
                  color={from === d.from && to === d.to ? 'primary' : 'default'}
                  onClick={() => go(d)}
                />
              ))}
            </div>
            <ActivityChart
              bars={bars}
              onSelect={(bar) => go({ from: bar.from, to: bar.to })}
              describe={(bar) => `${bar.from}: ${songsLabel(bar.plays)}`}
              axisLabel={(year) => year}
              active={(bar) => bar.from >= from && bar.to <= to}
            />
            {eras.undated > 0 && (
              <Typography variant="caption" color="textSecondary">
                {t('undated', { smart_count: eras.undated })}
              </Typography>
            )}
          </>
        )}

        {name && eras?.years.length > 0 && (
          <>
            <div className={classes.era}>
              <Tooltip title={eraName(prev.from, prev.to)}>
                <span>
                  <IconButton
                    aria-label={t('earlier')}
                    disabled={prev.to < firstYear}
                    onClick={() => go(prev)}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <div>
                <Typography variant="h4">
                  {isDecade(from, to) ? t('theDecade', { name }) : name}
                </Typography>
                {era && (
                  <Typography variant="body2" color="textSecondary">
                    {t('summary', {
                      songs: songsLabel(era.songs),
                      percent: percent(era.played, era.songs),
                    })}
                  </Typography>
                )}
              </div>
              <Tooltip title={eraName(next.from, next.to)}>
                <span>
                  <IconButton
                    aria-label={t('later')}
                    disabled={next.from > lastYear}
                    onClick={() => go(next)}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </div>

            <div className={classes.actions}>
              {playButton(
                'shuffle',
                t('shuffle', { name }),
                <ShuffleIcon />,
                { from, to, mode: SHUFFLE },
                'contained',
              )}
              {from !== to &&
                playButton(
                  'journey',
                  t('journey', { name }),
                  <TrendingFlatIcon />,
                  {
                    from,
                    to,
                    mode: JOURNEY,
                  },
                )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={unplayed}
                    onChange={(e) => setUnplayed(e.target.checked)}
                    color="primary"
                  />
                }
                label={t('unplayed')}
              />
            </div>

            {!era && (
              <div className={classes.loading}>
                <CircularProgress size={24} />
              </div>
            )}
            {era && era.songs === 0 && (
              <Typography color="textSecondary">
                {t('emptyEra', { name })}
              </Typography>
            )}
            {era?.songs > 0 && (
              <>
                {era.genres.length > 0 && (
                  <>
                    <Typography variant="subtitle1">{t('genres')}</Typography>
                    <div className={classes.genres}>
                      {era.genres.map((g) => (
                        <Chip
                          key={g.name}
                          variant="outlined"
                          icon={
                            starting === `genre-${g.name}` ? (
                              <CircularProgress size={14} />
                            ) : (
                              <ShuffleIcon fontSize="small" />
                            )
                          }
                          label={`${g.name} · ${g.songs.toLocaleString()}`}
                          disabled={!!starting}
                          onClick={() =>
                            play(`genre-${g.name}`, {
                              from,
                              to,
                              mode: SHUFFLE,
                              genre: g.name,
                            })
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <CountList
                      title={t('artists')}
                      kind="artist"
                      items={era.artists}
                      detail={(a) =>
                        t('heard', {
                          played: a.plays,
                          songs: songsLabel(a.songs),
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <CountList
                      title={t('albums')}
                      kind="album"
                      items={era.albums}
                      detail={(a) =>
                        translate('listening.holes.onIpods', {
                          smart_count: a.ipods,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <CountList
                      title={t('ipods')}
                      kind="ipod"
                      items={era.ipods}
                      detail={(i) => songsLabel(i.songs)}
                    />
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default ErasPage
