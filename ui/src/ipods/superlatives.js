import { formatBytes } from '../utils'

const maxBy = (items, fn) =>
  items.reduce((best, i) => (best == null || fn(i) > fn(best) ? i : best), null)

// Picks the winner of each superlative from the per-iPod stats
export const pickSuperlatives = (stats) => {
  if (!stats?.length) return []
  const withYear = stats.filter((s) => s.avgYear > 0)
  const picks = [
    {
      key: 'biggest',
      ipod: maxBy(stats, (s) => s.songCount),
      value: (s) => `${s.songCount} songs`,
    },
    {
      key: 'longest',
      ipod: maxBy(stats, (s) => s.totalDuration),
      value: (s) =>
        `${Math.round(s.totalDuration / 3600)} hours · ${formatBytes(s.totalSize, 1)}`,
    },
    {
      key: 'oldest',
      ipod: maxBy(withYear, (s) => -s.avgYear),
      value: (s) => `average year ${Math.round(s.avgYear)}`,
    },
    {
      key: 'newest',
      ipod: maxBy(withYear, (s) => s.avgYear),
      value: (s) => `average year ${Math.round(s.avgYear)}`,
    },
    {
      key: 'genres',
      ipod: maxBy(stats, (s) => s.genreCount),
      value: (s) => `${s.genreCount} genres`,
    },
  ]
  if (stats.length > 1) {
    picks.push({
      key: 'unique',
      ipod: maxBy(stats, (s) => s.uniqueSongs / (s.distinctSongs || 1)),
      value: (s) =>
        `${Math.round((100 * s.uniqueSongs) / (s.distinctSongs || 1))}% found nowhere else`,
    })
  }
  return picks.filter((p) => p.ipod)
}
