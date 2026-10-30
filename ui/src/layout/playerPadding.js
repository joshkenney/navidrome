import { STRIP_HEIGHT } from '../audioplayer/mobile/ScreenStrip'

// Room left at the bottom of the page and the sidebar for the player: the desktop bar, or the
// phones' iPod strip (with the phone's safe area, like the iPhone home bar)
export const playerPadding = (addPadding, isMobile) => {
  if (!addPadding) return 0
  return isMobile
    ? `calc(${STRIP_HEIGHT}px + env(safe-area-inset-bottom))`
    : '80px'
}
