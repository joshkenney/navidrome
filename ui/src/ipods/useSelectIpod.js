import { useCallback, useContext } from 'react'
import { ReactReduxContext } from 'react-redux'
import { setSelectedLibraries } from '../actions'

// The dataProvider reads the iPod selection from the saved state, which the store saves with a
// throttle. Update the saved copy right away, so the next page shows the newly selected iPod
const saveSelection = (ids) => {
  try {
    const state = JSON.parse(localStorage.getItem('state')) || {}
    state.library = { ...state.library, selectedLibraries: ids }
    localStorage.setItem('state', JSON.stringify(state))
  } catch (e) {
    // Storage unavailable: the store's own save will follow
  }
}

// Returns a function that adds an iPod to the iPod selector's selection, so pages opened for one
// of its songs (say, from the player) show it. "All iPods" (an empty selection) is left as is
export const useSelectIpod = () => {
  const context = useContext(ReactReduxContext)
  const store = context?.store
  return useCallback(
    (libraryId, libraryName) => {
      if (!store) return
      const { userLibraries = [], selectedLibraries = [] } =
        store.getState().library || {}
      const id =
        libraryId ?? userLibraries.find((lib) => lib.name === libraryName)?.id
      if (
        id == null ||
        selectedLibraries.length === 0 ||
        selectedLibraries.includes(id) ||
        userLibraries.length <= 1
      ) {
        return
      }
      const selection = [...selectedLibraries, id]
      store.dispatch(setSelectedLibraries(selection))
      saveSelection(selection)
    },
    [store],
  )
}
