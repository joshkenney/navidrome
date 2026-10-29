import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import { useDataProvider, useNotify, useTranslate } from 'react-admin'
import { Button, IconButton, Paper, Slide, Typography } from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import CloseIcon from '@material-ui/icons/Close'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import { WELCOME_CLOSED_EVENT } from '../dialogs/WelcomeDialog'
import { playTracks } from '../actions'
import { fetchListeningMatch } from './api'

// Set at login (see authProvider): the card shows once after each login
export const SHOW_MATCH_KEY = 'show-listening-match'

// Wait after the welcome dialog closes, so the two don't show at once
const SHOW_DELAY = 1500

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    right: theme.spacing(2),
    bottom: theme.spacing(12), // Above the player
    width: 340,
    maxWidth: `calc(100vw - ${theme.spacing(4)}px)`,
    padding: theme.spacing(2),
    zIndex: theme.zIndex.snackbar,
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1) },
  title: { flex: 1 },
  venn: { display: 'block', margin: theme.spacing(1, 'auto') },
  caption: { marginBottom: theme.spacing(1) },
  songs: { margin: theme.spacing(1, 0), paddingLeft: theme.spacing(2) },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}))

const displayName = (listener) => listener.name || listener.username

// Two overlapping circles: the user's artists, the listener's, and the ones they share
export const MatchVenn = ({ venn, me, them, className }) => {
  const theme = useTheme()
  const mineOnly = venn.mine - venn.shared
  const theirsOnly = venn.theirs - venn.shared
  const text = theme.palette.text.primary
  const label = (x, y, value, size = 18) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={size}
      fill={text}
    >
      {value}
    </text>
  )
  return (
    <svg
      className={className}
      width={260}
      height={130}
      viewBox="0 0 260 130"
      role="img"
      aria-label={`${me}: ${venn.mine}, ${them}: ${venn.theirs}, ${venn.shared}`}
    >
      <circle
        cx={95}
        cy={60}
        r={52}
        fill={theme.palette.primary.main}
        fillOpacity={0.35}
      />
      <circle
        cx={165}
        cy={60}
        r={52}
        fill={theme.palette.secondary.main}
        fillOpacity={0.35}
      />
      {label(70, 60, mineOnly)}
      {label(130, 60, venn.shared, 20)}
      {label(190, 60, theirsOnly)}
      {label(70, 124, me, 12)}
      {label(190, 124, them, 12)}
    </svg>
  )
}

// Shown once after logging in: what the listener closest to the user's taste has been playing
// lately, that the user hasn't. "Josh has been listening to X, I think you'd enjoy it"
export const ListeningMatchCard = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const history = useHistory()
  const [match, setMatch] = useState(null)
  const [open, setOpen] = useState(false)
  const t = (key, opts) => translate(`listening.match.${key}`, opts)

  useEffect(() => {
    if (localStorage.getItem(SHOW_MATCH_KEY) !== 'true') return
    localStorage.removeItem(SHOW_MATCH_KEY)
    let cancelled = false
    let timer
    const show = () => {
      timer = setTimeout(() => !cancelled && setOpen(true), SHOW_DELAY)
    }
    fetchListeningMatch()
      .then((json) => {
        if (cancelled || !json?.listener || !json?.artist) return
        setMatch(json)
        if (localStorage.getItem('show-welcome') === 'true') {
          window.addEventListener(WELCOME_CLOSED_EVENT, show, { once: true })
        } else {
          show()
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener(WELCOME_CLOSED_EVENT, show)
    }
  }, [])

  if (!match) return null
  const them = displayName(match.listener)
  const close = () => setOpen(false)

  const play = async () => {
    const ids = match.songs.map((s) => s.id)
    if (!ids.length) {
      history.push(`/artist/${match.artist.id}/show`)
      close()
      return
    }
    try {
      const { data } = await dataProvider.getMany('song', { ids })
      const songs = Object.fromEntries(data.map((s) => [s.id, s]))
      dispatch(
        playTracks(
          songs,
          ids.filter((id) => songs[id]),
        ),
      )
      close()
    } catch (e) {
      notify('ra.page.error', 'warning')
    }
  }

  const shared = match.venn.sharedTop.map((a) => a.name)
  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Paper elevation={8} className={classes.root} role="dialog">
        <div className={classes.header}>
          <Typography variant="subtitle1" className={classes.title}>
            {t('title', { name: them, artist: match.artist.name })}
          </Typography>
          <IconButton
            size="small"
            aria-label={translate('ra.action.close')}
            onClick={close}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <Typography variant="body2">{t('enjoy')}</Typography>
        {match.songs.length > 0 && (
          <ul className={classes.songs}>
            {match.songs.map((s) => (
              <li key={s.id}>
                <Typography variant="body2">
                  {s.name}
                  {s.plays > 1 && (
                    <Typography
                      component="span"
                      variant="body2"
                      color="textSecondary"
                    >
                      {' '}
                      · {translate('listening.plays', { smart_count: s.plays })}
                    </Typography>
                  )}
                </Typography>
              </li>
            ))}
          </ul>
        )}
        <MatchVenn
          className={classes.venn}
          venn={match.venn}
          me={t('you')}
          them={them}
        />
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.caption}
        >
          {match.venn.shared > 0
            ? t('shared', {
                smart_count: match.venn.shared,
                name: them,
                days: match.days,
                artists: shared.join(', '),
              })
            : t('nothingShared', { name: them, days: match.days })}
        </Typography>
        <div className={classes.actions}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={play}
          >
            {t('play', { artist: match.artist.name })}
          </Button>
          <Button
            size="small"
            onClick={() => {
              history.push(`/timeline?user=${match.listener.id}`)
              close()
            }}
          >
            {t('timeline', { name: them })}
          </Button>
        </div>
      </Paper>
    </Slide>
  )
}

export default ListeningMatchCard
