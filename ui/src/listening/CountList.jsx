import React from 'react'
import {
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import { useTranslate } from 'react-admin'
import { IpodLabel } from '../ipods/IpodLabel'
import { useOpenItem } from './useOpenItem'

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
}))

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
  const classes = useStyles()
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
      <List dense disablePadding>
        {shown.map((item) => (
          <ListItem
            key={`${kind}-${item.id}`}
            button
            onClick={() => open(kind, item)}
          >
            <ListItemText
              primary={item.name}
              primaryTypographyProps={{ noWrap: true }}
              secondaryTypographyProps={{ component: 'div' }}
              secondary={
                <div className={classes.secondary}>
                  {item.artist && <span>{item.artist}</span>}
                  {kind !== 'ipod' && item.libraryId > 0 && (
                    <IpodLabel
                      libraryId={item.libraryId}
                      libraryName={item.libraryName}
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
                    size="small"
                    aria-label={translate('ra.action.play', { _: 'Play' })}
                    onClick={() => play(kind, item)}
                  >
                    <PlayArrowIcon fontSize="small" />
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
