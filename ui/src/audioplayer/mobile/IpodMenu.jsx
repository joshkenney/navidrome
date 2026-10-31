import React, { useEffect, useRef } from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { LCD, row } from './ipodLook'
import { Marquee } from './Marquee'

const useStyles = makeStyles(
  {
    list: {
      height: '100%',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      // The scroll bar in the screen's colour: aqua or blue on the colour screens
      scrollbarWidth: 'thin',
      scrollbarColor: `${LCD.accent} transparent`,
      // On the black and white screens: the iPod's own scroll bar, an ink outline and thumb
      '[data-mono] &': {
        scrollbarWidth: 'auto',
        scrollbarColor: 'auto',
        '&::-webkit-scrollbar': { width: row(0.4) },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(72, 70, 71, 0.1)',
          border: `1px solid ${LCD.text}`,
        },
        '&::-webkit-scrollbar-thumb': {
          background: LCD.text,
          backgroundClip: 'padding-box',
          border: '2px solid transparent',
        },
      },
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: row(0.3),
      minHeight: row(1),
      padding: `${row(0.12)} ${row(0.36)}`,
      boxSizing: 'border-box',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      borderBottom: (p) => `1px solid ${p.lcd.track}`,
      color: (p) => p.lcd.text,
      // The early iPods' menus: no lines between the items, bigger text
      '[data-mono] &': { borderBottom: 'none' },
      // The classic's: no lines either
      '[data-software=classic] &': {
        borderBottom: 'none',
        padding: `${row(0.06)} ${row(0.22)}`,
      },
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
      fontSize: row(0.55),
      lineHeight: row(0.72),
      '[data-mono] &': { fontSize: row(0.66), lineHeight: row(0.84) },
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    sub: {
      fontSize: row(0.42),
      lineHeight: row(0.55),
      color: (p) => p.lcd.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    side: { fontSize: row(0.42), color: (p) => p.lcd.muted },
    // The chevron on the items leading to another menu
    more: {
      display: 'block',
      flex: '0 0 auto',
      height: row(0.4),
      width: 'auto',
      color: (p) => p.lcd.muted,
      '[data-mono] &': { color: LCD.text },
    },
    note: {
      padding: row(0.4),
      fontSize: row(0.48),
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
      data-no-swipe
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
            <Marquee className={classes.label} active={i === highlight}>
              {item.label}
            </Marquee>
            {item.sub && (
              <Marquee className={classes.sub} active={i === highlight}>
                {item.sub}
              </Marquee>
            )}
          </div>
          {item.side && <span className={classes.side}>{item.side}</span>}
          {item.more && (
            <svg className={classes.more} viewBox="0 0 6 10" aria-hidden>
              <path
                d="M1.2 1 L5 5 L1.2 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="square"
              />
            </svg>
          )}
        </li>
      ))}
    </ul>
  )
}
