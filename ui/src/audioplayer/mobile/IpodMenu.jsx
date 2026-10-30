import React, { useEffect, useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles(
  {
    list: {
      height: 'min(46vh, 420px)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      padding: '6px 10px',
      boxSizing: 'border-box',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      borderBottom: (p) => `1px solid ${p.lcd.track}`,
      color: (p) => p.lcd.text,
    },
    highlighted: {
      background: (p) => p.lcd.highlight,
      color: (p) => `${p.lcd.highlightText} !important`,
      '& $sub, & $side, & $more': {
        color: (p) => `${p.lcd.highlightText} !important`,
      },
    },
    text: { flex: 1, minWidth: 0 },
    label: {
      fontSize: 15,
      lineHeight: '19px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    sub: {
      fontSize: 12,
      lineHeight: '16px',
      color: (p) => p.lcd.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    side: { fontSize: 12, color: (p) => p.lcd.muted },
    more: { fontSize: 18, lineHeight: 1, color: (p) => p.lcd.muted },
    note: {
      padding: 12,
      fontSize: 13,
      color: (p) => p.lcd.muted,
    },
  },
  { name: 'NDIpodMenu' },
)

// A menu of the iPod's screen: one row per item, the one the wheel is on highlighted, "›" on the
// items leading to another menu. A tap picks an item; scrolling near the end asks for more
export const IpodMenu = ({
  items,
  highlight,
  loaded,
  onSelect,
  onLoadMore,
  lcd,
  label,
}) => {
  const classes = useStyles({ lcd })
  const translate = useTranslate()
  const rows = useRef([])

  useEffect(() => {
    rows.current[highlight]?.scrollIntoView?.({ block: 'nearest' })
  }, [highlight, items.length])

  const onScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) onLoadMore?.()
  }

  return (
    <ul
      className={classes.list}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
    >
      {!loaded && (
        <li className={`${classes.note} songTitle`}>
          {translate('player.mobile.loading')}
        </li>
      )}
      {loaded && !items.length && (
        <li className={`${classes.note} songTitle`}>
          {translate('player.mobile.empty')}
        </li>
      )}
      {items.map((item, i) => (
        <li
          key={item.key}
          ref={(el) => (rows.current[i] = el)}
          role="option"
          aria-selected={i === highlight}
          tabIndex={i === highlight ? 0 : -1}
          data-testid={`menu-${item.key}`}
          className={[
            classes.row,
            'songTitle',
            i === highlight && classes.highlighted,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(i)}
        >
          <div className={classes.text}>
            <div className={classes.label}>{item.label}</div>
            {item.sub && <div className={classes.sub}>{item.sub}</div>}
          </div>
          {item.side && <span className={classes.side}>{item.side}</span>}
          {item.more && (
            <span className={classes.more} aria-hidden>
              ›
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
