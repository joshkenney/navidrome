import React from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IpodLabel } from '../../ipods/IpodLabel'
import { LCD, formatTime, row } from './ipodLook'
import { UpNext } from './UpNext'
import { IpodMenu } from './IpodMenu'
import { usePress } from './usePress'
import { Marquee } from './Marquee'
import { useBattery } from './useBattery'

// Film grain, for the iPod Photo's covers
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

// How big (pixels) the iPod Photo's covers are fetched, then blown up blocky: its screen was small
const LOW_RES = 72

// The cover's address, asking the server for a small one
export const lowResCover = (src) => {
  if (!src) return src
  if (/[?&]size=\d+/.test(src)) {
    return src.replace(/([?&]size=)\d+/, (_, key) => `${key}${LOW_RES}`)
  }
  return `${src}${src.includes('?') ? '&' : '?'}size=${LOW_RES}`
}

const useStyles = makeStyles(
  {
    root: {
      height: '100%',
      background: LCD.background,
      color: LCD.text,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      // The 1st and 2nd generation's text smears a little
      textShadow: 'var(--lcd-ghost, none)',
    },
    header: {
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: row(0.82),
      padding: `0 ${row(0.3)}`,
      fontSize: row(0.46),
      borderBottom: `1px solid ${LCD.track}`,
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))',
    },
    headerSide: { width: row(1.1), display: 'flex', alignItems: 'center' },
    headerTitle: {
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    battery: {
      marginLeft: 'auto',
      width: row(0.78),
      height: row(0.36),
      border: `1px solid ${LCD.text}`,
      borderRadius: 2,
      position: 'relative',
      '&::after': {
        content: '""',
        position: 'absolute',
        right: -3,
        top: '25%',
        width: 2,
        height: '50%',
        background: LCD.text,
      },
    },
    // The charge left: the phone's (see useBattery)
    batteryFill: {
      position: 'absolute',
      left: 1,
      top: 1,
      bottom: 1,
      background: LCD.text,
      transition: 'width 600ms ease-out',
    },
    bolt: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      overflow: 'visible',
    },
    // What is under the header, filling the screen
    content: { flex: '1 1 auto', minHeight: 0, position: 'relative' },
    nowPlaying: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    body: {
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      gap: row(0.4),
      padding: row(0.35),
      alignItems: 'center',
    },
    // The black and white iPods' Now Playing: no cover, the song in lines of centred text
    textOnly: {
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: row(0.08),
      padding: `0 ${row(0.4)}`,
      textAlign: 'center',
      overflow: 'hidden',
    },
    textTitle: {
      fontSize: row(0.62),
      lineHeight: row(0.78),
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    textLine: {
      fontSize: row(0.52),
      lineHeight: row(0.7),
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    // A still, square cover: never the spinning record
    cover: {
      height: '100%',
      maxWidth: '48%',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      flex: '0 0 auto',
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
      background: LCD.track,
      touchAction: 'none',
      filter: LCD.coverFilter,
    },
    // The iPod Photo's cover: small and blown up, its pixels showing, and grainy
    lowRes: {
      position: 'relative',
      height: '100%',
      maxWidth: '48%',
      aspectRatio: '1 / 1',
      flex: '0 0 auto',
      borderRadius: 2,
      overflow: 'hidden',
      '& > img': {
        width: '100%',
        maxWidth: 'none',
        imageRendering: 'pixelated',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: GRAIN,
        backgroundSize: '48px 48px',
        mixBlendMode: 'overlay',
        opacity: 0.6,
      },
    },
    info: {
      flex: 1,
      minWidth: 0,
      maxHeight: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: row(0.12),
    },
    title: {
      fontSize: row(0.6),
      lineHeight: row(0.74),
    },
    line: {
      fontSize: row(0.46),
      lineHeight: row(0.6),
      color: LCD.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    ipod: { fontSize: row(0.42), color: LCD.muted },
    footer: {
      flex: '0 0 auto',
      padding: `0 ${row(0.35)} ${row(0.3)}`,
    },
    position: {
      fontSize: row(0.42),
      color: LCD.muted,
      marginBottom: row(0.12),
    },
    bar: {
      position: 'relative',
      height: row(0.36),
      borderRadius: 2,
      background: LCD.track,
      boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.25)',
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 2,
      background: LCD.bar,
    },
    // Where the wheel is scrubbing to
    diamond: {
      position: 'absolute',
      top: '50%',
      width: row(0.46),
      height: row(0.46),
      transform: 'translate(-50%, -50%) rotate(45deg)',
      background: LCD.background,
      border: `2px solid ${LCD.bar}`,
      boxSizing: 'border-box',
    },
    // The slider over the bar, for touch and screen readers
    range: {
      position: 'absolute',
      inset: '-8px 0',
      width: '100%',
      margin: 0,
      opacity: 0,
      cursor: 'pointer',
    },
    times: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: row(0.42),
      marginTop: row(0.1),
    },
  },
  { name: 'NDIpodScreen' },
)

// The iPod's screen, showing the song playing ("Now Playing") or the queue ("Up Next", see UpNext).
// While the wheel scrubs, it shows where to ("scrubTime"), with a diamond on the bar, like the iPod
export const IpodScreen = ({
  audio,
  controls,
  scrubTime = null,
  view = 'nowPlaying',
  upNext = {},
  menu,
  onActions,
  // Whether the screen shows covers: the black and white ones didn't
  art = true,
  // The iPod Photo's coarse screen: small, grainy covers
  lowRes = false,
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const t = (key, opts) => translate(`player.mobile.${key}`, opts)
  const { song, item, queue, index, playing, currentTime, duration, isRadio } =
    audio

  // The cover: swipe it to skip, hold it for more
  const cover = usePress({
    onSwipeLeft: controls.next,
    onSwipeRight: controls.prev,
    onLongPress: onActions && (() => onActions(item)),
  })

  // The phone's battery; full where the phone keeps it to itself (iPhones)
  const battery = useBattery()
  const batteryLevel = battery ? Math.max(0.04, battery.level) : 1
  const batteryLabel = battery
    ? t(battery.charging ? 'batteryCharging' : 'battery', {
        percent: Math.round(battery.level * 100),
      })
    : t('batteryUnknown')

  const scrubbing = scrubTime !== null
  const shown = scrubbing ? scrubTime : currentTime
  const progress = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0
  const title = song.title || item.name || ''
  const artist = song.artist || item.singer || ''

  const nowPlaying = (
    <div className={classes.nowPlaying}>
      {art ? (
        <div className={classes.body}>
          {item.cover &&
            (lowRes ? (
              <span className={classes.lowRes} data-testid="low-res-cover">
                <img
                  className={classes.cover}
                  src={lowResCover(item.cover)}
                  alt={song.album || title}
                  draggable={false}
                  {...cover.handlers}
                />
              </span>
            ) : (
              <img
                className={classes.cover}
                src={item.cover}
                alt={song.album || title}
                draggable={false}
                {...cover.handlers}
              />
            ))}
          <div className={`${classes.info} songTitle`}>
            <Marquee className={classes.title}>{title}</Marquee>
            {artist && <Marquee className={classes.line}>{artist}</Marquee>}
            {song.album && (
              <Marquee className={classes.line}>{song.album}</Marquee>
            )}
            {!isRadio && song.libraryId && (
              <IpodLabel
                className={classes.ipod}
                libraryId={song.libraryId}
                libraryName={song.libraryName}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          className={`${classes.textOnly} songTitle`}
          data-testid="now-playing-text"
          {...cover.handlers}
        >
          <Marquee className={classes.textTitle}>{title}</Marquee>
          {artist && <Marquee className={classes.textLine}>{artist}</Marquee>}
          {song.album && (
            <Marquee className={classes.textLine}>{song.album}</Marquee>
          )}
        </div>
      )}
      <div className={`${classes.footer} songTitle`}>
        {queue.length > 1 && (
          <div className={classes.position}>
            {t('position', { n: index + 1, total: queue.length })}
          </div>
        )}
        {!isRadio && (
          <>
            <div className={classes.bar}>
              <div className={classes.fill} style={{ width: `${progress}%` }} />
              {scrubbing && (
                <div
                  className={classes.diamond}
                  style={{ left: `${progress}%` }}
                  data-testid="scrub-diamond"
                />
              )}
              <input
                className={classes.range}
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.floor(shown)}
                aria-label={t('seek')}
                data-no-swipe
                onChange={(e) => controls.seek(Number(e.target.value))}
              />
            </div>
            <div className={classes.times}>
              <span>{formatTime(shown)}</span>
              <span>{formatTime(duration - shown, true)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className={classes.root}>
      <div className={`${classes.header} songTitle`}>
        <span className={classes.headerSide} aria-hidden>
          {playing ? '▶' : '❚❚'}
        </span>
        <Marquee className={classes.headerTitle}>
          {menu?.isMenu
            ? menu.title
            : t(view === 'upNext' ? 'upNext' : 'nowPlaying')}
        </Marquee>
        <span className={classes.headerSide}>
          <span
            className={classes.battery}
            role="img"
            aria-label={batteryLabel}
            title={batteryLabel}
            data-testid="battery"
          >
            <span
              className={classes.batteryFill}
              style={{ width: `calc((100% - 2px) * ${batteryLevel})` }}
            />
            {battery?.charging && (
              // A lightning bolt, in the screen's background colour over the charge
              <svg
                className={classes.bolt}
                viewBox="0 0 20 10"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M11 0.5 L6 5.6 H9.4 L8 9.5 L13.6 4.2 H10 Z"
                  fill={battery.level > 0.45 ? LCD.background : LCD.text}
                  stroke={LCD.text}
                  strokeWidth="0.4"
                />
              </svg>
            )}
          </span>
        </span>
      </div>
      <div className={classes.content}>
        {menu?.isMenu ? (
          <IpodMenu
            lcd={LCD}
            label={menu.title}
            items={menu.items}
            highlight={menu.highlight}
            loaded={menu.loaded}
            onSelect={menu.select}
            onLoadMore={menu.loadMore}
          />
        ) : view === 'upNext' ? (
          <UpNext queue={queue} current={index} {...upNext} />
        ) : (
          nowPlaying
        )}
      </div>
    </div>
  )
}
