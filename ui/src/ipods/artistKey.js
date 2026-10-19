// Same rules as songkey.ArtistKey on the server: "The Spill Canvas" and "Spill Canvas",
// or "Simon & Garfunkel" and "Simon and Garfunkel", are the same artist
export const artistKey = (name) => {
  const key = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
  return key || name.trim().toLowerCase()
}

// Keeps one artist per spelling, the first one found
export const uniqueArtists = (artists) => {
  const seen = new Set()
  return artists.filter((a) => {
    const key = artistKey(a.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
