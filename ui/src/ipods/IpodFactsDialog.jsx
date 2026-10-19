import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Link,
  useDataProvider,
  useNotify,
  usePermissions,
  useTranslate,
} from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Link as MuiLink,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaLightbulb, FaPlay, FaRadio, FaShuffle } from 'react-icons/fa6'
import { DialogTitle } from '../dialogs/DialogTitle'
import { DialogContent } from '../dialogs/DialogContent'
import { httpClient } from '../dataProvider'
import { setTrack } from '../actions'
import { pickSuperlatives } from './superlatives'
import { useBrowseIpod } from './useBrowseIpod'
import { playIpodRadio } from './radio'
import { TasteBadge } from './TasteBadge'
import { tasteLabelOf } from './taste'
import { tribeColor } from './tribes'
import { RenameTribeButton } from './RenameTribeButton'

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  section: { marginTop: theme.spacing(3) },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  tile: { height: '100%', textAlign: 'center' },
  tileValue: { fontWeight: 700 },
  rank: {
    minWidth: '2em',
    fontWeight: 700,
    color: theme.palette.text.secondary,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.5) },
  dot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: theme.spacing(0.75),
  },
  tribeCard: { height: '100%' },
  tribeLine: { marginTop: theme.spacing(1) },
  center: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}))

const Section = ({ title, action, children }) => {
  const classes = useStyles()
  return (
    <div className={classes.section}>
      <div className={classes.sectionHeader}>
        <Typography variant="h6">{title}</Typography>
        {action}
      </div>
      {children}
    </div>
  )
}

// An iPod name that opens the iPod's albums
const IpodLink = ({ ipod, onBrowse }) => (
  <MuiLink
    component="button"
    variant="subtitle1"
    color="inherit"
    underline="hover"
    onClick={() => onBrowse(ipod.id)}
  >
    {ipod.name}
  </MuiLink>
)

const StatTile = ({ label, value }) => {
  const classes = useStyles()
  return (
    <Card variant="outlined" className={classes.tile}>
      <CardContent>
        <Typography variant="h5" className={classes.tileValue}>
          {value}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  )
}

export const IpodFactsDialog = ({ open, onClose }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const [facts, setFacts] = useState(null)
  const [error, setError] = useState(false)
  const [myTaste, setMyTaste] = useState(null)
  const browseIpod = useBrowseIpod(onClose)
  const { permissions } = usePermissions()

  const fetchFacts = useCallback(() => {
    setError(false)
    return httpClient('/api/ipods/facts')
      .then(({ json }) => setFacts(json))
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (!open) return
    fetchFacts()
    httpClient('/api/ipods/taste/me')
      .then(({ json }) => setMyTaste(json || null))
      .catch(() => setMyTaste(null))
  }, [open, fetchFacts])

  const handleRadio = useCallback(
    (id) => {
      onClose()
      playIpodRadio(dispatch, notify, { songId: id }).catch(() =>
        notify('ra.page.error', 'warning'),
      )
    },
    [dispatch, notify, onClose],
  )

  const handlePlay = useCallback(
    (id) =>
      dataProvider
        .getOne('song', { id })
        .then(({ data }) => dispatch(setTrack(data)))
        .catch(() => notify('ra.page.error', 'warning')),
    [dataProvider, dispatch, notify],
  )

  const t = (key, opts) => translate(`ipods.facts.${key}`, opts)
  const totals = facts?.totals

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle onClose={onClose}>{t('title')}</DialogTitle>
      <DialogContent dividers>
        {!facts && !error && (
          <div className={classes.center}>
            <CircularProgress />
          </div>
        )}
        {error && <Typography color="error">{t('error')}</Typography>}
        {facts && (
          <>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <StatTile label={t('ipods')} value={totals.ipods} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatTile label={t('songs')} value={totals.songs} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatTile label={t('hours')} value={Math.round(totals.hours)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatTile label={t('sharedSongs')} value={totals.sharedSongs} />
              </Grid>
            </Grid>
            {(totals.topGenre || totals.topDecade > 0) && (
              <Typography variant="body2" className={classes.section}>
                {totals.topGenre &&
                  t('topGenre', { genre: totals.topGenre }) + ' '}
                {totals.topDecade > 0 &&
                  t('topDecade', { decade: totals.topDecade })}
              </Typography>
            )}
            {myTaste && (
              <div className={classes.section}>
                <Typography variant="body2" component="span">
                  {translate('ipods.taste.yours')}:{' '}
                </Typography>
                <TasteBadge score={myTaste.taste} label={myTaste.tasteLabel} />
                {myTaste.tribe && (
                  <Typography variant="body2" component="span">
                    {' '}
                    <span
                      className={classes.dot}
                      style={{ backgroundColor: tribeColor(myTaste.tribe.id) }}
                    />
                    {translate('ipods.tribes.youFit', {
                      name: myTaste.tribe.name,
                    })}
                  </Typography>
                )}
              </div>
            )}

            {facts.topDuplicateSongs.length > 0 && (
              <Section title={t('duplicates')}>
                <List dense disablePadding>
                  {facts.topDuplicateSongs.map((song, idx) => (
                    <ListItem key={song.id} divider>
                      <span className={classes.rank}>{idx + 1}</span>
                      <ListItemText
                        primary={`${song.title} — ${song.artist}`}
                        secondary={
                          <Tooltip title={song.ipodNames.join(', ')}>
                            <span>
                              {t('onIpods', { smart_count: song.ipodCount })}
                            </span>
                          </Tooltip>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title={t('play')}>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={t('play')}
                            onClick={() => handlePlay(song.id)}
                          >
                            <FaPlay size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('radio')}>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={t('radio')}
                            onClick={() => handleRadio(song.id)}
                          >
                            <FaRadio size={14} />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Section>
            )}

            {facts.topSharedArtists.length > 0 && (
              <Section title={t('topArtists')}>
                <div className={classes.chips}>
                  {facts.topSharedArtists.map((a) => (
                    <Chip
                      key={a.id}
                      label={`${a.name} · ${a.ipodCount}`}
                      component={Link}
                      to={`/artist/${a.id}/show`}
                      onClick={onClose}
                      clickable
                    />
                  ))}
                </div>
              </Section>
            )}

            {facts.twins && (
              <Section title={t('twins')}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1">
                      <IpodLink ipod={facts.twins.a} onBrowse={browseIpod} />
                      {' ♥ '}
                      <IpodLink ipod={facts.twins.b} onBrowse={browseIpod} />
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      {t('twinsAlike', {
                        percent: Math.round(facts.twins.weight * 100),
                        smart_count: facts.twins.sharedCount,
                      })}
                    </Typography>
                    <div className={classes.chips}>
                      {facts.twins.sharedArtists.map((name) => (
                        <Chip key={name} size="small" label={name} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Section>
            )}

            {facts.tribes?.length > 0 && (
              <Section title={translate('ipods.tribes.title')}>
                <Grid container spacing={2}>
                  {facts.tribes.map((tribe) => (
                    <Grid item xs={12} sm={6} md={4} key={tribe.id}>
                      <Card variant="outlined" className={classes.tribeCard}>
                        <CardContent>
                          <Typography variant="subtitle1">
                            <span
                              className={classes.dot}
                              style={{ backgroundColor: tribeColor(tribe.id) }}
                            />
                            {tribe.name}
                            {permissions === 'admin' && (
                              <RenameTribeButton
                                tribe={tribe}
                                onRenamed={fetchFacts}
                              />
                            )}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            gutterBottom
                          >
                            {translate('ipods.tribes.size', {
                              smart_count: tribe.size,
                            })}
                          </Typography>
                          <TasteBadge
                            score={tribe.taste}
                            label={tasteLabelOf(tribe.taste)}
                          />
                          {tribe.artists.length > 0 && (
                            <div
                              className={`${classes.chips} ${classes.tribeLine}`}
                            >
                              {tribe.artists.map((name) => (
                                <Chip key={name} size="small" label={name} />
                              ))}
                            </div>
                          )}
                          {tribe.examples?.length > 0 && (
                            <Typography
                              variant="body2"
                              component="div"
                              className={classes.tribeLine}
                            >
                              {translate('ipods.tribes.examples')}:{' '}
                              {tribe.examples.map((ipod, i) => (
                                <React.Fragment key={ipod.id}>
                                  {i > 0 && ', '}
                                  <IpodLink ipod={ipod} onBrowse={browseIpod} />
                                </React.Fragment>
                              ))}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Section>
            )}

            <Section title={t('superlatives')}>
              <Grid container spacing={2}>
                {pickSuperlatives(facts.superlatives).map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.key}>
                    <Card variant="outlined" className={classes.tile}>
                      <CardContent>
                        <Typography variant="overline">
                          {t(`superlative.${p.key}`)}
                        </Typography>
                        <div>
                          <IpodLink ipod={p.ipod} onBrowse={browseIpod} />
                        </div>
                        {p.key === 'deepest' || p.key === 'crowd' ? (
                          <TasteBadge
                            score={p.ipod.taste}
                            label={tasteLabelOf(p.ipod.taste)}
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            {p.value(p.ipod)}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Section>

            {facts.uniqueGems.length > 0 && (
              <Section
                title={t('gems')}
                action={
                  <Button
                    size="small"
                    startIcon={<FaShuffle size={14} />}
                    onClick={fetchFacts}
                  >
                    {t('reshuffle')}
                  </Button>
                }
              >
                <List dense disablePadding>
                  {facts.uniqueGems.map((gem) => (
                    <ListItem
                      key={gem.id}
                      button
                      divider
                      onClick={() => handlePlay(gem.id)}
                    >
                      <ListItemText
                        primary={`${gem.title} — ${gem.artist}`}
                        secondary={t('onlyOn', { name: gem.libraryName })}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title={t('radio')}>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={t('radio')}
                            onClick={() => handleRadio(gem.id)}
                          >
                            <FaRadio size={14} />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export const IpodFactsButton = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const [open, setOpen] = useState(false)
  const title = translate('ipods.facts.title')

  return (
    <>
      <Tooltip title={title}>
        <IconButton
          className={classes.button}
          onClick={() => setOpen(true)}
          aria-label={title}
          aria-haspopup="true"
        >
          <FaLightbulb size={18} />
        </IconButton>
      </Tooltip>
      {open && <IpodFactsDialog open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
