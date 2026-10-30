// What the phone player can do to the music player underneath it. The audio element carries the
// player's own controls (playNext, playPrev, togglePlay, playByIndex). Moving and removing songs
// in the queue use the player component's internal handlers, the ones its desktop queue panel uses,
// so they are only reached here: they keep the song playing, and report the new queue through
// onAudioListsChange like any change made in the player

// The key the player gives each song of its queue
const PLAYER_KEY = '__PLAYER_KEY__'

export const makeControls = (audio, playerRef) => {
  const player = () => playerRef?.current
  return {
    togglePlay: () => audio?.togglePlay?.(),
    next: () => audio?.playNext?.(),
    prev: () => audio?.playPrev?.(),
    // Through the player's own seek, like its progress bar: the player plays again whenever the
    // song is ready to, unless it knows it is seeking, so a paused song would start playing
    seek: (seconds) => {
      if (!audio || !Number.isFinite(seconds)) return
      const to = Math.max(0, seconds)
      const p = player()
      if (p?.onAudioSeeked) {
        p.onAudioSeeked(to)
      } else {
        audio.currentTime = to
      }
    },
    playAt: (index) => audio?.playByIndex?.(index),
    // Moves the song at "from" to "to", shifting the ones in between (not swapping them). Run on
    // its own, outside React's event handling, like the player's queue panel (SortableJS) does:
    // inside it, the player's new order isn't applied yet when it reports it, and the queue it is
    // then given back makes it restore the old one
    move: (from, to) => {
      if (from === to) return
      setTimeout(() =>
        player()?.onAudioListsSortEnd?.({ oldIndex: from, newIndex: to }),
      )
    },
    // Removes the song at "index"; when it is the one playing, the next one plays
    remove: (index) => {
      const p = player()
      const key = p?.state?.audioLists?.[index]?.[PLAYER_KEY]
      if (key === undefined) return
      p.onDeleteAudioLists?.(key)?.({ stopPropagation: () => {} })
    },
  }
}
