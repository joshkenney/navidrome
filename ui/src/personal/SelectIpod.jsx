import React from 'react'
import { useTranslate } from 'react-admin'
import { useDispatch, useSelector } from 'react-redux'
import {
  ButtonBase,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@material-ui/core'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import {
  setIpodBacklight,
  setIpodClicks,
  setIpodHaptics,
  setIpodSkin,
} from '../actions'
import {
  AUTO_SKIN,
  SKINS,
  SKIN_GROUPS,
  modelOf,
  skinFor,
} from '../audioplayer/mobile/skins'
import { IpodBody } from '../audioplayer/mobile/IpodBody'

const useStyles = makeStyles((theme) => ({
  // The grid fits the page: a maximum width on the grid itself would make it as wide as that, and
  // push the page wider than a phone
  root: { margin: theme.spacing(1, 0, 3), width: '100%', maxWidth: 760 },
  group: { marginTop: theme.spacing(1.5) },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
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
  // A little iPod, at the scale of the real ones: the mini is smaller
  ipod: {
    display: 'block',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))',
  },
}))

// A small drawing of an iPod, 0.95 px per millimetre
export const IpodPreview = ({ skin }) => {
  const classes = useStyles()
  const m = modelOf(skin)
  return (
    <span
      className={classes.ipod}
      style={{ width: m.w * 0.95, height: m.h * 0.95 }}
      aria-hidden
    >
      <IpodBody skin={skin} />
    </span>
  )
}

// The backlight timer's choices: seconds, 0 for off
export const BACKLIGHT_TIMES = [0, 2, 5, 10, 'always']

// Personal settings: the iPod the player looks like on phones, its click wheel's clicks (felt and
// heard), and its backlight's timer
export const SelectIpod = () => {
  const classes = useStyles()
  const theme = useTheme()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const t = (key) => translate(`menu.personal.options.${key}`)
  const current = useSelector((state) => state.settings?.ipodSkin) || AUTO_SKIN
  const haptics = useSelector((state) => state.settings?.ipodHaptics) !== false
  const clicks = useSelector((state) => state.settings?.ipodClicks) !== false
  const backlight = useSelector((state) => state.settings?.ipodBacklight) ?? 10

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
      <FormControlLabel
        className={classes.group}
        control={
          <Switch
            color="primary"
            checked={clicks}
            onChange={(e) => dispatch(setIpodClicks(e.target.checked))}
          />
        }
        label={t('ipodClicks')}
      />
      <FormHelperText>{t('ipodClicksHelp')}</FormHelperText>
      <FormControl className={classes.group} style={{ minWidth: 200 }}>
        <InputLabel id="ipod-backlight">{t('ipodBacklight')}</InputLabel>
        <Select
          labelId="ipod-backlight"
          value={backlight}
          onChange={(e) => dispatch(setIpodBacklight(e.target.value))}
          data-testid="ipod-backlight"
        >
          {BACKLIGHT_TIMES.map((time) => (
            <MenuItem key={time} value={time}>
              {t(`ipodBacklightTimes.${time || 'off'}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormHelperText>{t('ipodBacklightHelp')}</FormHelperText>
    </div>
  )
}
