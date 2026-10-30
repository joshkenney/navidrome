import React from 'react'
import {
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import { useTranslate } from 'react-admin'
import clsx from 'clsx'
import { IpodLabel } from '../ipods/IpodLabel'
import { IpodIcon } from '../ipods/IpodIcon'
import { useImageUrl } from '../common/useImageUrl'
import subsonic from '../subsonic'
import { useOpenItem } from './useOpenItem'

// Thumbnail size, in pixels, on phones and on larger screens
const THUMB_MOBILE = 48
const THUMB = 40

const useStyles = makeStyles((theme) => ({
  title: { marginTop: theme.spacing(2) },
  help: { marginBottom: theme.spacing(0.5) },
  secondary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  empty: { padding: theme.spacing(1, 0) },
  // Phones: larger text, taller rows, and names on up to two lines instead of cut short
  mobileItem: { minHeight: 64 },
  mobilePrimary: {
    fontSize: '1rem',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
  },
  mobileSecondary: { fontSize: '0.875rem', lineHeight: 1.4 },
  avatarCell: { minWidth: (p) => p.thumb + theme.spacing(1.5) },
}))

const useThumbStyles = makeStyles((theme) => ({
  thumb: {
    width: (p) => p.size,
    height: (p) => p.size,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  square: { borderRadius: 4 },
}))

// Phones and small tablets (the theme's "sm" and below), without needing the theme
export const useIsMobileList = () => useMediaQuery('(max-width:959.95px)')
export const thumbSize = (isMobile) => (isMobile ? THUMB_MOBILE : THUMB)

// The picture of an item: the cover of an album or song, an artist's image, or the iPod logo. The
// server sends its default picture (the music note) for albums and artists without one
const coverId = (kind, item) => {
  switch (kind) {
    case 'album':
      return `al-${item.albumId || item.id}`
    case 'song':
      return `mf-${item.id}`
    case 'artist':
      return `ar-${item.id}`
    default:
      return null
  }
}

export const CountThumb = ({ kind, item, size = THUMB }) => {
  const classes = useThumbStyles({ size })
  const artId = coverId(kind, item)
  const url = artId
    ? subsonic.getCoverArtUrlById(artId, {
        updatedAt: item.updatedAt,
        size: 120,
        square: kind !== 'artist',
      })
    : null
  const { imgUrl } = useImageUrl(url)
  return (
    <Avatar
      className={clsx(classes.thumb, kind !== 'artist' && classes.square)}
      variant={kind === 'artist' ? 'circular' : 'rounded'}
      src={imgUrl || undefined}
      alt=""
      data-testid={`thumb-${kind}`}
    >
      {kind === 'ipod' ? <IpodIcon size={20} /> : <span />}
    </Avatar>
  )
}

// A list of artists, albums, songs or iPods from the listening history. "detail" gives the
// right-hand text of each item (like "12 plays"). Albums and songs can be played
export const CountList = ({
  title,
  help,
  kind,
  items,
  detail,
  empty,
  limit,
}) => {
  const isMobile = useIsMobileList()
  const classes = useStyles({ thumb: thumbSize(isMobile) })
  const translate = useTranslate()
  const { open, play } = useOpenItem()
  const shown = limit ? (items || []).slice(0, limit) : items || []
  const playable = kind === 'album' || kind === 'song'
  return (
    <div>
      {title && (
        <Typography variant="subtitle1" className={classes.title}>
          {title}
        </Typography>
      )}
      {help && (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.help}
        >
          {help}
        </Typography>
      )}
      {shown.length === 0 && empty && (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.empty}
        >
          {empty}
        </Typography>
      )}
      <List dense={!isMobile} disablePadding>
        {shown.map((item) => (
          <ListItem
            key={`${kind}-${item.id}`}
            button
            className={clsx(isMobile && classes.mobileItem)}
            onClick={() => open(kind, item)}
          >
            <ListItemAvatar className={classes.avatarCell}>
              <CountThumb kind={kind} item={item} size={thumbSize(isMobile)} />
            </ListItemAvatar>
            <ListItemText
              primary={item.name}
              primaryTypographyProps={
                isMobile
                  ? { className: classes.mobilePrimary }
                  : { noWrap: true }
              }
              secondaryTypographyProps={{
                component: 'div',
                className: clsx(isMobile && classes.mobileSecondary),
              }}
              secondary={
                <div className={classes.secondary}>
                  {item.artist && <span>{item.artist}</span>}
                  {kind !== 'ipod' && item.libraryId > 0 && (
                    <IpodLabel
                      libraryId={item.libraryId}
                      libraryName={item.libraryName}
                      size={isMobile ? 14 : 12}
                    />
                  )}
                  {detail && <span>{detail(item)}</span>}
                </div>
              }
            />
            {playable && (
              <ListItemSecondaryAction>
                <Tooltip title={translate('ra.action.play', { _: 'Play' })}>
                  <IconButton
                    edge="end"
                    size={isMobile ? 'medium' : 'small'}
                    aria-label={translate('ra.action.play', { _: 'Play' })}
                    onClick={() => play(kind, item)}
                  >
                    <PlayArrowIcon fontSize={isMobile ? 'default' : 'small'} />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            )}
          </ListItem>
        ))}
      </List>
    </div>
  )
}

export default CountList
