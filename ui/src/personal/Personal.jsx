import { SimpleForm, Title, useTranslate } from 'react-admin'
import { Card } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { SelectLanguage } from './SelectLanguage'
import { SelectTheme } from './SelectTheme'
import { SelectFont } from './SelectFont'
import { SelectDefaultView } from './SelectDefaultView'
import { NotificationsToggle } from './NotificationsToggle'
import { LastfmScrobbleToggle } from './LastfmScrobbleToggle'
import { ListenBrainzScrobbleToggle } from './ListenBrainzScrobbleToggle'
import { ActivitySharingToggle } from './ActivitySharingToggle'
import config from '../config'
import { APP_NAME } from '../common/Title'
import { ReplayGainToggle } from './ReplayGainToggle'

const useStyles = makeStyles({
  root: { marginTop: '1em' },
})

const Personal = () => {
  const translate = useTranslate()
  const classes = useStyles()

  return (
    <Card className={classes.root}>
      <Title title={`${APP_NAME} - ` + translate('menu.personal.name')} />
      <SimpleForm toolbar={null} variant={'outlined'}>
        <SelectTheme />
        <SelectFont />
        <SelectLanguage />
        <SelectDefaultView />
        {config.enableReplayGain && <ReplayGainToggle />}
        <NotificationsToggle />
        {config.lastFMEnabled && <LastfmScrobbleToggle />}
        {config.listenBrainzEnabled && <ListenBrainzScrobbleToggle />}
        <ActivitySharingToggle />
      </SimpleForm>
    </Card>
  )
}

export default Personal
