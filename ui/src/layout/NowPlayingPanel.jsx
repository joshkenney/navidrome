import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslate, Link, useNotify } from 'react-admin'
import {
  Popover,
  IconButton,
  makeStyles,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Card,
  CardContent,
  Typography,
  useTheme,
  useMediaQuery,
  Button,
} from '@material-ui/core'
import { FaRegCirclePlay, FaHeadphones } from 'react-icons/fa6'
import subsonic from '../subsonic'
import { httpClient } from '../dataProvider'
import { useInterval } from '../common'
import { nowPlayingCountUpdate, setTrack } from '../actions'
import config from '../config'

const useStyles = makeStyles((theme) => ({
  button: { color: 'inherit' },
  list: {
    width: '30em',
    maxHeight: (props) => {
      const entryHeight = 80
      const maxEntries = Math.min(props.entryCount || 0, 4)
      return maxEntries > 0 ? `${maxEntries * entryHeight}px` : '12em'
    },
    overflowY: 'auto',
    padding: 0,
  },
  card: {
    padding: 0,
  },
  cardContent: {
    padding: `${theme.spacing(1)}px !important`,
    '&:last-child': {
      paddingBottom: `${theme.spacing(1)}px !important`,
    },
  },
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: 0,
  },
  tabButton: {
    flex: 1,
    borderRadius: 0,
    textTransform: 'none',
    fontSize: '0.85rem',
    minHeight: 36,
    borderBottom: '2px solid transparent',
  },
  tabButtonActive: {
    borderBottom: `2px solid ${theme.palette.primary.main}`,
    color: theme.palette.primary.main,
  },
  listItem: {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  avatar: {
    width: theme.spacing(6),
    height: theme.spacing(6),
    cursor: 'pointer',
    '&:hover': {
      opacity: 0.8,
    },
  },
  badge: {
    '& .MuiBadge-badge': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
  },
  artistLink: {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  primaryText: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tuneInButton: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.primary.main,
    },
  },
  usernameChip: {
    fontWeight: 600,
    marginRight: theme.spacing(0.5),
  },
}))

// NowPlayingButton component - handles the button with badge
const NowPlayingButton = React.memo(({ count, onClick }) => {
  const classes = useStyles()
  const translate = useTranslate()

  return (
    <Tooltip title={translate('nowPlaying.title')}>
      <IconButton
        className={classes.button}
        onClick={onClick}
        aria-label={translate('nowPlaying.title')}
        aria-haspopup="true"
      >
        <Badge
          badgeContent={count}
          color="primary"
          overlap="rectangular"
          className={classes.badge}
        >
          <FaRegCirclePlay size={20} />
        </Badge>
      </IconButton>
    </Tooltip>
  )
})

NowPlayingButton.displayName = 'NowPlayingButton'

NowPlayingButton.propTypes = {
  count: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
}

// LiveNowPlayingItem - individual now-playing entry with Tune In
const LiveNowPlayingItem = React.memo(
  ({ nowPlayingEntry, onLinkClick, getArtistLink, onTuneIn }) => {
    const classes = useStyles()
    const translate = useTranslate()

    return (
      <ListItem key={nowPlayingEntry.playerId} className={classes.listItem}>
        <ListItemAvatar>
          <Link
            to={`/album/${nowPlayingEntry.albumId}/show`}
            onClick={onLinkClick}
          >
            <Avatar
              className={classes.avatar}
              src={subsonic.getCoverArtUrl(nowPlayingEntry, 80)}
              variant="square"
              alt={`${nowPlayingEntry.album} cover art`}
              loading="lazy"
            />
          </Link>
        </ListItemAvatar>
        <ListItemText
          primary={
            <div className={classes.primaryText}>
              {nowPlayingEntry.albumArtistId || nowPlayingEntry.artistId ? (
                <Link
                  to={getArtistLink(
                    nowPlayingEntry.albumArtistId || nowPlayingEntry.artistId,
                  )}
                  className={classes.artistLink}
                  onClick={onLinkClick}
                >
                  {nowPlayingEntry.albumArtist || nowPlayingEntry.artist}
                </Link>
              ) : (
                <span>
                  {nowPlayingEntry.albumArtist || nowPlayingEntry.artist}
                </span>
              )}
              &nbsp;-&nbsp;{nowPlayingEntry.title}
            </div>
          }
          secondary={`${nowPlayingEntry.username}${nowPlayingEntry.playerName ? ` (${nowPlayingEntry.playerName})` : ''} • ${translate('nowPlaying.minutesAgo', { smart_count: nowPlayingEntry.minutesAgo })}${nowPlayingEntry.libraryName ? ` • ${nowPlayingEntry.libraryName}` : ''}`}
        />
        <Tooltip title={translate('nowPlaying.tuneIn')}>
          <IconButton
            size="small"
            className={classes.tuneInButton}
            onClick={() => onTuneIn(nowPlayingEntry)}
            aria-label={translate('nowPlaying.tuneIn')}
          >
            <FaHeadphones size={16} />
          </IconButton>
        </Tooltip>
      </ListItem>
    )
  },
)

LiveNowPlayingItem.displayName = 'LiveNowPlayingItem'

LiveNowPlayingItem.propTypes = {
  nowPlayingEntry: PropTypes.object.isRequired,
  onLinkClick: PropTypes.func.isRequired,
  getArtistLink: PropTypes.func.isRequired,
  onTuneIn: PropTypes.func.isRequired,
}

// RecentItem - an entry from the recent scrobble feed
const RecentItem = React.memo(
  ({ entry, onLinkClick, getArtistLink, onPlay }) => {
    const classes = useStyles()
    const translate = useTranslate()

    const timeAgo = useCallback(() => {
      const diffMs = Date.now() - new Date(entry.submissionTime).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1)
        return translate('nowPlaying.minutesAgo', { smart_count: 0 })
      if (diffMins < 60)
        return translate('nowPlaying.minutesAgo', { smart_count: diffMins })
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return `${Math.floor(diffHours / 24)}d ago`
    }, [entry.submissionTime, translate])

    return (
      <ListItem className={classes.listItem}>
        <ListItemAvatar>
          <Link to={`/album/${entry.albumId}/show`} onClick={onLinkClick}>
            <Avatar
              className={classes.avatar}
              src={subsonic.getCoverArtUrl(
                {
                  id: entry.id,
                  album: entry.album,
                  updatedAt: entry.updatedAt,
                },
                80,
              )}
              variant="square"
              alt={`${entry.album} cover art`}
              loading="lazy"
            />
          </Link>
        </ListItemAvatar>
        <ListItemText
          primary={
            <div className={classes.primaryText}>
              {entry.artistId ? (
                <Link
                  to={getArtistLink(entry.albumArtistId || entry.artistId)}
                  className={classes.artistLink}
                  onClick={onLinkClick}
                >
                  {entry.artist}
                </Link>
              ) : (
                <span>{entry.artist}</span>
              )}
              &nbsp;-&nbsp;{entry.title}
            </div>
          }
          secondary={
            <>
              <span className={classes.usernameChip}>{entry.username}</span>
              &bull; {timeAgo()}
              {entry.libraryName ? ` • ${entry.libraryName}` : ''}
            </>
          }
        />
        <Tooltip title={translate('nowPlaying.play')}>
          <IconButton
            size="small"
            className={classes.tuneInButton}
            onClick={() => onPlay(entry)}
            aria-label={translate('nowPlaying.play')}
          >
            <FaRegCirclePlay size={16} />
          </IconButton>
        </Tooltip>
      </ListItem>
    )
  },
)

RecentItem.displayName = 'RecentItem'

RecentItem.propTypes = {
  entry: PropTypes.object.isRequired,
  onLinkClick: PropTypes.func.isRequired,
  getArtistLink: PropTypes.func.isRequired,
  onPlay: PropTypes.func.isRequired,
}

// TabBar component
const TabBar = React.memo(({ activeTab, onTabChange }) => {
  const classes = useStyles()
  const translate = useTranslate()

  return (
    <div className={classes.tabBar}>
      <Button
        className={`${classes.tabButton} ${activeTab === 'live' ? classes.tabButtonActive : ''}`}
        onClick={() => onTabChange('live')}
        disableRipple
      >
        {translate('nowPlaying.tabLive')}
      </Button>
      <Button
        className={`${classes.tabButton} ${activeTab === 'recent' ? classes.tabButtonActive : ''}`}
        onClick={() => onTabChange('recent')}
        disableRipple
      >
        {translate('nowPlaying.tabRecent')}
      </Button>
    </div>
  )
})

TabBar.displayName = 'TabBar'

TabBar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
}

// Main NowPlayingPanel component
const NowPlayingPanel = () => {
  const dispatch = useDispatch()
  const count = useSelector((state) => state.activity.nowPlayingCount)
  const streamReconnected = useSelector(
    (state) => state.activity.streamReconnected,
  )
  const serverUp = useSelector(
    (state) => !!state.activity.serverStart.startTime,
  )
  const translate = useTranslate()
  const notify = useNotify()
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const [anchorEl, setAnchorEl] = useState(null)
  const [liveEntries, setLiveEntries] = useState([])
  const [recentEntries, setRecentEntries] = useState([])
  const [activeTab, setActiveTab] = useState('live')
  const open = Boolean(anchorEl)

  const handleMenuOpen = useCallback((event) => {
    setAnchorEl(event.currentTarget)
  }, [])

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null)
  }, [])

  const handleLinkClick = useCallback(() => {
    if (isSmallScreen) {
      handleMenuClose()
    }
  }, [isSmallScreen, handleMenuClose])

  const getArtistLink = useCallback((artistId) => {
    if (!artistId) return null
    return config.devShowArtistPage && artistId !== config.variousArtistsId
      ? `/artist/${artistId}/show`
      : `/album?filter={"artist_id":"${artistId}"}&order=ASC&sort=max_year&displayedFilters={"compilation":true}&perPage=15`
  }, [])

  const fetchLive = useCallback(
    () =>
      subsonic
        .getNowPlaying()
        .then((resp) => resp.json['subsonic-response'])
        .then((data) => {
          if (data.status === 'ok') {
            const entries = data.nowPlaying?.entry || []
            setLiveEntries(entries)
            dispatch(nowPlayingCountUpdate({ count: entries.length }))
          } else {
            throw new Error(
              data.error?.message || 'Failed to fetch now playing',
            )
          }
        })
        .catch((error) => {
          notify('ra.page.error', 'warning', {
            messageArgs: { error: error.message || 'Unknown error' },
          })
        }),
    [dispatch, notify],
  )

  const fetchRecent = useCallback(
    () =>
      httpClient('/api/activity/recent?count=50')
        .then((resp) => {
          setRecentEntries(resp.json || [])
        })
        .catch((error) => {
          notify('ra.page.error', 'warning', {
            messageArgs: { error: error.message || 'Unknown error' },
          })
        }),
    [notify],
  )

  const handleTuneIn = useCallback(
    (entry) => {
      const offset = entry.currentPosition || 0
      dispatch(
        setTrack({
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          album: entry.album,
          albumId: entry.albumId,
          artistId: entry.artistId,
          albumArtistId: entry.albumArtistId,
          duration: entry.duration,
          updatedAt: entry.updatedAt,
          startOffset: offset,
        }),
      )
      handleMenuClose()
    },
    [dispatch, handleMenuClose],
  )

  const handlePlay = useCallback(
    (entry) => {
      dispatch(
        setTrack({
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          album: entry.album,
          albumId: entry.albumId,
          artistId: entry.artistId,
          albumArtistId: entry.albumArtistId,
          duration: entry.duration,
          updatedAt: entry.updatedAt,
        }),
      )
      handleMenuClose()
    },
    [dispatch, handleMenuClose],
  )

  // Initialize on mount and on server/stream changes
  useEffect(() => {
    if (serverUp) fetchLive()
  }, [fetchLive, serverUp, streamReconnected])

  // Refresh live when count changes (if panel is open)
  useEffect(() => {
    if (open && serverUp) fetchLive()
  }, [count, open, fetchLive, serverUp])

  // Fetch recent when tab becomes active
  useEffect(() => {
    if (open && activeTab === 'recent' && serverUp) fetchRecent()
  }, [open, activeTab, serverUp, fetchRecent])

  // Periodic refresh - live tab (10s when open, 60s when closed)
  useInterval(
    () => {
      if (open && activeTab === 'live' && serverUp) fetchLive()
    },
    open && activeTab === 'live' ? 10000 : null,
  )

  useInterval(
    () => {
      if (!open && serverUp) fetchLive()
    },
    !open ? 60000 : null,
  )

  // Periodic refresh - recent tab (30s when open)
  useInterval(
    () => {
      if (open && activeTab === 'recent' && serverUp) fetchRecent()
    },
    open && activeTab === 'recent' ? 30000 : null,
  )

  const displayEntries = activeTab === 'live' ? liveEntries : recentEntries

  return (
    <div>
      <NowPlayingButton count={count} onClick={handleMenuOpen} />
      <Popover
        id="panel-nowplaying"
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={open}
        onClose={handleMenuClose}
        aria-labelledby="now-playing-title"
      >
        <Card style={{ padding: 0 }}>
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <CardContent
            style={{
              padding: `${theme.spacing(1)}px`,
              paddingBottom: `${theme.spacing(1)}px`,
            }}
          >
            {displayEntries.length === 0 ? (
              <Typography
                id="now-playing-title"
                style={{ padding: theme.spacing(1) }}
              >
                {activeTab === 'live'
                  ? translate('nowPlaying.empty')
                  : translate('nowPlaying.recentEmpty')}
              </Typography>
            ) : (
              <List
                style={{
                  width: '30em',
                  maxHeight: `${Math.min(displayEntries.length, 4) * 80}px`,
                  overflowY: 'auto',
                  padding: 0,
                }}
                dense
                aria-label={
                  activeTab === 'live'
                    ? translate('nowPlaying.title')
                    : translate('nowPlaying.tabRecent')
                }
              >
                {activeTab === 'live'
                  ? liveEntries.map((entry) => (
                      <LiveNowPlayingItem
                        key={entry.playerId}
                        nowPlayingEntry={entry}
                        onLinkClick={handleLinkClick}
                        getArtistLink={getArtistLink}
                        onTuneIn={handleTuneIn}
                      />
                    ))
                  : recentEntries.map((entry, idx) => (
                      <RecentItem
                        key={`${entry.id}-${idx}`}
                        entry={entry}
                        onLinkClick={handleLinkClick}
                        getArtistLink={getArtistLink}
                        onPlay={handlePlay}
                      />
                    ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Popover>
    </div>
  )
}

NowPlayingPanel.propTypes = {}

export default NowPlayingPanel
