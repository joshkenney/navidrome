import React from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IpodLabel } from '../../ipods/IpodLabel'
import { LCD, formatTime, row } from './ipodLook'
import { UpNext } from './UpNext'
import { IpodMenu } from './IpodMenu'
import { usePress } from './usePress'
import { Marquee } from './Marquee'
import { CoverShuffle } from './CoverShuffle'
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

// The black and white screens' battery: an outline and four bars of charge, a bolt while it charges
const SegmentedBattery = ({ level, charging, className }) => {
  const bars = Math.min(4, Math.max(0, Math.ceil(level * 4)))
  return (
    <svg className={className} viewBox="0 0 24 11" aria-hidden>
      <rect
        x="0.75"
        y="0.75"
        width="20.5"
        height="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="21.25" y="3" width="2" height="5" fill="currentColor" />
      {charging ? (
        <path
          d="M12.5 1.6 L7.8 6 H10.9 L9.4 9.4 L15 4.7 H11.9 Z"
          fill="currentColor"
        />
      ) : (
        [0, 1, 2, 3]
          .slice(0, bars)
          .map((i) => (
            <rect
              key={i}
              x={2.5 + i * 4.6}
              y="2.5"
              width="3.6"
              height="6"
              fill="currentColor"
              data-testid="battery-bar"
            />
          ))
      )}
    </svg>
  )
}

// A speaker, quiet (no sound waves) or loud, at the ends of the volume bar
const Speaker = ({ loud, className }) => (
  <svg className={className} viewBox="0 0 13 10" aria-hidden>
    <path d="M1 3.4 H3.6 L6.6 1 V9 L3.6 6.6 H1 Z" fill="currentColor" />
    {loud && (
      <path
        d="M8.3 3.2 Q9.4 5 8.3 6.8 M10 1.6 Q12.2 5 10 8.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    )}
  </svg>
)

// The 6th and 7th generation's software, in Apple's photos: bold Helvetica
const HELVETICA = '"Helvetica Neue", Helvetica, Arial, sans-serif'
// The 5th generation's: Apple's Myriad-based Podium Sans, for which Source Sans 3 stands in (also
// one of the UI fonts, see fonts/uiFonts)
const PODIUM = `"Source Sans 3", "Myriad Pro", ${HELVETICA}`

// The classic's ▶ or ❚❚ in the header: blue, shining at the top
const PlayState = ({ playing, className }) => (
  <svg className={className} viewBox="0 0 10 10" aria-hidden>
    <defs>
      <linearGradient id="ndIpodPlayState" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fd0ff" />
        <stop offset="0.5" stopColor="#3a9be8" />
        <stop offset="1" stopColor="#1f6fd0" />
      </linearGradient>
    </defs>
    <path
      d={
        playing
          ? 'M1 0.5 L9.5 5 L1 9.5 Z'
          : 'M1.5 1 H4 V9 H1.5 Z M6 1 H8.5 V9 H6 Z'
      }
      fill="url(#ndIpodPlayState)"
      stroke="#1a5fb4"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
  </svg>
)

const useStyles = makeStyles(
  {
    '@font-face': {
      fontFamily: 'Source Sans 3',
      fontStyle: 'normal',
      fontWeight: '200 900',
      fontDisplay: 'swap',
      src: "url('fonts/SourceSans3-Variable.woff2') format('woff2')",
    },
    // The 5th generation's software: the song beside a smaller cover, where it is in the queue
    // above them, a striped blue bar with the times below it
    fifth: {
      '&$fifth, &$fifth *': {
        fontFamily: `${PODIUM} !important`,
        letterSpacing: 'normal !important',
      },
      fontWeight: 600,
      '& $header': {
        background:
          'linear-gradient(180deg, #fbfcfd 0%, #e6ecf1 50%, #d3dde4 100%)',
        borderBottom: '1px solid #9eaab4',
        fontSize: row(0.5),
      },
      '& $cover': {
        height: 'auto',
        width: '35%',
        maxWidth: 'none',
        borderRadius: 0,
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25)',
      },
      '& $body': { gap: row(0.5), padding: `${row(0.1)} ${row(0.4)}` },
      '& $info': { justifyContent: 'center', gap: row(0.18) },
      '& $title, & $line': {
        fontSize: row(0.6),
        lineHeight: row(0.78),
        color: LCD.text,
      },
      '& $positionTop': {
        fontSize: row(0.5),
        padding: `${row(0.2)} ${row(0.4)} 0`,
      },
      '& $bar': {
        height: row(0.44),
        borderRadius: 0,
        border: '1px solid #aeb7be',
        background:
          'linear-gradient(180deg, #ffffff 0%, #f2f4f6 50%, #e1e5e9 51%, #f7f8f9 100%)',
        boxShadow: 'none',
      },
      // Its fill, striped
      '& $fill': {
        borderRadius: 0,
        background: `repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.16) 0 1px, transparent 1px 4px), ${LCD.bar}`,
      },
      '& $times': { fontSize: row(0.58), marginTop: row(0.16) },
      '& $footer': { padding: `0 ${row(0.4)} ${row(0.3)}` },
    },
    // The 6th and 7th generation classic's software (see the classic* styles). Its font outweighs
    // the UI font's (see fonts/uiFonts)
    classic: {
      '&$classic, &$classic *': {
        fontFamily: `${HELVETICA} !important`,
        letterSpacing: 'normal !important',
      },
      fontWeight: 700,
    },
    // The classic's main menu: the menu on the left half, the covers of the iPod's albums on the
    // right
    home: {},
    homeMenu: {
      flex: '0 0 50%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: LCD.background,
    },
    homeCovers: { flex: '0 0 50%' },
    // The black and white screens, drawn after Apple's 25th-anniversary iPod: bigger text, a thick
    // rule under the title, an outlined progress bar, all a little soft
    mono: {
      '& $header, & $content': { opacity: 0.85 },
    },
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
      '&$home': { flexDirection: 'row' },
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
      '$mono &': {
        height: row(1.05),
        margin: `0 ${row(0.15)}`,
        padding: `0 ${row(0.15)}`,
        fontSize: row(0.62),
        borderBottom: `${row(0.075)} solid ${LCD.text}`,
        background: 'none',
      },
    },
    headerSide: { width: row(1.1), display: 'flex', alignItems: 'center' },
    // The classic's header: light grey, its title on the left, a blue ▶ by the battery
    classicHeader: {
      height: row(0.8),
      padding: `0 ${row(0.22)}`,
      fontSize: row(0.48),
      color: '#000',
      background:
        'linear-gradient(180deg, #fdfdfd 0%, #e9eaec 50%, #d4d6d9 100%)',
      borderBottom: '1px solid #9aa0a6',
      '& $headerTitle': { textAlign: 'left' },
      '& $headerSide': { width: 'auto' },
    },
    classicGlyph: {
      flex: '0 0 auto',
      margin: `0 ${row(0.16)}`,
      height: row(0.36),
      width: 'auto',
    },
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
    batteryWrap: { marginLeft: 'auto', display: 'flex' },
    monoBattery: {
      display: 'block',
      height: row(0.44),
      width: 'auto',
      overflow: 'visible',
    },
    // The charge left: the phone's (see useBattery)
    batteryFill: {
      position: 'absolute',
      left: 1,
      top: 1,
      bottom: 1,
      background: LCD.battery,
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
      '$mono &': { fontSize: row(0.7), lineHeight: row(0.9) },
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    textLine: {
      fontSize: row(0.52),
      lineHeight: row(0.7),
      '$mono &': { fontSize: row(0.64), lineHeight: row(0.86) },
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
    // The 6th and 7th generation's cover: leaning back in perspective, a trapezoid, over its
    // reflection
    tilt: {
      height: '100%',
      maxWidth: '48%',
      aspectRatio: '1 / 1',
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      '& > img': {
        height: '80%',
        maxWidth: 'none',
        borderRadius: 0,
        transform: `perspective(${row(7)}) rotateY(24deg)`,
        transformOrigin: 'left center',
        WebkitBoxReflect:
          'below 1px linear-gradient(transparent 62%, rgba(255, 255, 255, 0.32))',
      },
    },
    // The classic's Now Playing: a big cover leaning back over its reflection on the left, the
    // song beside it, black and grey, then its rating and where it is in the queue
    classicBody: {
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      alignItems: 'flex-start',
      gap: row(0.36),
      padding: `${row(0.4)} ${row(0.3)} 0`,
    },
    classicCover: {
      flex: '0 0 auto',
      width: '44%',
      aspectRatio: '1 / 1',
      '& > img': {
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        // Turned from its top: the top edge level, the bottom rising to the right
        transform: `perspective(${row(9)}) rotateY(18deg)`,
        transformOrigin: 'left top',
        WebkitBoxReflect:
          'below 0 linear-gradient(transparent 70%, rgba(255, 255, 255, 0.35))',
      },
    },
    classicInfo: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: row(0.1),
      paddingTop: row(0.3),
    },
    classicTitle: {
      fontSize: row(0.58),
      lineHeight: row(0.74),
      color: '#000',
    },
    classicLine: {
      fontSize: row(0.46),
      lineHeight: row(0.62),
      color: LCD.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    stars: {
      fontSize: row(0.5),
      lineHeight: row(0.66),
      letterSpacing: row(0.02),
      color: '#000',
    },
    classicPosition: {
      fontSize: row(0.5),
      lineHeight: row(0.66),
      color: '#000',
    },
    // The time played and left on either side of the bar, white and glossy round its blue
    classicProgress: {
      display: 'flex',
      alignItems: 'center',
      gap: row(0.3),
      fontSize: row(0.48),
      color: '#000',
      fontVariantNumeric: 'tabular-nums',
      '& $bar': {
        flex: 1,
        height: row(0.42),
        borderRadius: 0,
        border: '1px solid #b7bcc3',
        background:
          'linear-gradient(180deg, #ffffff 0%, #f1f2f4 50%, #e2e4e8 51%, #f6f7f8 100%)',
        boxShadow: 'none',
      },
      '& $fill': { borderRadius: 0 },
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
    // Where the song is in the queue, at the top: "12 of 1,029"
    positionTop: {
      flex: '0 0 auto',
      padding: `${row(0.18)} ${row(0.4)} 0`,
      fontSize: row(0.5),
      lineHeight: row(0.7),
    },
    bar: {
      position: 'relative',
      height: row(0.36),
      borderRadius: 2,
      background: LCD.track,
      boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.25)',
      '$mono &': {
        height: row(0.5),
        boxSizing: 'border-box',
        border: `${row(0.055)} solid ${LCD.text}`,
        borderRadius: row(0.25),
        background: 'transparent',
        boxShadow: 'none',
      },
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 2,
      background: LCD.bar,
      '$mono &': { borderRadius: `${row(0.25)} 0 0 ${row(0.25)}` },
    },
    // Where the wheel is scrubbing to
    diamond: {
      position: 'absolute',
      top: '50%',
      width: row(0.46),
      height: row(0.46),
      transform: 'translate(-50%, -50%) rotate(45deg)',
      background: LCD.accent,
      border: `1.5px solid ${LCD.background}`,
      boxShadow: `0 0 0 1px ${LCD.accent}`,
      boxSizing: 'border-box',
      '$mono &': {
        width: row(0.42),
        height: row(0.42),
        background: LCD.text,
        border: 'none',
        boxShadow: 'none',
      },
    },
    // The volume, while the wheel turns it: a bar between a quiet and a loud speaker
    volume: {
      display: 'flex',
      alignItems: 'center',
      gap: row(0.2),
      '& $bar': { flex: 1 },
    },
    speaker: { flex: '0 0 auto', height: row(0.46), width: 'auto' },
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
      fontVariantNumeric: 'tabular-nums',
      '$mono &': { fontSize: row(0.6), marginTop: row(0.14) },
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
  // How the screen shows the cover: "lowRes" (the iPod Photo's small, grainy covers), "tilt"
  // (the classic's, in perspective), or plain
  coverLook,
  // A black and white screen, with the early iPods' software
  mono = false,
  // Whether Now Playing shows the album (the mini's didn't)
  album = true,
  // What the bottom of Now Playing shows: the song's "progress", the "volume" (the wheel turning
  // it), or "scrub" (the wheel scrubbing, a diamond where to)
  mode = 'progress',
  // Whether the phone keeps the volume to itself (iPhones): a hint to use its buttons instead
  volumeLocked = false,
  // The iPod's own software, where it differs: "classic" (the 6th and 7th generation)
  software,
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const t = (key, opts) => translate(`player.mobile.${key}`, opts)
  const {
    song,
    item,
    queue,
    index,
    playing,
    currentTime,
    duration,
    isRadio,
    volume = 1,
  } = audio

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

  const classic = software === 'classic'
  const fifth = software === 'fifth'
  // The classic's main menu, beside the covers of the iPod's albums
  const home = classic && menu?.isMenu && menu.screen?.type === 'main'
  const scrubbing = scrubTime !== null || mode === 'scrub'
  const shown = scrubTime !== null ? scrubTime : currentTime
  const progress = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0
  const title = song.title || item.name || ''
  const artist = song.artist || item.singer || ''
  const position =
    queue.length > 1 &&
    t('position', {
      n: (index + 1).toLocaleString(),
      total: queue.length.toLocaleString(),
    })

  const rating = Math.round(song.rating || 0)
  const nowPlaying = (
    <div className={classes.nowPlaying}>
      {classic ? (
        <div className={classes.classicBody}>
          {item.cover && (
            <span className={classes.classicCover} data-testid="cover-tilt">
              <img
                className={classes.cover}
                src={item.cover}
                alt={song.album || title}
                draggable={false}
                {...cover.handlers}
              />
            </span>
          )}
          <div className={`${classes.classicInfo} songTitle`}>
            <Marquee className={classes.classicTitle}>{title}</Marquee>
            {artist && (
              <Marquee className={classes.classicLine}>{artist}</Marquee>
            )}
            {song.album && (
              <Marquee className={classes.classicLine}>{song.album}</Marquee>
            )}
            {rating > 0 && (
              <div
                className={classes.stars}
                role="img"
                aria-label={t('rating', { smart_count: rating })}
                data-testid="rating"
              >
                {'★'.repeat(rating)}
              </div>
            )}
            {position && (
              <div
                className={classes.classicPosition}
                data-testid="now-playing-position"
              >
                {position}
              </div>
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
      ) : art ? (
        <>
          {fifth && position && (
            <div
              className={`${classes.positionTop} songTitle`}
              data-testid="now-playing-position"
            >
              {position}
            </div>
          )}
          <div className={classes.body}>
            {item.cover &&
              (coverLook === 'lowRes' || coverLook === 'tilt' ? (
                <span
                  className={classes[coverLook]}
                  data-testid={`cover-${coverLook}`}
                >
                  <img
                    className={classes.cover}
                    src={
                      coverLook === 'lowRes'
                        ? lowResCover(item.cover)
                        : item.cover
                    }
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
        </>
      ) : (
        <>
          {position && (
            <div
              className={`${classes.positionTop} songTitle`}
              data-testid="now-playing-position"
            >
              {position}
            </div>
          )}
          <div
            className={`${classes.textOnly} songTitle`}
            data-testid="now-playing-text"
            {...cover.handlers}
          >
            <Marquee className={classes.textTitle}>{title}</Marquee>
            {artist && <Marquee className={classes.textLine}>{artist}</Marquee>}
            {album && song.album && (
              <Marquee className={classes.textLine}>{song.album}</Marquee>
            )}
          </div>
        </>
      )}
      <div className={`${classes.footer} songTitle`}>
        {art && !classic && !fifth && position && (
          <div className={classes.position}>{position}</div>
        )}
        {mode === 'volume' ? (
          <>
            <div className={classes.volume} data-testid="volume">
              <Speaker className={classes.speaker} />
              <div
                className={classes.bar}
                role="meter"
                aria-label={t('volume')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(volume * 100)}
              >
                <div
                  className={classes.fill}
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
              <Speaker className={classes.speaker} loud />
            </div>
            <div className={classes.times}>
              {volumeLocked ? t('volumeLocked') : '\u00a0'}
            </div>
          </>
        ) : (
          !isRadio && (
            <div className={classic ? classes.classicProgress : undefined}>
              {classic && <span>{formatTime(shown)}</span>}
              <div className={classes.bar}>
                {/* Scrubbing, the early iPods showed just the diamond on an empty bar */}
                {!(mono && scrubbing) && (
                  <div
                    className={classes.fill}
                    style={{ width: `${progress}%` }}
                  />
                )}
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
              {classic ? (
                <span>{formatTime(duration - shown, true)}</span>
              ) : (
                <div className={classes.times}>
                  <span>{formatTime(shown)}</span>
                  <span>{formatTime(duration - shown, true)}</span>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )

  const screen = (
    <>
      <div
        className={`${classes.header} ${classic ? classes.classicHeader : ''} songTitle`}
      >
        {!classic && (
          <span className={classes.headerSide} aria-hidden>
            {fifth ? (
              <PlayState className={classes.classicGlyph} playing={playing} />
            ) : playing ? (
              '▶'
            ) : (
              '❚❚'
            )}
          </span>
        )}
        <Marquee className={classes.headerTitle}>
          {menu?.isMenu
            ? menu.title
            : t(view === 'upNext' ? 'upNext' : 'nowPlaying')}
        </Marquee>
        {classic && (
          <PlayState className={classes.classicGlyph} playing={playing} />
        )}
        <span className={classes.headerSide}>
          {mono ? (
            <span
              className={classes.batteryWrap}
              role="img"
              aria-label={batteryLabel}
              title={batteryLabel}
              data-testid="battery"
            >
              <SegmentedBattery
                className={classes.monoBattery}
                level={battery ? battery.level : 1}
                charging={!!battery?.charging}
              />
            </span>
          ) : (
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
          )}
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
    </>
  )

  return (
    <div
      className={`${classes.root} ${mono ? classes.mono : ''} ${classic ? classes.classic : ''} ${fifth ? classes.fifth : ''} ${home ? classes.home : ''}`}
      data-mono={mono ? 'true' : undefined}
      data-software={software}
    >
      {home ? (
        <>
          <div className={classes.homeMenu}>{screen}</div>
          <CoverShuffle
            className={classes.homeCovers}
            libraryId={menu.ipodId}
            fallback={item.cover}
          />
        </>
      ) : (
        screen
      )}
    </div>
  )
}
