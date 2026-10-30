import React from 'react'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IpodLabel } from '../../ipods/IpodLabel'
import { LCD, formatTime } from './ipodLook'

const useStyles = makeStyles(
  {
    root: {
      borderRadius: 8,
      background: LCD.background,
      boxShadow: LCD.bevel,
      color: LCD.text,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 8px',
      fontSize: 13,
      lineHeight: '18px',
      borderBottom: `1px solid ${LCD.track}`,
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))',
    },
    headerSide: { width: 28, display: 'flex', alignItems: 'center' },
    battery: {
      marginLeft: 'auto',
      width: 20,
      height: 9,
      border: `1px solid ${LCD.text}`,
      borderRadius: 2,
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: 1,
        right: 4,
        background: LCD.text,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        right: -3,
        top: 2,
        width: 2,
        height: 3,
        background: LCD.text,
      },
    },
    body: {
      display: 'flex',
      gap: 10,
      padding: 10,
      alignItems: 'center',
    },
    // A still, square cover: never the spinning record
    cover: {
      width: '42%',
      maxWidth: 220,
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      flex: '0 0 auto',
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
      background: LCD.track,
      touchAction: 'none',
    },
    info: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    title: { fontSize: 16, lineHeight: '20px', wordBreak: 'break-word' },
    line: {
      fontSize: 13,
      lineHeight: '17px',
      color: LCD.muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
    },
    ipod: { fontSize: 12, color: LCD.muted },
    footer: { padding: '0 10px 10px' },
    position: { fontSize: 12, color: LCD.muted, marginBottom: 4 },
    bar: {
      position: 'relative',
      height: 10,
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
      width: 12,
      height: 12,
      marginLeft: -6,
      marginTop: -6,
      transform: 'rotate(45deg)',
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
      fontSize: 12,
      marginTop: 3,
    },
  },
  { name: 'NDIpodScreen' },
)

// The iPod's screen, showing the song playing ("Now Playing"). While the wheel scrubs, it shows
// where to ("scrubTime"), with a diamond on the bar, like the iPod
export const IpodScreen = ({ audio, controls, scrubTime = null }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const t = (key, opts) => translate(`player.mobile.${key}`, opts)
  const { song, item, queue, index, playing, currentTime, duration, isRadio } =
    audio

  const scrubbing = scrubTime !== null
  const shown = scrubbing ? scrubTime : currentTime
  const progress = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0
  const title = song.title || item.name || ''
  const artist = song.artist || item.singer || ''

  return (
    <div className={classes.root}>
      <div className={`${classes.header} songTitle`}>
        <span className={classes.headerSide} aria-hidden>
          {playing ? '▶' : '❚❚'}
        </span>
        <span>{t('nowPlaying')}</span>
        <span className={classes.headerSide} aria-hidden>
          <span className={classes.battery} />
        </span>
      </div>
      <div className={classes.body}>
        {item.cover && (
          <img
            className={classes.cover}
            src={item.cover}
            alt={song.album || title}
            draggable={false}
          />
        )}
        <div className={`${classes.info} songTitle`}>
          <div className={classes.title}>{title}</div>
          {artist && <div className={classes.line}>{artist}</div>}
          {song.album && <div className={classes.line}>{song.album}</div>}
          {!isRadio && song.libraryId && (
            <IpodLabel
              className={classes.ipod}
              libraryId={song.libraryId}
              libraryName={song.libraryName}
            />
          )}
        </div>
      </div>
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
}
