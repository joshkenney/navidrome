// Same labels as the server's tasteLabel (server/nativeapi/ipod_taste.go)
export const tasteLabelOf = (score) => {
  if (score < 20) return 'crowdPleaser'
  if (score < 40) return 'mainstream'
  if (score < 60) return 'balanced'
  if (score < 80) return 'crateDigger'
  return 'deepCuts'
}
