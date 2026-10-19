import { useContext } from 'react'
import { ReactReduxContext } from 'react-redux'

// Returns the name of the iPod (library) a song comes from: the song's own libraryName, or the
// name of its libraryId among the user's libraries. Works without a Redux store too
export const useIpodName = (libraryId, libraryName) => {
  const context = useContext(ReactReduxContext)
  if (libraryName) return libraryName
  if (libraryId == null) return null
  const libraries = context?.store?.getState()?.library?.userLibraries || []
  return libraries.find((lib) => lib.id === libraryId)?.name || null
}
