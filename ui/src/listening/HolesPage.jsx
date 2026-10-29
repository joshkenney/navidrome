import React, { useCallback, useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { Title, useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import RefreshIcon from '@material-ui/icons/Refresh'
import { APP_NAME } from '../common/Title'
import { CountList } from './CountList'
import { useOpenItem } from './useOpenItem'
import { fetchHoles } from './api'
import { addDays, formatRange, parseDay, toDay } from './dates'

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(2) },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  section: { marginTop: theme.spacing(3) },
  sectionHelp: { marginBottom: theme.spacing(1) },
  chips: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) },
  coverage: { paddingTop: 2, paddingBottom: 2 },
  bar: { height: 6, borderRadius: 3, marginTop: 4 },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}))

const percent = (c) => (c.total ? Math.round((c.played / c.total) * 100) : 0)

// How much of each iPod, decade or genre has been played, as bars
const CoverageList = ({ items, unit, onOpen }) => {
  const classes = useStyles()
  const translate = useTranslate()
  return (
    <List dense disablePadding>
      {(items || []).map((c) => (
        <ListItem
          key={c.id}
          button={!!onOpen}
          onClick={onOpen ? () => onOpen(c) : undefined}
          className={classes.coverage}
        >
          <ListItemText
            primary={c.name}
            primaryTypographyProps={{ noWrap: true }}
            secondaryTypographyProps={{ component: 'div' }}
            secondary={
              <>
                <span>
                  {translate('listening.holes.coverage', {
                    percent: percent(c),
                    played: c.played,
                    total: c.total,
                    unit: translate(`listening.holes.units.${unit}`, {
                      smart_count: c.total,
                    }),
                  })}
                </span>
                <LinearProgress
                  variant="determinate"
                  value={percent(c)}
                  className={classes.bar}
                  aria-label={c.name}
                />
              </>
            }
          />
        </ListItem>
      ))}
    </List>
  )
}

const Section = ({ title, help, children }) => {
  const classes = useStyles()
  return (
    <div className={classes.section}>
      <Typography variant="h6">{title}</Typography>
      {help && (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.sectionHelp}
        >
          {help}
        </Typography>
      )}
      {children}
    </div>
  )
}

const shortDate = (time) =>
  time
    ? new Date(time).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : ''

// The holes in a listener's listening: iPods, decades, genres, artists and albums never (or
// barely) played, favourites not played for months, the longest silences, and what other
// listeners love that this one has never played
const HolesPage = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const notify = useNotify()
  const history = useHistory()
  const { open } = useOpenItem()
  const [holes, setHoles] = useState(null)
  const [loading, setLoading] = useState(true)
  const t = (key, opts) => translate(`listening.holes.${key}`, opts)
  const plays = (n) => translate('listening.plays', { smart_count: n })

  const load = useCallback(
    (refresh) => {
      setLoading(true)
      return fetchHoles(refresh)
        .then(setHoles)
        .catch(() => notify('ra.page.error', 'warning'))
        .finally(() => setLoading(false))
    },
    [notify],
  )

  useEffect(() => {
    load(false)
  }, [load])

  // Shows a silence on the timeline, with a few days of listening around it
  const openGap = (gap) => {
    const from = toDay(addDays(parseDay(gap.from), -3))
    const to = toDay(addDays(parseDay(gap.to), 3))
    history.push(`/timeline?from=${from}&to=${to}`)
  }

  const openGenre = (genre) =>
    history.push(
      `/album?filter=${encodeURIComponent(JSON.stringify({ genre_id: [genre.id] }))}&order=ASC&sort=name`,
    )

  const summary = holes?.summary || {}
  const forgottenHelp = t('forgottenHelp', {
    smart_count: Math.round((summary.forgottenAfterDays || 180) / 30),
  })
  const lastPlayed = (item) =>
    `${plays(item.plays)} · ${t('lastPlayed', { date: shortDate(item.lastPlayed) })}`

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
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading ? <CircularProgress size={14} /> : <RefreshIcon />
            }
            disabled={loading}
            onClick={() => load(true)}
          >
            {t('refresh')}
          </Button>
        </div>

        {!holes && loading && (
          <div className={classes.loading}>
            <CircularProgress />
          </div>
        )}

        {holes && (
          <>
            <Section
              title={t('time')}
              help={
                summary.firstPlay
                  ? `${t('timeSummary', {
                      days: summary.listeningDays,
                      span: summary.spanDays,
                      first: parseDay(summary.firstPlay).toLocaleDateString(),
                    })} ${
                      summary.daysSinceLast
                        ? t('lastDaysAgo', {
                            smart_count: summary.daysSinceLast,
                          })
                        : t('lastToday')
                    }`
                  : t('timeEmpty')
              }
            >
              <div className={classes.chips}>
                {(holes.gaps || []).map((gap) => (
                  <Chip
                    key={gap.from}
                    variant="outlined"
                    label={translate('listening.timeline.silence', {
                      range: formatRange(gap.from, gap.to),
                      smart_count: gap.days,
                    })}
                    onClick={() => openGap(gap)}
                  />
                ))}
              </div>
            </Section>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Section title={t('ipods')} help={t('ipodsHelp')}>
                  <CoverageList
                    items={(holes.ipods || []).slice(0, 10)}
                    unit="songs"
                    onOpen={(c) => open('ipod', c)}
                  />
                </Section>
              </Grid>
              <Grid item xs={12} md={4}>
                <Section title={t('decades')} help={t('decadesHelp')}>
                  <CoverageList items={holes.decades} unit="songs" />
                </Section>
              </Grid>
              <Grid item xs={12} md={4}>
                <Section title={t('genres')} help={t('genresHelp')}>
                  <CoverageList
                    items={(holes.genres || []).slice(0, 12)}
                    unit="albums"
                    onOpen={openGenre}
                  />
                </Section>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Section title={t('artists')} help={t('artistsHelp')}>
                  <CountList
                    kind="artist"
                    items={holes.artists}
                    limit={12}
                    empty={t('none')}
                    detail={(a) => t('songs', { smart_count: a.songs })}
                  />
                </Section>
              </Grid>
              <Grid item xs={12} md={6}>
                <Section title={t('albums')} help={t('albumsHelp')}>
                  <CountList
                    kind="album"
                    items={holes.albums}
                    limit={12}
                    empty={t('none')}
                    detail={(a) => t('onIpods', { smart_count: a.ipods })}
                  />
                </Section>
              </Grid>
            </Grid>

            <Section title={t('forgotten')} help={forgottenHelp}>
              <Grid container spacing={3}>
                {[
                  ['artist', 'forgottenArtists'],
                  ['album', 'forgottenAlbums'],
                  ['song', 'forgottenSongs'],
                ].map(([kind, key]) => (
                  <Grid item xs={12} md={4} key={key}>
                    <CountList
                      title={t(key)}
                      kind={kind}
                      items={holes[key]}
                      limit={8}
                      empty={t('noneForgotten')}
                      detail={lastPlayed}
                    />
                  </Grid>
                ))}
              </Grid>
            </Section>

            <Section title={t('community')} help={t('communityHelp')}>
              <CountList
                kind="artist"
                items={holes.community}
                limit={16}
                empty={t('noneCommunity')}
                detail={(a) =>
                  t('lovedBy', {
                    names: a.listeners.join(', '),
                    plays: plays(a.plays),
                  })
                }
              />
            </Section>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default HolesPage
