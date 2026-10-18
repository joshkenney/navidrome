import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useRedirect } from 'react-admin'
import { setSelectedLibraries } from '../actions'

// Returns a function that shows the albums of one iPod, closing the current dialog
export const useBrowseIpod = (onClose) => {
  const dispatch = useDispatch()
  const redirect = useRedirect()
  return useCallback(
    (id) => {
      dispatch(setSelectedLibraries([id]))
      onClose()
      redirect('/album')
    },
    [dispatch, onClose, redirect],
  )
}
