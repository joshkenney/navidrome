import React, {
  createElement,
  forwardRef,
  Fragment,
  useEffect,
  useState,
} from 'react'
import {
  AppBar as RAAppBar,
  MenuItemLink,
  useTranslate,
  usePermissions,
  getResources,
} from 'react-admin'
import {
  MdHelpOutline,
  MdInfo,
  MdPerson,
  MdSupervisorAccount,
} from 'react-icons/md'
import { useSelector } from 'react-redux'
import { makeStyles, MenuItem, ListItemIcon, Divider } from '@material-ui/core'
import ViewListIcon from '@material-ui/icons/ViewList'
import { Dialogs } from '../dialogs/Dialogs'
import { AboutDialog } from '../dialogs'
import PersonalMenu from './PersonalMenu'
import ActivityPanel from './ActivityPanel'
import NowPlayingPanel from './NowPlayingPanel'
import {
  IpodFactsButton,
  IpodNetworkButton,
  IpodRadioButton,
  IpodShuffleButton,
} from '../ipods'
import { Tour, startTour } from '../tour'
import { schedulePrefetch } from '../ipods/ipodDataCache'
import { GlobalSearch } from '../search/GlobalSearch'
import UserMenu from './UserMenu'
import config from '../config'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      color: theme.palette.text.secondary,
    },
    active: {
      color: theme.palette.text.primary,
    },
    icon: { minWidth: theme.spacing(5) },
  }),
  {
    name: 'NDAppBar',
  },
)

const AboutMenuItem = forwardRef(({ onClick, ...rest }, ref) => {
  const classes = useStyles(rest)
  const translate = useTranslate()
  const [open, setOpen] = React.useState(false)

  const handleOpen = () => {
    setOpen(true)
  }
  const handleClose = () => {
    onClick && onClick()
    setOpen(false)
  }
  const label = translate('menu.about')
  return (
    <>
      <MenuItem ref={ref} onClick={handleOpen} className={classes.root}>
        <ListItemIcon className={classes.icon}>
          <MdInfo title={label} size={24} />
        </ListItemIcon>
        {label}
      </MenuItem>
      <AboutDialog onClose={handleClose} open={open} />
    </>
  )
})

AboutMenuItem.displayName = 'AboutMenuItem'

// Replays the UI tour
const TourMenuItem = forwardRef(({ onClick, ...rest }, ref) => {
  const classes = useStyles(rest)
  const translate = useTranslate()
  const label = translate('tour.menu')
  const handleClick = () => {
    onClick && onClick()
    // Once the menu has closed, so the tour can light up its button
    setTimeout(startTour, 300)
  }
  return (
    <MenuItem
      ref={ref}
      onClick={handleClick}
      className={classes.root}
      data-tour="takeTour"
    >
      <ListItemIcon className={classes.icon}>
        <MdHelpOutline size={24} />
      </ListItemIcon>
      {label}
    </MenuItem>
  )
})

TourMenuItem.displayName = 'TourMenuItem'

// Marks a header element for the tour (see tour/steps.js)
const TourTarget = ({ name, children }) => (
  <span data-tour={name} style={{ display: 'inline-flex' }}>
    {children}
  </span>
)

const settingsResources = (resource) =>
  resource.name !== 'user' &&
  resource.hasList &&
  resource.options &&
  resource.options.subMenu === 'settings'

const CustomUserMenu = ({ onClick, ...rest }) => {
  const translate = useTranslate()
  const resources = useSelector(getResources)
  const classes = useStyles(rest)
  const { permissions } = usePermissions()

  // Fetch the iPod Facts and Network in the background, so they open at once
  useEffect(() => schedulePrefetch(), [])

  const resourceDefinition = (resourceName) =>
    resources.find((r) => r?.name === resourceName)

  const renderUserMenuItemLink = () => {
    const userResource = resourceDefinition('user')
    if (!userResource) {
      return null
    }
    if (permissions !== 'admin') {
      if (!config.enableUserEditing) {
        return null
      }
      userResource.icon = MdPerson
    } else {
      userResource.icon = MdSupervisorAccount
    }
    return renderSettingsMenuItemLink(
      userResource,
      permissions !== 'admin' ? localStorage.getItem('userId') : null,
    )
  }

  const renderSettingsMenuItemLink = (resource, id) => {
    const label = translate(`resources.${resource.name}.name`, {
      smart_count: id ? 1 : 2,
    })
    const link = id ? `/${resource.name}/${id}` : `/${resource.name}`
    return (
      <MenuItemLink
        className={classes.root}
        activeClassName={classes.active}
        key={resource.name}
        to={link}
        primaryText={label}
        leftIcon={
          (resource.icon && createElement(resource.icon, { size: 24 })) || (
            <ViewListIcon />
          )
        }
        onClick={onClick}
        sidebarIsOpen={true}
      />
    )
  }

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <TourTarget name="search">
          <GlobalSearch />
        </TourTarget>
        <TourTarget name="facts">
          <IpodFactsButton />
        </TourTarget>
        <TourTarget name="network">
          <IpodNetworkButton />
        </TourTarget>
        <TourTarget name="shuffle">
          <IpodShuffleButton />
        </TourTarget>
        <TourTarget name="radio">
          <IpodRadioButton />
        </TourTarget>
        {config.enableNowPlaying && (
          <TourTarget name="nowPlaying">
            <NowPlayingPanel />
          </TourTarget>
        )}
      </span>
      <Tour />
      {config.devActivityPanel && permissions === 'admin' && <ActivityPanel />}
      <TourTarget name="userMenu">
        <UserMenu {...rest}>
          <PersonalMenu sidebarIsOpen={true} onClick={onClick} />
          <Divider />
          {renderUserMenuItemLink()}
          {resources
            .filter(settingsResources)
            .map((r) => renderSettingsMenuItemLink(r))}
          <Divider />
          <TourMenuItem />
          <AboutMenuItem />
        </UserMenu>
      </TourTarget>
      <Dialogs />
    </>
  )
}

const AppBar = (props) => (
  <RAAppBar {...props} container={Fragment} userMenu={<CustomUserMenu />} />
)

export default AppBar
