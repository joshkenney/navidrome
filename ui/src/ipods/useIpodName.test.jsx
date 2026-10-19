import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { IpodLabel } from './IpodLabel'

describe('<IpodLabel />', () => {
  const store = createStore(() => ({
    library: { userLibraries: [{ id: 7, name: "Carol's iPod" }] },
  }))

  it('uses the name of the song', () => {
    render(<IpodLabel libraryId={7} libraryName="Named iPod" />)
    expect(screen.getByText('Named iPod')).toBeInTheDocument()
  })

  it("looks up the name from the user's libraries", () => {
    render(
      <Provider store={store}>
        <IpodLabel libraryId={7} />
      </Provider>,
    )
    expect(screen.getByText("Carol's iPod")).toBeInTheDocument()
  })

  it('renders nothing when the iPod is unknown', () => {
    const { container } = render(<IpodLabel libraryId={99} />)
    expect(container.textContent).toBe('')
  })
})
