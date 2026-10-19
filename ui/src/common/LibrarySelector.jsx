import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useDataProvider, useTranslate, useRefresh } from 'react-admin'
import {
  Box,
  Chip,
  ClickAwayListener,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Popper,
  TextField,
  makeStyles,
} from '@material-ui/core'
import { ExpandMore, ExpandLess, LibraryMusic } from '@material-ui/icons'
import { setSelectedLibraries, setUserLibraries } from '../actions'
import { withoutCombinedLibraries } from './combinedLibraries'
import { useRefreshOnEvents } from './useRefreshOnEvents'

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    display: 'flex',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: theme.spacing(1),
    height: theme.spacing(4.8),
    fontSize: '1rem',
    fontWeight: 'normal',
    minWidth: '210px',
    justifyContent: 'flex-start',
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    marginTop: theme.spacing(0.1),
    '& .MuiChip-label': {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(1),
    },
    '& .MuiChip-icon': {
      fontSize: '1.2rem',
      marginLeft: theme.spacing(0.5),
    },
  },
  popper: {
    zIndex: 1300,
  },
  paper: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    minWidth: 300,
    maxWidth: 400,
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 0,
  },
  masterCheckbox: {
    padding: '7px',
    marginLeft: '-9px',
    marginRight: 0,
  },
  search: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  list: {
    maxHeight: '50vh',
    overflowY: 'auto',
    flexWrap: 'nowrap',
  },
}))

// Lowercase, without accents, so "Beyonce" finds "Beyoncé's iPod"
const searchable = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const LibrarySelector = () => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const translate = useTranslate()
  const refresh = useRefresh()
  const [anchorEl, setAnchorEl] = useState(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { userLibraries, selectedLibraries } = useSelector(
    (state) => state.library,
  )

  // Load user's libraries when component mounts
  const loadUserLibraries = useCallback(async () => {
    const userId = localStorage.getItem('userId')
    if (userId) {
      try {
        const { data } = await dataProvider.getOne('user', { id: userId })
        const libraries = withoutCombinedLibraries(data.libraries || [])
        dispatch(setUserLibraries(libraries))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          'Could not load user libraries (this may be expected for non-admin users):',
          error,
        )
      }
    }
  }, [dataProvider, dispatch])

  // Initial load
  useEffect(() => {
    loadUserLibraries()
  }, [loadUserLibraries])

  // Reload user libraries when library changes occur
  useRefreshOnEvents({
    events: ['library', 'user'],
    onRefresh: loadUserLibraries,
  })

  const sortedLibraries = useMemo(
    () => [...userLibraries].sort((a, b) => a.name.localeCompare(b.name)),
    [userLibraries],
  )
  const visibleLibraries = useMemo(() => {
    const q = searchable(query.trim())
    return q
      ? sortedLibraries.filter((lib) => searchable(lib.name).includes(q))
      : sortedLibraries
  }, [sortedLibraries, query])

  // Don't render if user has no libraries or only has one library
  if (!userLibraries.length || userLibraries.length === 1) {
    return null
  }

  const handleToggle = (event) => {
    setAnchorEl(event.currentTarget)
    const wasOpen = open
    setOpen(!open)
    setQuery('')
    // Refresh data when closing the dropdown
    if (wasOpen) {
      refresh()
    }
  }

  const handleClose = () => {
    setOpen(false)
    setQuery('')
    refresh()
  }

  const handleLibraryToggle = (libraryId) => {
    const newSelection = selectedLibraries.includes(libraryId)
      ? selectedLibraries.filter((id) => id !== libraryId)
      : [...selectedLibraries, libraryId]

    dispatch(setSelectedLibraries(newSelection))
  }

  const handleMasterCheckboxChange = () => {
    // While searching, the checkbox only applies to the matching iPods
    if (isSearching) {
      const visibleIds = visibleLibraries.map((lib) => lib.id)
      dispatch(
        setSelectedLibraries(
          allVisibleSelected
            ? selectedLibraries.filter((id) => !visibleIds.includes(id))
            : [...new Set([...selectedLibraries, ...visibleIds])],
        ),
      )
      return
    }
    if (isAllSelected) {
      dispatch(setSelectedLibraries([]))
    } else {
      const allIds = userLibraries.map((lib) => lib.id)
      dispatch(setSelectedLibraries(allIds))
    }
  }

  const selectedCount = selectedLibraries.length
  const totalCount = userLibraries.length
  const isAllSelected = selectedCount === totalCount
  const isNoneSelected = selectedCount === 0
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount
  const isSearching = query.trim() !== ''
  const visibleSelectedCount = visibleLibraries.filter((lib) =>
    selectedLibraries.includes(lib.id),
  ).length
  const allVisibleSelected =
    visibleLibraries.length > 0 &&
    visibleSelectedCount === visibleLibraries.length

  const displayText = isNoneSelected
    ? translate('menu.librarySelector.none') + ` (0 of ${totalCount})`
    : isAllSelected
      ? translate('menu.librarySelector.allLibraries', { count: totalCount })
      : translate('menu.librarySelector.multipleLibraries', {
          selected: selectedCount,
          total: totalCount,
        })

  return (
    <Box className={classes.root}>
      <Chip
        icon={<LibraryMusic />}
        label={displayText}
        onClick={handleToggle}
        onDelete={open ? handleToggle : undefined}
        deleteIcon={open ? <ExpandLess /> : <ExpandMore />}
        variant="outlined"
        className={classes.chip}
      />

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        className={classes.popper}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Paper className={classes.paper}>
            <Box className={classes.headerContainer}>
              <Checkbox
                checked={isSearching ? allVisibleSelected : isAllSelected}
                indeterminate={
                  isSearching
                    ? visibleSelectedCount > 0 && !allVisibleSelected
                    : isIndeterminate
                }
                onChange={handleMasterCheckboxChange}
                size="small"
                className={classes.masterCheckbox}
              />
              <Typography>
                {translate('menu.librarySelector.selectLibraries')}:
              </Typography>
            </Box>

            <TextField
              className={classes.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={translate('menu.librarySelector.search')}
              inputProps={{
                'aria-label': translate('menu.librarySelector.search'),
              }}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
            />

            <FormControl component="fieldset" variant="standard" fullWidth>
              {visibleLibraries.length === 0 && (
                <Typography variant="body2" color="textSecondary">
                  {translate('menu.librarySelector.noMatches')}
                </Typography>
              )}
              <FormGroup className={classes.list}>
                {visibleLibraries.map((library) => (
                  <FormControlLabel
                    key={library.id}
                    control={
                      <Checkbox
                        checked={selectedLibraries.includes(library.id)}
                        onChange={() => handleLibraryToggle(library.id)}
                        size="small"
                      />
                    }
                    label={library.name}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  )
}

export default LibrarySelector
