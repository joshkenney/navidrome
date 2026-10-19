import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Title, useNotify, useTranslate } from 'react-admin'
import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import DeleteIcon from '@material-ui/icons/DeleteOutline'
import { FaRadio, FaShuffle } from 'react-icons/fa6'
import { httpClient } from '../dataProvider'
import {
  SURPRISE,
  getAdventure,
  playIpodRadio,
  stopRadioSession,
  useRadioSession,
  useRadioStarting,
} from './radio'
import { IpodLabel } from './IpodLabel'
import { APP_NAME } from '../common/Title'

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(2) },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  actions: { display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' },
  playing: { marginTop: theme.spacing(2) },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  empty: { padding: theme.spacing(3, 0) },
}))

const HISTORY_URL = '/api/ipods/radio/history'

// The label of a radio's "how adventurous" setting
const adventureKey = (adventure) =>
  adventure < -0.33 ? 'mainstream' : adventure > 0.33 ? 'deepCuts' : 'balanced'

// iPod Radio page: start a radio, and start again any of the last 50 radios
const IpodRadioPage = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const session = useRadioSession()
  // While a radio starts, its button shows a spinner and the others wait
  const starting = useRadioStarting()
  const [history, setHistory] = useState(null)
  const t = (key, opts) => translate(`ipods.radio.${key}`, opts)

  const load = useCallback(
    () =>
      httpClient(HISTORY_URL)
        .then(({ json }) => setHistory(json || []))
        .catch(() => setHistory([])),
    [],
  )

  // Reload when a radio starts, as it is added to the history
  useEffect(() => {
    load()
  }, [load, session?.seed?.id])

  const start = (options) =>
    playIpodRadio(dispatch, notify, options).catch(() =>
      notify('ra.page.error', 'warning'),
    )

  const remove = (seedId) =>
    httpClient(`${HISTORY_URL}?seedId=${encodeURIComponent(seedId)}`, {
      method: 'DELETE',
    })
      .then(({ json }) => setHistory(json || []))
      .catch(() => notify('ra.page.error', 'warning'))

  const clear = () => {
    if (!window.confirm(t('clearConfirm'))) return
    httpClient(HISTORY_URL, { method: 'DELETE' })
      .then(() => setHistory([]))
      .catch(() => notify('ra.page.error', 'warning'))
  }

  return (
    <Card className={classes.root}>
      <Title title={`${APP_NAME} - ` + t('title')} />
      <CardContent>
        <div className={classes.header}>
          <div>
            <Typography variant="h5">{t('title')}</Typography>
            <Typography variant="body2" color="textSecondary">
              {t('pageHelp')}
            </Typography>
          </div>
          <div className={classes.actions}>
            <Button
              variant="contained"
              color="primary"
              startIcon={
                starting === SURPRISE ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <FaShuffle size={14} />
                )
              }
              disabled={!!starting}
              onClick={() => start({ adventure: getAdventure() })}
            >
              {t('surprise')}
            </Button>
            {session && (
              <Button variant="outlined" onClick={stopRadioSession}>
                {t('stop')}
              </Button>
            )}
          </div>
        </div>

        {session && (
          <Typography variant="body2" className={classes.playing}>
            {t('playingFrom', {
              title: session.seed.title,
              artist: session.seed.artist,
            })}
          </Typography>
        )}

        <Typography variant="h6" className={classes.playing}>
          {t('history')}
        </Typography>
        {history?.length === 0 && (
          <Typography color="textSecondary" className={classes.empty}>
            {t('historyEmpty')}
          </Typography>
        )}
        {history?.length > 0 && (
          <>
            <List dense>
              {history.map((entry) => (
                <ListItem key={entry.seedId} divider>
                  <ListItemText
                    primary={`${entry.title} — ${entry.artist}`}
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <div className={classes.meta}>
                        <IpodLabel
                          libraryId={entry.libraryId}
                          libraryName={entry.libraryName}
                        />
                        <span>{t(adventureKey(entry.adventure))}</span>
                        {entry.surprise && <span>· {t('surprise')}</span>}
                        <span>
                          · {new Date(entry.startedAt).toLocaleString()}
                        </span>
                      </div>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title={t('playAgain')}>
                      <span>
                        <IconButton
                          aria-label={t('playAgain')}
                          aria-busy={starting === entry.seedId}
                          disabled={!!starting}
                          onClick={() =>
                            start({
                              songId: entry.seedId,
                              adventure: entry.adventure,
                            })
                          }
                        >
                          {starting === entry.seedId ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <FaRadio size={16} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('remove')}>
                      <IconButton
                        edge="end"
                        aria-label={t('remove')}
                        onClick={() => remove(entry.seedId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Button size="small" onClick={clear}>
              {t('clearHistory')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default IpodRadioPage
