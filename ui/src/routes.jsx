import React from 'react'
import { Route } from 'react-router-dom'
import Personal from './personal/Personal'
import IpodRadioPage from './ipods/IpodRadioPage'
import TimelinePage from './listening/TimelinePage'
import HolesPage from './listening/HolesPage'
import SearchPage from './search/SearchPage'
import ErasPage from './eras/ErasPage'

const routes = [
  <Route exact path="/personal" render={() => <Personal />} key={'personal'} />,
  <Route
    exact
    path="/ipod-radio"
    render={() => <IpodRadioPage />}
    key={'ipod-radio'}
  />,
  <Route
    exact
    path="/timeline"
    render={() => <TimelinePage />}
    key={'timeline'}
  />,
  <Route exact path="/holes" render={() => <HolesPage />} key={'holes'} />,
  <Route exact path="/search" render={() => <SearchPage />} key={'search'} />,
  <Route exact path="/eras" render={() => <ErasPage />} key={'eras'} />,
]

export default routes
