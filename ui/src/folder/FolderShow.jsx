import React from 'react'
import {
  BulkActionsToolbar,
  ReferenceManyField,
  ShowContextProvider,
  Title as RaTitle,
  useListContext,
  useRedirect,
  useShowContext,
  useShowController,
} from 'react-admin'
import { Card, Chip, Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import FolderIcon from '@material-ui/icons/Folder'
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore'
import { useDispatch } from 'react-redux'
import {
  ArtistLinkField,
  DurationField,
  SongBulkActions,
  SongContextMenu,
  SongDatagrid,
  SongInfo,
  SongTitleField,
  Title,
} from '../common'
import { playTracks } from '../actions'
import ExpandInfoDialog from '../dialogs/ExpandInfoDialog'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      paddingTop: theme.spacing(1),
    },
    breadcrumb: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 2),
    },
    breadcrumbSep: {
      color: theme.palette.text.disabled,
      margin: theme.spacing(0, 0.5),
    },
    subfolderSection: {
      padding: theme.spacing(1, 2, 1),
    },
    subfolderLabel: {
      marginBottom: theme.spacing(1),
    },
    subfolderChips: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.75),
    },
    songsCard: {
      marginTop: theme.spacing(1),
    },
  }),
  { name: 'NDFolderShow' },
)

const SubfolderGridLayout = ({ ids, data, onFolderClick }) => {
  const classes = useStyles()
  if (!ids || ids.length === 0) return null
  return (
    <div className={classes.subfolderSection}>
      <Typography variant="subtitle2" className={classes.subfolderLabel}>
        Folders ({ids.length})
      </Typography>
      <div className={classes.subfolderChips}>
        {ids.map((id) => {
          const folder = data[id]
          if (!folder) return null
          const label =
            folder.numAudioFiles > 0
              ? `${folder.name} (${folder.numAudioFiles})`
              : folder.name
          return (
            <Chip
              key={id}
              icon={<FolderIcon />}
              label={label}
              variant="outlined"
              onClick={() => onFolderClick(id)}
            />
          )
        })}
      </div>
    </div>
  )
}

const SubfolderList = ({ onFolderClick }) => {
  const { loaded, ...rest } = useListContext()
  return loaded ? (
    <SubfolderGridLayout {...rest} onFolderClick={onFolderClick} />
  ) : null
}

const FolderSongsLayout = (props) => {
  const dispatch = useDispatch()
  const { ids, data } = props
  if (!ids || ids.length === 0) return null
  return (
    <>
      <BulkActionsToolbar {...props}>
        <SongBulkActions />
      </BulkActionsToolbar>
      <SongDatagrid
        rowClick={(id) => dispatch(playTracks(data, ids, id))}
        hasBulkActions={true}
        {...props}
      >
        <SongTitleField source="title" showTrackNumbers={false} />
        <ArtistLinkField source="artistId" />
        <DurationField source="duration" />
        <SongContextMenu source="starred" sortable={false} />
      </SongDatagrid>
    </>
  )
}

const FolderSongs = (props) => {
  const { loaded, loading, total, ...rest } = useListContext(props)
  return <>{loaded && <FolderSongsLayout {...rest} />}</>
}

const FolderShowLayout = () => {
  const { loading, ...context } = useShowContext()
  const { record } = context
  const redirect = useRedirect()
  const classes = useStyles()

  if (!record) return null

  const pathSegments = record.path
    ? record.path.split('/').filter((s) => s && s !== '.')
    : []

  return (
    <div className={classes.root}>
      <RaTitle title={<Title subTitle={record.name} />} />

      {/* Breadcrumb */}
      <div className={classes.breadcrumb}>
        {record.parentId && (
          <Chip
            size="small"
            icon={<NavigateBeforeIcon />}
            label="Up"
            onClick={() => redirect('show', '/folder', record.parentId)}
          />
        )}
        {pathSegments.map((segment, i) => (
          <React.Fragment key={i}>
            <Typography variant="body2" color="textSecondary">
              {segment}
            </Typography>
            <Typography variant="body2" className={classes.breadcrumbSep}>
              /
            </Typography>
          </React.Fragment>
        ))}
        <Typography variant="body2">
          <strong>{record.name}</strong>
        </Typography>
      </div>

      {/* Subfolders */}
      <ReferenceManyField
        {...context}
        addLabel={false}
        reference="folder"
        target="parent_id"
        sort={{ field: 'name', order: 'ASC' }}
        perPage={0}
        pagination={null}
      >
        <SubfolderList onFolderClick={(id) => redirect('show', '/folder', id)} />
      </ReferenceManyField>

      {/* Songs in this folder */}
      <Card className={classes.songsCard}>
        <ReferenceManyField
          {...context}
          addLabel={false}
          reference="song"
          target="folder_id"
          sort={{ field: 'path', order: 'ASC' }}
          perPage={0}
          pagination={null}
        >
          <FolderSongs />
        </ReferenceManyField>
      </Card>

      <ExpandInfoDialog content={<SongInfo />} />
    </div>
  )
}

const FolderShow = (props) => {
  const controllerProps = useShowController(props)
  return (
    <ShowContextProvider value={controllerProps}>
      <FolderShowLayout />
    </ShowContextProvider>
  )
}

export default FolderShow
