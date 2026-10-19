import React from 'react'
import { Route } from 'react-router-dom'
import Personal from './personal/Personal'
import IpodRadioPage from './ipods/IpodRadioPage'

const routes = [
  <Route exact path="/personal" render={() => <Personal />} key={'personal'} />,
  <Route
    exact
    path="/ipod-radio"
    render={() => <IpodRadioPage />}
    key={'ipod-radio'}
  />,
]

export default routes
