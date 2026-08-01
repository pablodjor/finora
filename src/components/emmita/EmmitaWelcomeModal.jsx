import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../lib/constants'
import {
  isEmmitaMusicMuted,
  setEmmitaMusicMuted,
  softenEmmitaMusic,
  startEmmitaMusic,
  stopEmmitaMusic,
} from '../../utils/emmitaPartyMusic'
import { emmitaWelcomeSessionKey } from '../../utils/emmitaWelcome'

const PHRASES = [
  'Bienvenido mi putita',
  'Hola puta rica, que gastaste hoy?',
  'Que rico tu culo, bienvenido y disfruta la app',
  'Estoy muy empaquetado desde que te vi. Bienvenido rica puta',
  'Le gusta joder asiaticas?, bienvenido puta',
  'Rica putita eh, bienvenido',
  'Entraste y ya me puse duro, bienvenida putita',
  'Mi puta favorita llegó a Finora',
  'Hola bebé, venís a gastar o a que te gasten?',
  'Bienvenida putita del orto, te extrañé',
  'Llegó la más rica del barrio, pasá',
  'Emmin entró y se me paró el alma',
  'Bienvenida mi coach de culos y finanzas',
  'Hola putita, hoy gastamos y después te rompo',
  'Pasá nena, acá sos reina y puta',
  'Bienvenida mi viciosa hermosa',
]

const FALLING_MESSAGES = [
  'Te quiero mucho',
  'Se que sos mi puta pero no hay otra',
  'Disfruta que te rompa el orto',
  'Zeballos es un muerto hijo de puta, igual que merentiel',
  'las empanadas del vasco',
  'Emmin sos mi coach',
  'Emmin te quiero mucho',
  'Te amo putita',
  'Sos mía y punto',
  'Qué culo hermoso tenés',
  'Hoy te como entero',
  'Mi putita preferida',
  'Emmin ❤️',
  'Te rompo rico',
  'Sos un delirio',
  'Puta pero fiel',
  'Me volvés loco',
  'Dale putita',
  'Te quiero en cuatro',
  'Emmin sos fuego',
  'Chupar y gastar',
  'Mi bebé sucia',
  'Rico todo de vos',
  'No hay otra como vos',
  'Te lleno de amor',
  'Y de otras cosas',
  'Emmin coach 🔥',
  'Vasco + empanadas',
  'Merentiel al tacho',
  'Zeballos no labura',
  'Finora + culo = ❤️',
  'Gasta y después a la cama',
  'Putita del mes',
  'Te adoro boluda',
  'Sos mi vicio',
  'Entraste y ya estoy duro',
  'Qué rica estás hoy',
  'Te quiero hasta el orto',
  'Emmin te merecés todo',
  'Hoy festejamos tu culo',
  'Mi amor putita',
  'Laburo, gasto, te cojo',
  'Sos demasiado',
  'Emmin 🥵',
  'Te quiero re mal',
  'Puta linda mía',
  'Dale que te como',
  'Sos mi plan A B y C',
]

const FLOAT_ICONS = ['❤️', '🔥', '💋', '🍑', '😈', '🥵', '💦', '👅', '💅', '✨', '🎉', '💖', '🌹', '🫦', '👑', '💸']

const PAPER_COLORS = ['#ff4d6d', '#ffd60a', '#7b2cbf', '#00bbf9', '#fb5607', '#80ed99', '#f72585', '#4cc9f0', '#ff9f1c']
const MSG_COLORS = ['#ffe566', '#ff8fab', '#c77dff', '#80ffdb', '#ffd6a5', '#bdb2ff', '#fffffc', '#ff4d6d', '#ffc6ff']

function pickPhrase() {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)]
}

function makePapers(count = 56) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 2.8,
    duration: 2.8 + Math.random() * 4.2,
    size: 7 + Math.random() * 16,
    rotate: Math.random() * 360,
    color: PAPER_COLORS[i % PAPER_COLORS.length],
    sway: (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 60),
    kind: Math.random() > 0.4 ? 'rect' : 'circle',
  }))
}

function makeFallingTexts(count = 42) {
  return Array.from({ length: count }, (_, i) => {
    const text = FALLING_MESSAGES[i % FALLING_MESSAGES.length]
    return {
      id: `t-${i}`,
      text,
      left: Math.random() * 86 + 2,
      delay: Math.random() * 6,
      duration: 5 + Math.random() * 5.5,
      rotate: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 22),
      sway: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 48),
      size: 0.72 + Math.random() * 0.55,
      color: MSG_COLORS[i % MSG_COLORS.length],
    }
  })
}

function makeFallingIcons(count = 36) {
  return Array.from({ length: count }, (_, i) => ({
    id: `i-${i}`,
    icon: FLOAT_ICONS[i % FLOAT_ICONS.length],
    left: Math.random() * 96,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 5,
    size: 1.1 + Math.random() * 1.6,
    sway: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 50),
    spin: 180 + Math.random() * 540,
  }))
}

function burstConfetti(canvas) {
  if (!canvas) return () => {}
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let raf = 0
  let running = true
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()
  window.addEventListener('resize', resize)

  const particles = []
  const origins = [
    { x: window.innerWidth * 0.1, y: window.innerHeight * 0.9 },
    { x: window.innerWidth * 0.35, y: window.innerHeight * 0.95 },
    { x: window.innerWidth * 0.5, y: window.innerHeight * 0.88 },
    { x: window.innerWidth * 0.65, y: window.innerHeight * 0.95 },
    { x: window.innerWidth * 0.9, y: window.innerHeight * 0.9 },
    { x: window.innerWidth * 0.25, y: window.innerHeight * 0.15 },
    { x: window.innerWidth * 0.75, y: window.innerHeight * 0.15 },
  ]

  function spawnBurst(origin, amount) {
    for (let i = 0; i < amount; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
      const speed = 7 + Math.random() * 16
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed * (0.4 + Math.random()),
        vy: Math.sin(angle) * speed - Math.random() * 10,
        w: 4 + Math.random() * 9,
        h: 6 + Math.random() * 12,
        color: PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        life: 1,
        decay: 0.0035 + Math.random() * 0.008,
        gravity: 0.11 + Math.random() * 0.09,
      })
    }
  }

  origins.forEach((o, idx) => spawnBurst(o, idx % 2 === 0 ? 100 : 70))

  let ticks = 0
  function frame() {
    if (!running) return
    ticks += 1
    if (ticks % 28 === 0 && ticks < 400) {
      spawnBurst(origins[Math.floor(Math.random() * origins.length)], 42)
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i]
      p.vy += p.gravity
      p.vx *= 0.992
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      p.life -= p.decay
      if (p.life <= 0 || p.y > window.innerHeight + 40) {
        particles.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.globalAlpha = Math.max(p.life, 0)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (i % 3 === 0) {
        ctx.beginPath()
        ctx.arc(0, 0, p.w / 1.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      ctx.restore()
    }

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
}

const SPOTLIGHT_TAUNT = '¿Tan fácil sos? Mira… ahora está por allá 👇😈'
const START_MOVE_TAUNT = 'Bien… ahora se mueve despacito. Tocálo 💋'

/** Mensajes al tocarlo mientras se mueve (en orden). */
const MOVING_TOUCH_TAUNTS = [
  'Como me gusta que me toques',
  'Uy que rico sigue asi',
  'Jesuscristo bolas de gorila',
]

const FINAL_WELCOME = 'Bueno, bienvenido puta, entra'

const WILD_ICONS = ['🔥', '💥', '😈', '💋', '🥵', '🍑', '🌶️', '⚡', '🌋', '✨', '💫', '🫦']

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function wildLabel(text) {
  return `🔥 ${text} 💋`
}

function clampPos(x, y) {
  const btnW = 220
  const btnH = 72
  const pad = 12
  const maxX = Math.max(pad, window.innerWidth - btnW - pad)
  const maxY = Math.max(pad, window.innerHeight - btnH - pad)
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  }
}

/** Posiciones fijas fáciles de ver (también en celu). */
function spotlightPos() {
  const w = window.innerWidth
  const h = window.innerHeight
  const spots = [
    clampPos(16, Math.min(110, h * 0.14)),
    clampPos(w - 236, Math.min(120, h * 0.16)),
    clampPos(16, h * 0.58),
    clampPos(w - 236, h * 0.52),
    clampPos(w / 2 - 110, h * 0.18),
  ]
  return pick(spots)
}

function randomButtonPos() {
  const btnW = 220
  const btnH = 72
  const pad = 16
  // Zona más central/baja: fácil con el dedo
  const minY = Math.min(window.innerHeight * 0.2, 120)
  const maxX = Math.max(pad, window.innerWidth - btnW - pad)
  const maxY = Math.max(minY, window.innerHeight - btnH - pad)
  return {
    x: pad + Math.random() * Math.max(1, maxX - pad),
    y: minY + Math.random() * Math.max(1, maxY - minY),
  }
}

function mercyPos() {
  return clampPos(window.innerWidth / 2 - 110, window.innerHeight * 0.7)
}

/** En celu (sin mouse): intervalo de movimiento suave. */
function roamIntervalMs(catchesCount) {
  if (catchesCount <= 2) return 1550
  if (catchesCount === 3) return 1150
  if (catchesCount === 4) return 850
  return 650
}

function roamTransitionSec(catchesCount) {
  if (catchesCount <= 2) return 0.55
  if (catchesCount === 3) return 0.45
  if (catchesCount === 4) return 0.38
  return 0.32
}

/** Radio de “cerca del mouse”: crece un poco con cada toque. */
function proximityRadius(catchesCount) {
  if (catchesCount <= 2) return 110
  if (catchesCount === 3) return 130
  if (catchesCount === 4) return 150
  return 170
}

function fleeCooldownMs(catchesCount) {
  if (catchesCount <= 2) return 380
  if (catchesCount === 3) return 280
  if (catchesCount === 4) return 200
  return 150
}

function hasFinePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
}

/** Huye del mouse eligiendo un punto lejos. */
function fleeFromMouse(mx, my) {
  let best = randomButtonPos()
  let bestDist = -1
  for (let i = 0; i < 10; i += 1) {
    const p = randomButtonPos()
    const d = Math.hypot(p.x + 110 - mx, p.y + 36 - my)
    if (d > bestDist) {
      best = p
      bestDist = d
    }
  }
  return best
}

export default function EmmitaWelcomeModal() {
  const { profile, isAuthenticated, loginTick } = useAuth()
  const canvasRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [catches, setCatches] = useState(0)
  const [mercy, setMercy] = useState(false)
  const [entering, setEntering] = useState(false)
  const [taunt, setTaunt] = useState('')
  const [btnPos, setBtnPos] = useState(null)
  const [roaming, setRoaming] = useState(false)
  const [musicMuted, setMusicMuted] = useState(() => isEmmitaMusicMuted())
  const papers = useMemo(() => makePapers(), [])
  const fallingTexts = useMemo(() => makeFallingTexts(), [])
  const fallingIcons = useMemo(() => makeFallingIcons(), [])
  const buttonDecor = useMemo(() => Array.from({ length: 10 }, (_, i) => WILD_ICONS[i % WILD_ICONS.length]), [])
  const btnPosRef = useRef(null)
  const catchesRef = useRef(0)
  const lastFleeRef = useRef(0)

  useEffect(() => {
    btnPosRef.current = btnPos
  }, [btnPos])

  useEffect(() => {
    catchesRef.current = catches
  }, [catches])

  useEffect(() => {
    if (!isAuthenticated || !profile?.id || profile.role !== ROLES.EMMITA) {
      setOpen(false)
      stopEmmitaMusic()
      return
    }
    const key = emmitaWelcomeSessionKey(profile.id)
    if (sessionStorage.getItem(key)) {
      setOpen(false)
      return
    }
    setPhrase(pickPhrase())
    setCatches(0)
    setMercy(false)
    setEntering(false)
    setTaunt('')
    setBtnPos(null)
    setRoaming(false)
    setOpen(true)
  }, [isAuthenticated, profile?.id, profile?.role, loginTick])

  useEffect(() => {
    if (!open) {
      stopEmmitaMusic()
      return undefined
    }
    return () => stopEmmitaMusic()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    return burstConfetti(canvasRef.current)
  }, [open])

  // Desktop: quieto hasta que el mouse se acerque → ahí huye.
  useEffect(() => {
    if (!open || !roaming || mercy || !hasFinePointer()) return undefined

    function onMove(event) {
      const pos = btnPosRef.current
      if (!pos) return
      const n = catchesRef.current
      const cx = pos.x + 110
      const cy = pos.y + 36
      const dist = Math.hypot(event.clientX - cx, event.clientY - cy)
      if (dist > proximityRadius(n)) return
      const now = Date.now()
      if (now - lastFleeRef.current < fleeCooldownMs(n)) return
      lastFleeRef.current = now
      setBtnPos(fleeFromMouse(event.clientX, event.clientY))
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [open, roaming, mercy])

  // Celu / touch: sigue moviéndose solo (no hay hover).
  useEffect(() => {
    if (!open || !roaming || mercy || hasFinePointer()) return undefined
    const id = window.setInterval(() => {
      setBtnPos(randomButtonPos())
    }, roamIntervalMs(catches))
    return () => window.clearInterval(id)
  }, [open, roaming, mercy, catches])

  useEffect(() => {
    if (mercy) softenEmmitaMusic()
  }, [mercy])

  function dismiss() {
    stopEmmitaMusic()
    if (profile?.id) sessionStorage.setItem(emmitaWelcomeSessionKey(profile.id), '1')
    setOpen(false)
  }

  function handleEnterClick(event) {
    event.preventDefault()
    event.stopPropagation()
    if (entering) return

    // Último toque ya en modo bienvenida
    if (mercy) {
      setEntering(true)
      setRoaming(false)
      setTaunt(FINAL_WELCOME)
      window.setTimeout(() => dismiss(), 900)
      return
    }

    const next = catches + 1
    setCatches(next)
    startEmmitaMusic()

    // 1) Quieto en el modal → quieto en otro lado llamando atención
    if (next === 1) {
      setTaunt(SPOTLIGHT_TAUNT)
      setBtnPos(spotlightPos())
      setRoaming(false)
      return
    }

    // 2) Tocó el spotlight → fase “chase”: quieto hasta que el mouse se acerque
    if (next === 2) {
      setTaunt(
        hasFinePointer()
          ? 'Ahora está quieto… acercá el mouse y se escapa 😈'
          : START_MOVE_TAUNT,
      )
      setBtnPos(randomButtonPos())
      setRoaming(true)
      return
    }

    // 3+) Tocques mientras se mueve
    const movingIndex = next - 3 // 0, 1, 2, ...
    if (movingIndex < MOVING_TOUCH_TAUNTS.length) {
      setTaunt(MOVING_TOUCH_TAUNTS[movingIndex])
      setBtnPos(randomButtonPos())
      setRoaming(true)
      return
    }

    // Último: bienvenida, queda quieto para entrar
    setMercy(true)
    setRoaming(false)
    setTaunt(FINAL_WELCOME)
    setBtnPos(mercyPos())
  }

  if (!open) return null

  const floating = Boolean(btnPos)
  const spotlight = floating && !roaming && !mercy && catches === 1
  // catches: 0 modal · 1 spotlight · 2+ moving (taunts) · mercy final
  const movingTouchIndex = catches - 3
  const buttonLabel = (() => {
    if (mercy) return wildLabel(FINAL_WELCOME)
    if (catches === 0) return '🔥 ¡Entrar! 💋'
    if (catches === 1) return '👆 Tocame acá'
    if (catches === 2) return '🏃 Tocame…'
    if (movingTouchIndex >= 0 && movingTouchIndex < MOVING_TOUCH_TAUNTS.length) {
      return wildLabel(MOVING_TOUCH_TAUNTS[movingTouchIndex])
    }
    return '🏃 Tocame…'
  })()

  function toggleMusic(event) {
    event.stopPropagation()
    const next = !musicMuted
    setMusicMuted(next)
    setEmmitaMusicMuted(next)
    if (!next && (floating || roaming)) startEmmitaMusic()
  }

  return (
    <div className="emmita-welcome fixed inset-0 z-[80] flex items-center justify-center overflow-hidden p-4">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <div className="emmita-welcome__glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="emmita-welcome__sparkles pointer-events-none absolute inset-0" aria-hidden />

      <button type="button" className="emmita-mute" onClick={toggleMusic} title="Música">
        {musicMuted ? '🔇' : '🔊🎵'}
      </button>

      {papers.map((p) => (
        <span
          key={p.id}
          className={`emmita-paper emmita-paper--${p.kind}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.kind === 'circle' ? p.size : p.size * 1.35,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--sway']: `${p.sway}px`,
            ['--spin']: `${p.rotate}deg`,
          }}
          aria-hidden
        />
      ))}

      {fallingIcons.map((m) => (
        <span
          key={m.id}
          className="emmita-fall-icon"
          style={{
            left: `${m.left}%`,
            fontSize: `${m.size}rem`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            ['--sway']: `${m.sway}px`,
            ['--spin']: `${m.spin}deg`,
          }}
          aria-hidden
        >
          {m.icon}
        </span>
      ))}

      {fallingTexts.map((m) => (
        <span
          key={m.id}
          className="emmita-fall-msg"
          style={{
            left: `${m.left}%`,
            color: m.color,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            fontSize: `${m.size}rem`,
            ['--sway']: `${m.sway}px`,
            ['--tilt']: `${m.rotate}deg`,
          }}
          aria-hidden
        >
          {m.text}
        </span>
      ))}

      {taunt ? (
        <div className="emmita-taunt" key={taunt}>
          {taunt}
        </div>
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bienvenida"
        className="emmita-card relative z-10 w-full max-w-lg px-5 py-8 text-center sm:px-10 sm:py-11"
      >
        <div className="emmita-card__halo" aria-hidden />
        <div className="emmita-card__icons mb-4 flex items-center justify-center gap-2 text-2xl sm:gap-3 sm:text-3xl">
          <span className="emmita-bounce" style={{ animationDelay: '0s' }}>
            💋
          </span>
          <span className="emmita-bounce" style={{ animationDelay: '0.12s' }}>
            🔥
          </span>
          <span className="emmita-bounce" style={{ animationDelay: '0.24s' }}>
            🍑
          </span>
          <span className="emmita-bounce" style={{ animationDelay: '0.36s' }}>
            😈
          </span>
          <span className="emmita-bounce" style={{ animationDelay: '0.48s' }}>
            ❤️
          </span>
        </div>

        <p className="mb-3 text-xs font-bold tracking-[0.28em] text-yellow-200 uppercase drop-shadow">
          ✨ bienvenida putita ✨
        </p>

        <h2 className="emmita-card__phrase text-2xl leading-snug font-black text-white sm:text-3xl">
          {phrase}
        </h2>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-lg">
          <span className="emmita-chip">💸 Finora</span>
          <span className="emmita-chip">🥵 Emmin</span>
          <span className="emmita-chip">👑 putita VIP</span>
        </div>

        {!floating ? (
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="emmita-btn-icons" aria-hidden>
              {buttonDecor.map((icon, i) => (
                <span key={`d-${i}`} style={{ animationDelay: `${i * 0.07}s` }}>
                  {icon}
                </span>
              ))}
            </div>
            <button type="button" onClick={handleEnterClick} className="emmita-card__cta">
              {buttonLabel}
            </button>
            <div className="emmita-btn-icons" aria-hidden>
              {buttonDecor
                .slice()
                .reverse()
                .map((icon, i) => (
                  <span key={`d2-${i}`} style={{ animationDelay: `${i * 0.07}s` }}>
                    {icon}
                  </span>
                ))}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-sm font-bold text-yellow-100">
            {mercy
              ? 'Bueno, bienvenido puta… tocá y entrás 👇'
              : spotlight
                ? 'Está quieto en otro lado… ¡mirá el brillo! ✨'
                : roaming
                  ? 'Quieto… acercá el mouse o tocálo 👇'
                  : 'Tocá el botón 👇'}
          </p>
        )}
      </div>

      {floating ? (
        <div
          className={`emmita-float ${spotlight ? 'emmita-float--spotlight' : ''} ${
            mercy ? 'emmita-float--mercy' : ''
          } ${roaming ? 'emmita-float--roam' : ''}`}
          style={{
            left: btnPos.x,
            top: btnPos.y,
            ['--roam-ms']: `${roamTransitionSec(catches)}s`,
          }}
        >
          {spotlight ? <span className="emmita-float__arrow">👇 ¡ACÁ ESTOY!</span> : null}
          {mercy ? <span className="emmita-float__arrow">👇 Entrá ya</span> : null}
          <div className="emmita-btn-icons emmita-btn-icons--mini" aria-hidden>
            {buttonDecor.slice(0, 8).map((icon, i) => (
              <span key={`fd-${i}`} style={{ animationDelay: `${i * 0.06}s` }}>
                {icon}
              </span>
            ))}
          </div>
          <button type="button" onClick={handleEnterClick} className="emmita-card__cta emmita-card__cta--touch">
            {buttonLabel}
          </button>
        </div>
      ) : null}

      <style>{`
        .emmita-welcome {
          background:
            radial-gradient(circle at 15% 20%, rgba(255, 77, 109, 0.65), transparent 42%),
            radial-gradient(circle at 85% 25%, rgba(123, 44, 191, 0.6), transparent 40%),
            radial-gradient(circle at 50% 85%, rgba(255, 214, 10, 0.28), transparent 45%),
            radial-gradient(circle at 70% 60%, rgba(0, 187, 249, 0.35), transparent 40%),
            rgba(8, 4, 20, 0.92);
          animation: emmita-bg-pulse 2.2s ease-in-out infinite alternate;
        }
        .emmita-welcome__glow {
          background:
            radial-gradient(circle at 40% 40%, rgba(255, 77, 109, 0.25), transparent 40%),
            radial-gradient(circle at 60% 55%, rgba(255, 214, 10, 0.18), transparent 45%);
          animation: emmita-glow 1.6s ease-in-out infinite alternate;
        }
        .emmita-welcome__sparkles {
          background-image:
            radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 40% 70%, rgba(255,214,10,0.9), transparent),
            radial-gradient(2px 2px at 65% 25%, rgba(255,143,171,0.9), transparent),
            radial-gradient(2px 2px at 80% 60%, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 10% 80%, rgba(199,125,255,0.9), transparent);
          animation: emmita-sparkle 1.4s steps(2, end) infinite;
        }
        .emmita-card {
          position: relative;
          overflow: hidden;
          border-radius: 2rem;
          background:
            linear-gradient(145deg, rgba(255, 45, 100, 0.96), rgba(140, 30, 200, 0.97) 50%, rgba(255, 110, 30, 0.94));
          border: 3px solid rgba(255, 255, 255, 0.35);
          box-shadow:
            0 0 0 6px rgba(255, 214, 10, 0.18),
            0 28px 90px rgba(0, 0, 0, 0.5),
            0 0 80px rgba(255, 77, 109, 0.55);
          animation: emmita-pop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .emmita-card__halo {
          position: absolute;
          inset: -40%;
          background: conic-gradient(from 0deg, #ff4d6d, #ffd60a, #7b2cbf, #00bbf9, #ff4d6d);
          opacity: 0.18;
          animation: emmita-spin 6s linear infinite;
          pointer-events: none;
        }
        .emmita-card__phrase {
          position: relative;
          text-shadow: 0 3px 0 rgba(0, 0, 0, 0.28), 0 0 28px rgba(255, 255, 255, 0.25);
          animation: emmita-wiggle 1.5s ease-in-out infinite;
        }
        .emmita-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: 999px;
          padding: 0.35rem 0.75rem;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 700;
          backdrop-filter: blur(4px);
        }
        .emmita-card__cta {
          position: relative;
          z-index: 1;
          min-width: 12rem;
          padding: 1rem 1.75rem;
          border-radius: 999px;
          border: 3px solid #111827;
          background: linear-gradient(180deg, #ffe566, #ffd60a);
          color: #111827;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 7px 0 #111827, 0 14px 30px rgba(0, 0, 0, 0.4);
          animation: emmita-cta 1.1s ease-in-out infinite;
        }
        .emmita-card__cta:hover {
          background: linear-gradient(180deg, #fff3a0, #ffde3a);
        }
        .emmita-card__cta:active {
          transform: translateY(4px);
          box-shadow: 0 3px 0 #111827, 0 8px 18px rgba(0, 0, 0, 0.3);
        }
        .emmita-card__cta--touch {
          min-width: min(18rem, 86vw);
          max-width: min(20rem, 90vw);
          min-height: 3.25rem;
          padding: 0.85rem 1.1rem;
          font-size: clamp(0.85rem, 3.6vw, 1.05rem);
          line-height: 1.2;
          white-space: normal;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .emmita-btn-icons {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.2rem 0.35rem;
          font-size: 1.15rem;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35));
        }
        .emmita-btn-icons span {
          display: inline-block;
          animation: emmita-bounce 0.9s ease-in-out infinite;
        }
        .emmita-btn-icons--mini {
          font-size: 1rem;
          margin-bottom: 0.1rem;
        }
        .emmita-float {
          position: fixed;
          z-index: 90;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          transition: left 0.7s ease-out, top 0.7s ease-out;
        }
        .emmita-float--roam {
          transition:
            left var(--roam-ms, 0.85s) ease-in-out,
            top var(--roam-ms, 0.85s) ease-in-out;
        }
        .emmita-float--spotlight {
          animation: emmita-spotlight-pulse 0.9s ease-in-out infinite;
        }
        .emmita-float--spotlight .emmita-card__cta {
          box-shadow:
            0 7px 0 #111827,
            0 0 0 6px rgba(255, 214, 10, 0.55),
            0 0 28px rgba(255, 77, 109, 0.85);
        }
        .emmita-float--mercy .emmita-card__cta {
          box-shadow:
            0 7px 0 #111827,
            0 0 0 5px rgba(128, 255, 219, 0.5),
            0 14px 30px rgba(0, 0, 0, 0.35);
        }
        .emmita-float__arrow {
          padding: 0.25rem 0.65rem;
          border-radius: 999px;
          border: 2px solid #111827;
          background: #fff;
          color: #111827;
          font-size: 0.78rem;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 3px 0 #111827;
          animation: emmita-bounce 0.8s ease-in-out infinite;
        }
        @keyframes emmita-spotlight-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .emmita-taunt {
          position: fixed;
          top: 1.25rem;
          left: 50%;
          z-index: 95;
          max-width: min(92vw, 28rem);
          transform: translateX(-50%);
          padding: 0.85rem 1.1rem;
          border-radius: 1rem;
          border: 3px solid #111827;
          background: linear-gradient(135deg, #ffe566, #ff8fab);
          color: #111827;
          font-weight: 900;
          font-size: 1rem;
          text-align: center;
          box-shadow: 0 8px 0 #111827, 0 16px 40px rgba(0,0,0,0.35);
          animation: emmita-taunt-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .emmita-mute {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 96;
          border: 3px solid #111827;
          border-radius: 999px;
          background: #ffe566;
          color: #111827;
          font-size: 1.1rem;
          padding: 0.45rem 0.7rem;
          cursor: pointer;
          box-shadow: 0 4px 0 #111827;
        }
        @keyframes emmita-fugitive-wiggle {
          0%, 100% { rotate: -2deg; }
          50% { rotate: 2deg; }
        }
        @keyframes emmita-taunt-pop {
          from { transform: translateX(-50%) scale(0.6); opacity: 0; }
          to { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        .emmita-bounce {
          display: inline-block;
          animation: emmita-bounce 1s ease-in-out infinite;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
        }
        .emmita-paper {
          position: absolute;
          top: -40px;
          z-index: 1;
          pointer-events: none;
          opacity: 0.95;
          animation-name: emmita-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .emmita-paper--rect { border-radius: 2px; }
        .emmita-paper--circle { border-radius: 999px; }
        .emmita-fall-msg {
          position: absolute;
          top: -12vh;
          z-index: 2;
          max-width: min(74vw, 17rem);
          pointer-events: none;
          font-weight: 900;
          line-height: 1.15;
          text-align: center;
          text-shadow:
            0 2px 0 rgba(0, 0, 0, 0.6),
            0 0 14px rgba(0, 0, 0, 0.4);
          white-space: normal;
          animation-name: emmita-msg-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .emmita-fall-icon {
          position: absolute;
          top: -10vh;
          z-index: 2;
          pointer-events: none;
          filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));
          animation-name: emmita-icon-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes emmita-fall {
          0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translate3d(var(--sway), 115vh, 0) rotate(720deg); opacity: 0.9; }
        }
        @keyframes emmita-msg-fall {
          0% {
            transform: translate3d(0, -8vh, 0) rotate(calc(var(--tilt) * -1)) scale(0.85);
            opacity: 0;
          }
          6% { opacity: 1; }
          85% { opacity: 1; }
          100% {
            transform: translate3d(var(--sway), 118vh, 0) rotate(var(--tilt)) scale(1.05);
            opacity: 0;
          }
        }
        @keyframes emmita-icon-fall {
          0% {
            transform: translate3d(0, -8vh, 0) rotate(0deg) scale(0.7);
            opacity: 0;
          }
          8% { opacity: 1; }
          100% {
            transform: translate3d(var(--sway), 120vh, 0) rotate(var(--spin)) scale(1.15);
            opacity: 0.85;
          }
        }
        @keyframes emmita-pop {
          from { transform: scale(0.5) rotate(-5deg); opacity: 0; }
          to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes emmita-wiggle {
          0%, 100% { transform: rotate(-1.4deg) scale(1); }
          50% { transform: rotate(1.6deg) scale(1.035); }
        }
        @keyframes emmita-cta {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes emmita-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.12); }
        }
        @keyframes emmita-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes emmita-bg-pulse {
          from { filter: saturate(1.05) brightness(1); }
          to { filter: saturate(1.3) brightness(1.08); }
        }
        @keyframes emmita-glow {
          from { opacity: 0.5; transform: scale(1); }
          to { opacity: 1; transform: scale(1.1); }
        }
        @keyframes emmita-sparkle {
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
