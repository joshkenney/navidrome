import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { useUiFont } from './useUiFont'
import { uiFontStylesheet } from './uiFonts'

const Probe = () => {
  useUiFont()
  return null
}

const renderWith = (font) =>
  render(
    <Provider store={createStore(() => ({ settings: { font } }))}>
      <Probe />
    </Provider>,
  )

const overrideStyle = () => document.getElementById('nd-font-override')

describe('useUiFont', () => {
  afterEach(() => overrideStyle()?.remove())

  it('applies Chicago to the whole UI', () => {
    renderWith('chicago')
    const css = overrideStyle().innerHTML
    expect(css).toContain("src: url('fonts/ChicagoFLF.ttf')")
    expect(css).toMatch(/font-family: "ChicagoFLF".*!important/)
  })

  it('pairs Chicago headings with Source Sans 3 text', () => {
    renderWith('ipod')
    const css = overrideStyle().innerHTML
    expect(css).toContain("src: url('fonts/ChicagoFLF.ttf')")
    expect(css).toContain("src: url('fonts/SourceSans3-Variable.woff2')")
    expect(css).toMatch(
      /:where\(body, body \*[^{]*\{\s*font-family: "Source Sans 3"/,
    )
    const headings = css
      .split('}')
      .find((rule) => rule.includes('font-family: "ChicagoFLF"'))
    expect(headings).toContain('.MuiDialogTitle-root')
    expect(headings).toContain('.MuiButton-label *')
    expect(headings).toContain('.songTitle')
    expect(headings).toContain('.songDetails')
    expect(headings).toContain('.MuiDrawer-root .MuiChip-label')
    expect(headings).toContain('font-synthesis: none')
    // Comments are styled as headings, but keep the body font
    const bodyText = css
      .split('}')
      .find((rule) => rule.includes('.ndBodyText.ndBodyText'))
    expect(bodyText).toContain('font-family: "Source Sans 3"')
  })

  it('switches back to the theme font', () => {
    const { unmount } = renderWith('podium')
    expect(overrideStyle().innerHTML).toContain('Source Sans 3')
    unmount()
    renderWith('default')
    expect(overrideStyle()).toBeNull()
  })

  it('keeps the theme font for an unknown or missing setting', () => {
    renderWith(undefined)
    expect(overrideStyle()).toBeNull()
    expect(uiFontStylesheet('comic-sans')).toBe('')
  })
})
