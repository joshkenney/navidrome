// A light tap of the phone's vibration motor, like the click wheel's click. Android only: iPhones
// don't let web pages vibrate, and some browsers block it until the page is touched
export const buzz = (ms = 4) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms)
    }
  } catch (e) {
    // Vibration is a nicety: never let it break a control
  }
}
