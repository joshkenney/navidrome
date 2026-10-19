import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { DEFAULT_UI_FONT, uiFontStylesheet } from './uiFonts'

const STYLE_ID = 'nd-font-override'

// Applies the font picked in Personal > Font to the whole UI
export const useUiFont = () => {
  const font = useSelector((state) => state.settings?.uiFont) ?? DEFAULT_UI_FONT

  useEffect(() => {
    let style = document.getElementById(STYLE_ID)
    const css = uiFontStylesheet(font)
    if (!css) {
      style?.remove()
      return
    }
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    style.innerHTML = css
  }, [font])
}
