import React from 'react'
import { useTranslate } from 'react-admin'
import { useDispatch, useSelector } from 'react-redux'
import {
  ButtonBase,
  FormControlLabel,
  FormHelperText,
  Switch,
  Typography,
} from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { setIpodHaptics, setIpodSkin } from '../actions'
import {
  AUTO_SKIN,
  SKINS,
  SKIN_GROUPS,
  skinFor,
} from '../audioplayer/mobile/skins'

const useStyles = makeStyles((theme) => ({
  root: { margin: theme.spacing(1, 0, 3) },
  group: { marginTop: theme.spacing(1.5) },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    maxWidth: 760,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1),
    borderRadius: 8,
    border: `2px solid transparent`,
    textAlign: 'center',
  },
  selected: { borderColor: theme.palette.primary.main },
  name: { fontSize: '0.75rem', lineHeight: 1.25 },
  // A little iPod: case, screen and wheel
  ipod: {
    position: 'relative',
    width: 56,
    height: 92,
    borderRadius: 9,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
  },
  screen: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    height: 30,
    borderRadius: 2,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.3)',
  },
  wheel: {
    position: 'absolute',
    left: '50%',
    bottom: 8,
    width: 38,
    height: 38,
    marginLeft: -19,
    borderRadius: '50%',
  },
  ringWheel: { width: 26, height: 26, marginLeft: -13, bottom: 14 },
  rowButtons: {
    position: 'absolute',
    top: 41,
    left: 8,
    right: 8,
    height: 5,
    display: 'flex',
    justifyContent: 'space-between',
    '& span': { width: 8, height: 5, borderRadius: 3 },
  },
  center: {
    position: 'absolute',
    top: '33%',
    left: '33%',
    width: '34%',
    height: '34%',
    borderRadius: '50%',
  },
}))

// A small drawing of an iPod
export const IpodPreview = ({ skin }) => {
  const classes = useStyles()
  const edge = `0 0 0 1px ${skin.wheelEdge}`
  return (
    <span
      className={classes.ipod}
      style={{ background: skin.case }}
      aria-hidden
    >
      <span
        className={classes.screen}
        style={{ background: skin.lcd.background }}
      />
      {skin.wheelType === 'row' && (
        <span className={classes.rowButtons}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{ background: skin.rowLabel, boxShadow: edge }}
            />
          ))}
        </span>
      )}
      {skin.wheelType === 'ring' && (
        <span
          className={classes.wheel}
          style={{ background: skin.ring, boxShadow: edge }}
        />
      )}
      <span
        className={`${classes.wheel} ${
          skin.wheelType === 'ring' ? classes.ringWheel : ''
        }`}
        style={{ background: skin.wheel, boxShadow: edge }}
      >
        <span
          className={classes.center}
          style={{ background: skin.center, boxShadow: edge }}
        />
      </span>
    </span>
  )
}

// Personal settings: the iPod the player looks like on phones, and its click wheel's clicks
export const SelectIpod = () => {
  const classes = useStyles()
  const theme = useTheme()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const t = (key) => translate(`menu.personal.options.${key}`)
  const current = useSelector((state) => state.settings?.ipodSkin) || AUTO_SKIN
  const haptics = useSelector((state) => state.settings?.ipodHaptics) !== false

  const card = (id, name, skin) => (
    <ButtonBase
      key={id}
      focusRipple
      className={`${classes.card} ${current === id ? classes.selected : ''}`}
      aria-pressed={current === id}
      onClick={() => dispatch(setIpodSkin(id))}
    >
      <IpodPreview skin={skin} />
      <span className={classes.name}>{name}</span>
    </ButtonBase>
  )

  return (
    <div className={classes.root}>
      <Typography variant="subtitle1">{t('ipod')}</Typography>
      <FormHelperText>{t('ipodHelp')}</FormHelperText>
      <div className={classes.grid}>
        {card(AUTO_SKIN, t('ipodAuto'), skinFor(AUTO_SKIN, theme))}
      </div>
      {SKIN_GROUPS.map((group) => (
        <div key={group} className={classes.group}>
          <Typography variant="body2" color="textSecondary">
            {t(`ipodGroups.${group}`)}
          </Typography>
          <div className={classes.grid}>
            {SKINS.filter((s) => s.group === group).map((s) =>
              card(s.id, s.name, s),
            )}
          </div>
        </div>
      ))}
      <FormControlLabel
        className={classes.group}
        control={
          <Switch
            color="primary"
            checked={haptics}
            onChange={(e) => dispatch(setIpodHaptics(e.target.checked))}
          />
        }
        label={t('ipodHaptics')}
      />
      <FormHelperText>{t('ipodHapticsHelp')}</FormHelperText>
    </div>
  )
}
