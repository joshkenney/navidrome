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
