// The click wheel's click, heard: a tiny tick made on the spot with Web Audio (no sound file), a
// few milliseconds of filtered noise dying away fast, like the iPod's little speaker clicking.
//
// Browsers only let a page make sound after a touch, so the audio starts on the first click, which
// always comes from one. iPhones keep it quiet when the phone is on silent

// How loud, and how long (seconds) each kind of click is: a wheel click, a button, a long press
const KINDS = {
  tick: { gain: 0.22, length: 0.004 },
  press: { gain: 0.3, length: 0.006 },
  hold: { gain: 0.3, length: 0.006, twice: true },
}
// At most a click every 50ms, and none when more than 150ms of clicks are already waiting
const MIN_GAP = 0.05
const MAX_QUEUED = 0.15

let enabled = true
let context = null
let noise = null
// When the last click queued plays (in the audio's time)
let next = 0

const AudioContextClass = () =>
  typeof window === 'undefined'
    ? null
    : window.AudioContext || window.webkitAudioContext || null

const audio = () => {
  if (context) return context
  const Ctx = AudioContextClass()
  if (!Ctx) return null
  context = new Ctx()
  // White noise, shaped into each click below
  const length = Math.ceil(context.sampleRate * 0.02)
  noise = context.createBuffer(1, length, context.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return context
}

const play = (ctx, at, { gain, length }) => {
  const source = ctx.createBufferSource()
  source.buffer = noise
  // Only the bright part of the noise: a tick, not a hiss
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 3500
  filter.Q.value = 1.2
  const volume = ctx.createGain()
  volume.gain.setValueAtTime(gain, at)
  volume.gain.exponentialRampToValueAtTime(0.001, at + length)
  source.connect(filter)
  filter.connect(volume)
  volume.connect(ctx.destination)
  source.start(at)
  source.stop(at + length + 0.01)
}

// "kind": tick (a wheel click), press (a button) or hold (a long press)
export const click = (kind = 'press') => {
  if (!enabled) return
  try {
    const ctx = audio()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume?.()
    const now = ctx.currentTime
    if (next - now >= MAX_QUEUED) return
    const at = Math.max(now, next)
    const sound = KINDS[kind] || KINDS.press
    play(ctx, at, sound)
    if (sound.twice) play(ctx, at + 0.06, sound)
    next = at + MIN_GAP
  } catch (e) {
    // A nicety: never let it break a control
  }
}

// Turns the clicks on or off (Personal settings)
export const setClicks = (on) => {
  enabled = !!on
}

// For tests
export const resetClicks = () => {
  enabled = true
  context = null
  noise = null
  next = 0
}
