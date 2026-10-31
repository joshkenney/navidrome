import React, { useEffect, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import config from '../../config'
import { useIpodName } from '../../ipods/useIpodName'
import {
  FACTS_URL,
  fetchIpodData,
  getCachedIpodData,
} from '../../ipods/ipodDataCache'
import { row } from './ipodLook'

const useStyles = makeStyles(
  {
    about: {
      height: '100%',
      overflow: 'hidden',
      padding: `${row(0.15)} ${row(0.36)}`,
      boxSizing: 'border-box',
    },
    // The iPod's name, centred above
    name: {
      textAlign: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    line: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: row(0.4),
      whiteSpace: 'nowrap',
    },
    value: { fontVariantNumeric: 'tabular-nums' },
    // As big as the menus' items, on each screen
    text: {
      fontSize: row(0.55),
      lineHeight: row(0.9),
      '[data-mono] &': { fontSize: row(0.66), lineHeight: row(1) },
      '[data-software=fifth] &': { fontSize: row(0.68), lineHeight: row(1) },
    },
  },
  { name: 'NDIpodAbout' },
)

// The iPod's numbers in iPod Facts (see ipods): its songs, and how much room they take
const statsOf = (facts, ipodId) =>
  facts?.superlatives?.find((s) => s.id === ipodId) || null

// "9.2 GB"
const gigabytes = (gb) =>
  `${gb.toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`

// Settings > About, as on the iPod: the iPod's name, its songs, its hard drive ("capacity", in GB,
// the biggest of its model) and what its songs leave of it, and the software's version
export const IpodAbout = ({ ipodId, ipodName, capacity, labels }) => {
  const classes = useStyles()
  const name = useIpodName(ipodId, ipodName)
  const [stats, setStats] = useState(() =>
    statsOf(getCachedIpodData(FACTS_URL), ipodId),
  )
  useEffect(() => {
    let live = true
    fetchIpodData(FACTS_URL)
      .then((facts) => live && setStats(statsOf(facts, ipodId)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [ipodId])

  const used = stats ? stats.totalSize / 1e9 : null
  const lines = [
    [labels.songs, stats ? stats.songCount.toLocaleString() : '…'],
    [labels.capacity, gigabytes(capacity)],
    [
      labels.available,
      used === null ? '…' : gigabytes(Math.max(0, capacity - used)),
    ],
    [labels.version, config.version],
  ]
  return (
    <div className={`${classes.about} songTitle`} data-testid="about">
      <div className={`${classes.name} ${classes.text}`}>{name}</div>
      {lines.map(([label, value]) => (
        <div key={label} className={`${classes.line} ${classes.text}`}>
          <span>{label}</span>
          <span className={classes.value}>{value}</span>
        </div>
      ))}
    </div>
  )
}
