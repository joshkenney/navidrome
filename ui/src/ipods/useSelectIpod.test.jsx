import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { useSelectIpod } from './useSelectIpod'

const libraries = [
  { id: 1, name: "Alice's iPod" },
  { id: 2, name: "Bob's iPod" },
  { id: 3, name: "Carol's iPod" },
]

const Clicker = ({ libraryId, libraryName }) => {
  const select = useSelectIpod()
  return <button onClick={() => select(libraryId, libraryName)}>open</button>
}

describe('useSelectIpod', () => {
  let store

  const renderWith = (selectedLibraries, props) => {
    store = createStore(
      (state, action) =>
        action.type === 'SET_SELECTED_LIBRARIES'
          ? { library: { ...state.library, selectedLibraries: action.data } }
          : state,
      { library: { userLibraries: libraries, selectedLibraries } },
    )
    render(
      <Provider store={store}>
        <Clicker {...props} />
      </Provider>,
    )
    fireEvent.click(screen.getByText('open'))
    return store.getState().library.selectedLibraries
  }

  beforeEach(() => localStorage.clear())

  it("adds the song's iPod to the selection, and saves it right away", () => {
    expect(renderWith([1], { libraryId: 3 })).toEqual([1, 3])
    expect(
      JSON.parse(localStorage.getItem('state')).library.selectedLibraries,
    ).toEqual([1, 3])
  })

  it('finds the iPod by name', () => {
    expect(renderWith([1], { libraryName: "Bob's iPod" })).toEqual([1, 2])
  })

  it('keeps the selection when the iPod is already selected', () => {
    expect(renderWith([1, 3], { libraryId: 3 })).toEqual([1, 3])
    expect(localStorage.getItem('state')).toBeNull()
  })

  it('keeps "all iPods" as is', () => {
    expect(renderWith([], { libraryId: 3 })).toEqual([])
  })

  it('ignores unknown iPods', () => {
    expect(renderWith([1], { libraryName: 'Nope' })).toEqual([1])
  })

  it('does nothing without a store', () => {
    render(<Clicker libraryId={3} />)
    fireEvent.click(screen.getAllByText('open').at(-1))
  })
})
