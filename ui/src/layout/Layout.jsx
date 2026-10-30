import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Layout as RALayout, toggleSidebar } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { useMediaQuery } from '@material-ui/core'
import { HotKeys } from 'react-hotkeys'
import Menu from './Menu'
import AppBar from './AppBar'
import Notification from './Notification'
import useCurrentTheme from '../themes/useCurrentTheme'
import { useSearchRefocus } from '../common'
import { useUiFont } from '../fonts'
import { playerPadding } from './playerPadding'

const useStyles = makeStyles({
  root: {
    paddingBottom: (props) => playerPadding(props.addPadding, props.isMobile),
  },
})

const Layout = (props) => {
  const theme = useCurrentTheme()
  const queue = useSelector((state) => state.player?.queue)
  // The same breakpoint as the player's (Player.jsx)
  const isMobile = !useMediaQuery('(min-width:810px)')
  const classes = useStyles({ addPadding: queue.length > 0, isMobile })
  const dispatch = useDispatch()
  useSearchRefocus()
  useUiFont()

  const keyHandlers = {
    TOGGLE_MENU: useCallback(() => dispatch(toggleSidebar()), [dispatch]),
  }

  return (
    <HotKeys handlers={keyHandlers}>
      <RALayout
        {...props}
        className={classes.root}
        menu={Menu}
        appBar={AppBar}
        theme={theme}
        notification={Notification}
      />
    </HotKeys>
  )
}

export default Layout
