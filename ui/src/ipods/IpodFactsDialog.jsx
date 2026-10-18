import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useDataProvider, useNotify, useTranslate } from 'react-admin'
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
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { FaLightbulb, FaPlay, FaShuffle } from 'react-icons/fa6'
import { DialogTitle } from '../dialogs/DialogTitle'
import { DialogContent } from '../dialogs/DialogContent'
import { httpClient } from '../dataProvider'
import { setTrack } from '../actions'
import { pickSuperlatives } from './superlatives'

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

  const fetchFacts = useCallback(() => {
    setError(false)
    return httpClient('/api/ipods/facts')
      .then(({ json }) => setFacts(json))
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (open) fetchFacts()
  }, [open, fetchFacts])

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

            <Section title={t('topDuplicates')}>
              {facts.topDuplicateSongs.length === 0 ? (
                <Typography color="textSecondary">
                  {t('noDuplicates')}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {facts.topDuplicateSongs.map((song, idx) => (
                    <ListItem key={song.id} divider>
                      <span className={classes.rank}>{idx + 1}</span>
                      <ListItemText
                        primary={`${song.title} — ${song.artist}`}
                        secondary={`${t('onIpods', { smart_count: song.ipodCount })}: ${song.ipodNames.join(', ')}`}
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
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Section>

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

            <Section title={t('superlatives')}>
              <Grid container spacing={2}>
                {pickSuperlatives(facts.superlatives).map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.key}>
                    <Card variant="outlined" className={classes.tile}>
                      <CardContent>
                        <Typography variant="overline">
                          {t(`superlative.${p.key}`)}
                        </Typography>
                        <Typography variant="subtitle1">
                          {p.ipod.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {p.value(p.ipod)}
                        </Typography>
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
