/** Mini “canción” de fiesta con Web Audio (sin archivos externos). */

let ctx = null
let master = null
let playing = false
let muted = false
let timers = []
let step = 0

const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0]
const SNARE = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
const HAT = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
const BASS = [36, 0, 36, 0, 39, 0, 36, 0, 34, 0, 36, 0, 41, 0, 39, 0]
const LEAD = [60, 0, 63, 64, 0, 67, 0, 64, 63, 0, 60, 0, 67, 64, 0, 72]

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)
  }
  return ctx
}

function buzz(freq, when, dur, type = 'square', gain = 0.08) {
  if (!ctx || !master || muted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

function noiseHit(when, dur, gain = 0.05) {
  if (!ctx || !master || muted) return
  const size = Math.floor(ctx.sampleRate * dur)
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 4000
  src.buffer = buffer
  g.gain.setValueAtTime(gain, when)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(when)
  src.stop(when + dur)
}

function kick(when) {
  if (!ctx || !master || muted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, when)
  osc.frequency.exponentialRampToValueAtTime(45, when + 0.12)
  g.gain.setValueAtTime(0.22, when)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18)
  osc.connect(g)
  g.connect(master)
  osc.start(when)
  osc.stop(when + 0.2)
}

function scheduleStep() {
  if (!playing || !ctx) return
  const t = ctx.currentTime + 0.05
  const i = step % 16

  if (KICK[i]) kick(t)
  if (SNARE[i]) noiseHit(t, 0.1, 0.07)
  if (HAT[i]) noiseHit(t, 0.03, i % 2 === 0 ? 0.03 : 0.015)
  if (BASS[i]) buzz(midiToFreq(BASS[i]), t, 0.16, 'sawtooth', 0.07)
  if (LEAD[i]) buzz(midiToFreq(LEAD[i]), t, 0.12, 'square', 0.045)

  step += 1
}

export async function startEmmitaMusic() {
  const audio = ensureCtx()
  if (!audio) return
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      return
    }
  }
  if (playing) return
  playing = true
  step = 0
  if (master) master.gain.value = muted ? 0 : 0.18
  timers.forEach((id) => clearInterval(id))
  timers = []
  scheduleStep()
  timers.push(window.setInterval(scheduleStep, 140))
}

export function stopEmmitaMusic() {
  playing = false
  timers.forEach((id) => clearInterval(id))
  timers = []
  if (master && ctx) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(0.0001, ctx.currentTime)
    } catch {
      /* ignore */
    }
  }
}

export function setEmmitaMusicMuted(next) {
  muted = Boolean(next)
  if (master) master.gain.value = muted || !playing ? 0 : 0.18
}

export function isEmmitaMusicMuted() {
  return muted
}

export function softenEmmitaMusic() {
  if (master && playing && !muted) master.gain.value = 0.1
}
