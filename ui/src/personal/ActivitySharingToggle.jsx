import { useEffect, useState } from 'react'
import { useNotify, useTranslate } from 'react-admin'
import { FormControl, FormControlLabel, Switch } from '@material-ui/core'
import { httpClient } from '../dataProvider'

export const ActivitySharingToggle = () => {
  const notify = useNotify()
  const translate = useTranslate()
  const [shareActivity, setShareActivity] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    const id = localStorage.getItem('userId')
    setUserId(id)
    if (id) {
      httpClient('/api/user/' + id)
        .then((response) => {
          setShareActivity(response.json.shareActivity !== false)
        })
        .catch(() => setShareActivity(true))
    }
  }, [])

  const toggleSharing = () => {
    if (!userId || shareActivity === null) return
    const next = !shareActivity

    httpClient('/api/user/' + userId)
      .then((response) => {
        const user = response.json
        return httpClient('/api/user/' + userId, {
          method: 'PUT',
          body: JSON.stringify({ ...user, shareActivity: next }),
        })
      })
      .then(() => {
        setShareActivity(next)
        notify(
          next
            ? 'message.activitySharingEnabled'
            : 'message.activitySharingDisabled',
          'success',
        )
      })
      .catch(() => notify('ra.notification.http_error', 'warning'))
  }

  return (
    <FormControl>
      <FormControlLabel
        control={
          <Switch
            id={'share-activity'}
            color="primary"
            checked={shareActivity === true}
            disabled={shareActivity === null}
            onChange={toggleSharing}
          />
        }
        label={
          <span>
            {translate('menu.personal.options.activitySharing')}
          </span>
        }
      />
    </FormControl>
  )
}
