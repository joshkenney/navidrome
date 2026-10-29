import React from 'react'
import { Tooltip, Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { formatDuration, formatRange } from './dates'

const HEIGHT = 96

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: HEIGHT,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  column: {
    flex: '1 1 0',
    minWidth: 2,
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    cursor: 'pointer',
    background: 'none',
    border: 0,
    padding: 0,
    '&:hover $bar, &:focus-visible $bar': { opacity: 0.7 },
  },
  bar: {
    width: '100%',
    borderRadius: '4px 4px 0 0',
    backgroundColor: theme.palette.primary.main,
  },
  silent: {
    width: '100%',
    height: 2,
    backgroundColor: theme.palette.action.disabledBackground,
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: theme.spacing(0.5),
  },
}))

// Plays per day (or week, or month) as bars. Choosing a bar zooms in on its days
export const ActivityChart = ({ bars, onSelect, playsLabel }) => {
  const classes = useStyles()
  const peak = Math.max(1, ...bars.map((b) => b.plays))
  if (!bars.length) return null
  return (
    <div>
      <div className={classes.root} role="list">
        {bars.map((bar) => {
          const label = `${formatRange(bar.from, bar.to)}: ${playsLabel(bar.plays)}${
            bar.plays ? ` · ${formatDuration(bar.seconds)}` : ''
          }`
          return (
            <Tooltip key={bar.key} title={label} placement="top">
              <button
                type="button"
                role="listitem"
                aria-label={label}
                className={classes.column}
                onClick={() => onSelect(bar)}
              >
                {bar.plays > 0 ? (
                  <div
                    className={classes.bar}
                    style={{
                      height: `${Math.max(4, (bar.plays / peak) * 100)}%`,
                    }}
                  />
                ) : (
                  <div className={classes.silent} />
                )}
              </button>
            </Tooltip>
          )
        })}
      </div>
      <div className={classes.axis}>
        <Typography variant="caption" color="textSecondary">
          {formatRange(bars[0].from, bars[0].from)}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {formatRange(bars[bars.length - 1].to, bars[bars.length - 1].to)}
        </Typography>
      </div>
    </div>
  )
}

export default ActivityChart
