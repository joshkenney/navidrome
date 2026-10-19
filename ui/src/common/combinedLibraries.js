const folderPrefix = (path) => path.replace(/\/+$/, '') + '/'

// Leaves out libraries whose folder contains another library's folder (like a "Music Library"
// holding every iPod's folder). The server stores their tracks only in the libraries inside them,
// so they would be empty choices in the library selector
export const withoutCombinedLibraries = (libraries) =>
  libraries.filter(
    (lib) =>
      !libraries.some(
        (other) =>
          other.id !== lib.id &&
          lib.path &&
          other.path &&
          other.path.startsWith(folderPrefix(lib.path)),
      ),
  )
