export const SET_NOTIFICATIONS_STATE = 'SET_NOTIFICATIONS_STATE'
export const SET_TOGGLEABLE_FIELDS = 'SET_TOGGLEABLE_FIELDS'
export const SET_OMITTED_FIELDS = 'SET_OMITTED_FIELDS'
export const SET_UI_FONT = 'SET_UI_FONT'
export const SET_IPOD_SKIN = 'SET_IPOD_SKIN'
export const SET_IPOD_HAPTICS = 'SET_IPOD_HAPTICS'

export const setNotificationsState = (enabled) => ({
  type: SET_NOTIFICATIONS_STATE,
  data: enabled,
})

export const setToggleableFields = (obj) => ({
  type: SET_TOGGLEABLE_FIELDS,
  data: obj,
})

export const setOmittedFields = (obj) => ({
  type: SET_OMITTED_FIELDS,
  data: obj,
})

export const setUiFont = (font) => ({
  type: SET_UI_FONT,
  data: font,
})

// The iPod the phone player looks like (see audioplayer/mobile/skins.js)
export const setIpodSkin = (skin) => ({
  type: SET_IPOD_SKIN,
  data: skin,
})

// Whether the phone player's click wheel clicks through the phone's vibration
export const setIpodHaptics = (on) => ({
  type: SET_IPOD_HAPTICS,
  data: on,
})
