import React, { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import { useGetOne, useNotify, useTranslate } from 'react-admin'
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import FavoriteIcon from '@material-ui/icons/Favorite'
import FavoriteBorderIcon from '@material-ui/icons/FavoriteBorder'
import AlbumIcon from '@material-ui/icons/Album'
import CloudDownloadOutlinedIcon from '@material-ui/icons/CloudDownloadOutlined'
import DeleteSweepIcon from '@material-ui/icons/DeleteSweep'
import { RiSaveLine } from 'react-icons/ri'
import { FaRadio } from 'react-icons/fa6'
import { useToggleLove } from '../../common/useToggleLove'
import { IpodIcon } from '../../ipods/IpodIcon'
import { useBrowseIpod } from '../../ipods/useBrowseIpod'
import { playIpodRadio } from '../../ipods/radio'
import {
  DOWNLOAD_MENU_SONG,
  clearQueue,
  openDownloadMenu,
  openSaveQueueDialog,
} from '../../actions'

const useStyles = makeStyles(
  (theme) => ({
    paper: {
      paddingBottom: 'env(safe-area-inset-bottom)',
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    header: {
      lineHeight: '20px',
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(1),
      background: theme.palette.background.paper,
    },
    title: {
      display: 'block',
      fontSize: '1rem',
      color: theme.palette.text.primary,
    },
    item: { minHeight: 52 },
    icon: { minWidth: 44, fontSize: 20 },
  }),
  { name: 'NDPlayerActions' },
)

// What can be done with a song of the phone player, from a long press on its cover, the screen
// strip or a song of Up Next: love it, open its album or its iPod, start an iPod Radio from it,
// download it, and save or clear the queue. "onLeave" closes the player before opening a page
export const PlayerActions = ({ item, onClose, onLeave }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const notify = useNotify()
  const history = useHistory()
  const t = (key, opts) => translate(`player.mobile.${key}`, opts)

  const song = item?.song || {}
  const isRadio = !!item?.isRadio
  const id = song.mediaFileId || song.id || item?.trackId
  // The song as it is now, for whether it is loved
  const { data } = useGetOne('song', id, { enabled: !!id && !isRadio })
  const [toggleLove, toggling] = useToggleLove('song', data || {})
  const browseIpod = useBrowseIpod(() => {
    onClose()
    onLeave()
  })

  // The menu opens under the finger of the long press that opened it: lifting that finger must
  // not pick what is now under it. Only a touch (or a key) that starts in the menu picks
  const armed = useRef(false)
  useEffect(() => {
    armed.current = false
  }, [item])
  const arm = () => {
    armed.current = true
  }

  const run = (action) => () => {
    onClose()
    action()
  }
  const goTo = (path) =>
    run(() => {
      onLeave()
      history.push(path)
    })

  const actions = isRadio
    ? []
    : [
        {
          key: 'love',
          label: t(data?.starred ? 'unlove' : 'love'),
          icon: data?.starred ? <FavoriteIcon /> : <FavoriteBorderIcon />,
          disabled: !data || toggling,
          onClick: run(() => toggleLove()),
        },
        song.albumId && {
          key: 'album',
          label: t('goToAlbum'),
          icon: <AlbumIcon />,
          onClick: goTo(`/album/${song.albumId}/show`),
        },
        song.libraryId && {
          key: 'ipod',
          label: t('goToIpod', { name: song.libraryName || '' }),
          icon: <IpodIcon size={20} />,
          onClick: () => browseIpod(song.libraryId),
        },
        {
          key: 'radio',
          label: t('startRadio'),
          icon: <FaRadio />,
          onClick: run(() =>
            playIpodRadio(dispatch, notify, { songId: id }).catch(() =>
              notify('ra.page.error', 'warning'),
            ),
          ),
        },
        {
          key: 'download',
          label: translate('ra.action.download'),
          icon: <CloudDownloadOutlinedIcon />,
          onClick: run(() =>
            dispatch(openDownloadMenu({ ...song, id }, DOWNLOAD_MENU_SONG)),
          ),
        },
      ]
  actions.push(
    {
      key: 'saveQueue',
      label: t('saveQueue'),
      icon: <RiSaveLine />,
      onClick: run(() => dispatch(openSaveQueueDialog())),
    },
    {
      key: 'clearQueue',
      label: t('clearQueue'),
      icon: <DeleteSweepIcon />,
      onClick: run(() => {
        onLeave()
        dispatch(clearQueue())
      }),
    },
  )

  return (
    <Drawer
      anchor="bottom"
      open={!!item}
      // Lifting the finger of the long press over the backdrop would close it at once, too
      onClose={(e, reason) =>
        (reason !== 'backdropClick' || armed.current) && onClose()
      }
      BackdropProps={{ onPointerDown: arm }}
      classes={{ paper: classes.paper }}
    >
      <List
        aria-label={t('actions')}
        subheader={
          <ListSubheader className={classes.header}>
            <span className={`${classes.title} songTitle`}>
              {song.title || item?.name}
            </span>
            {song.artist || item?.singer}
          </ListSubheader>
        }
      >
        {actions.filter(Boolean).map((a) => (
          <ListItem
            key={a.key}
            button
            className={classes.item}
            disabled={a.disabled}
            onPointerDown={arm}
            onKeyDown={arm}
            onClick={(e) => armed.current && a.onClick(e)}
          >
            <ListItemIcon className={classes.icon}>{a.icon}</ListItemIcon>
            <ListItemText primary={a.label} />
          </ListItem>
        ))}
      </List>
    </Drawer>
  )
}
