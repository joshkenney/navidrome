import React from 'react'
import { Chip } from '@material-ui/core'
import { useTranslate } from 'react-admin'

const style = { height: 18, fontSize: '0.7rem' }

// Small labels on a search result: never played by the user, and where it was found when it
// wasn't in its name ("in lyrics"). Results from the search API always carry the user's play
// count, left out when zero
export const ResultBadges = ({ item, match }) => {
  const translate = useTranslate()
  const neverPlayed = item && !item.playCount
  if (!neverPlayed && !match) return null
  return (
    <>
      {neverPlayed && (
        <Chip
          size="small"
          style={style}
          label={translate('search.neverPlayed')}
        />
      )}
      {match && (
        <Chip
          size="small"
          variant="outlined"
          style={style}
          label={translate(`search.matchedIn.${match}`)}
        />
      )}
    </>
  )
}

export default ResultBadges
