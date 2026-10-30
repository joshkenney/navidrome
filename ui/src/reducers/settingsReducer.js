import {
  SET_IPOD_BACKLIGHT,
  SET_IPOD_CLICKS,
  SET_IPOD_HAPTICS,
  SET_IPOD_SKIN,
  SET_NOTIFICATIONS_STATE,
  SET_OMITTED_FIELDS,
  SET_TOGGLEABLE_FIELDS,
  SET_UI_FONT,
} from '../actions'

const initialState = {
  notifications: false,
  toggleableFields: {},
  omittedFields: {},
  // Saved under a new key (it was "font"), so existing users start with the iPod fonts too
  uiFont: 'ipod',
  // The phone player's iPod ("auto": matching the theme), its click wheel's clicks, felt and
  // heard, and its backlight's timer (seconds)
  ipodSkin: 'auto',
  ipodHaptics: true,
  ipodClicks: true,
  ipodBacklight: 10,
}

export const settingsReducer = (previousState = initialState, payload) => {
  const { type, data } = payload
  switch (type) {
    case SET_NOTIFICATIONS_STATE:
      return {
        ...previousState,
        notifications: data,
      }
    case SET_TOGGLEABLE_FIELDS:
      return {
        ...previousState,
        toggleableFields: {
          ...previousState.toggleableFields,
          ...data,
        },
      }
    case SET_OMITTED_FIELDS:
      return {
        ...previousState,
        omittedFields: {
          ...previousState.omittedFields,
          ...data,
        },
      }
    case SET_UI_FONT:
      return {
        ...previousState,
        uiFont: data,
      }
    case SET_IPOD_SKIN:
      return {
        ...previousState,
        ipodSkin: data,
      }
    case SET_IPOD_HAPTICS:
      return {
        ...previousState,
        ipodHaptics: data,
      }
    case SET_IPOD_CLICKS:
      return {
        ...previousState,
        ipodClicks: data,
      }
    case SET_IPOD_BACKLIGHT:
      return {
        ...previousState,
        ipodBacklight: data,
      }
    default:
      return previousState
  }
}
