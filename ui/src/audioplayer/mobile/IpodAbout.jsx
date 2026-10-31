import React, { useEffect, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { httpClient } from '../../dataProvider'
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

// The size on disk of the iPod's folder (its library's, every file in it), as the server measured
// it (see ipod_size.go): it measures it in the background, so it is asked again a few times
const SIZE_RETRY_MS = 2000
const SIZE_RETRIES = 15
const useFolderSize = (ipodId) => {
  const [size, setSize] = useState(null)
  useEffect(() => {
    if (ipodId == null) return undefined
    let live = true
    let timer = null
    const ask = (tries) =>
      httpClient(`/api/ipods/${ipodId}/size`)
        .then(({ json }) => {
          if (!live) return
          if (json.size != null) setSize(json.size)
          if (json.measuring && tries > 0)
            timer = setTimeout(() => ask(tries - 1), SIZE_RETRY_MS)
        })
        .catch(() => {})
    ask(SIZE_RETRIES)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [ipodId])
  return size
}

// "9.2 GB", or under a gigabyte "640 MB"
const gigabytes = (gb) =>
  gb < 1
    ? `${(gb * 1000).toLocaleString(undefined, { maximumFractionDigits: gb < 0.01 ? 1 : 0 })} MB`
    : `${gb.toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`

// Settings > About, as on the iPod: the iPod's name, its songs, how much its folder holds (every
// file in it), what that leaves of its model's biggest hard drive ("capacity", in GB), and the
// model's last firmware
export const IpodAbout = ({ ipodId, ipodName, capacity, firmware, labels }) => {
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

  // Until the folder is measured, the songs' own size
  const folder = useFolderSize(ipodId)
  const used =
    folder != null ? folder / 1e9 : stats ? stats.totalSize / 1e9 : null
  const lines = [
    [labels.songs, stats ? stats.songCount.toLocaleString() : '…'],
    [labels.capacity, used === null ? '…' : gigabytes(used)],
    [
      labels.available,
      used === null ? '…' : gigabytes(Math.max(0, capacity - used)),
    ],
    [labels.version, firmware],
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
