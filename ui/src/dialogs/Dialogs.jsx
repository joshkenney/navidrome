import { AddToPlaylistDialog } from './AddToPlaylistDialog'
import DownloadMenuDialog from './DownloadMenuDialog'
import { HelpDialog } from './HelpDialog'
import { ShareDialog } from './ShareDialog'
import { SaveQueueDialog } from './SaveQueueDialog'
import { WelcomeDialog } from './WelcomeDialog'
import { ListeningMatchCard } from '../listening/ListeningMatchCard'

export const Dialogs = (props) => (
  <>
    <AddToPlaylistDialog />
    <SaveQueueDialog />
    <DownloadMenuDialog />
    <HelpDialog />
    <ShareDialog />
    <WelcomeDialog />
    <ListeningMatchCard />
  </>
)
