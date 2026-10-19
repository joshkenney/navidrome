// Tribe colours: a categorical palette readable on both the light and dark themes
const TRIBE_COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#17becf',
  '#bcbd22',
  '#8c6bb1',
]
const FREE_SPIRIT_COLOR = '#9e9e9e'

export const FREE_SPIRITS = -1

export const tribeColor = (tribeId) =>
  tribeId == null || tribeId < 0
    ? FREE_SPIRIT_COLOR
    : TRIBE_COLORS[tribeId % TRIBE_COLORS.length]
