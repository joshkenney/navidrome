import React, { useRef } from 'react'
import { modelOf } from './skins'

// Draws an iPod's front, in millimetres, from its model and materials (see skins.js): the steel rim
// and plastic or aluminium front, the screen's glass, and the wheel, its buttons and labels. The
// screen's content and the controls' touch areas are drawn over it in HTML, at the same places

let ids = 0

// ⏮ and ⏭: a bar and two triangles, "s" millimetres high, each "wide" times as wide
const skipPath = (cx, cy, s, forward, wide = 0.5) => {
  const h = s / 2
  const t = s * wide // a triangle's width
  const dir = forward ? 1 : -1
  const x0 = cx - dir * t
  const bar = forward ? cx + t : cx - t - s * 0.12
  return [
    `M${x0} ${cy - h} L${x0 + dir * t} ${cy} L${x0} ${cy + h} Z`,
    `M${cx} ${cy - h} L${cx + dir * t} ${cy} L${cx} ${cy + h} Z`,
    `M${bar} ${cy - h} h${s * 0.12} v${s} h${-s * 0.12} Z`,
  ].join(' ')
}

// ▶❚❚
const playPausePath = (cx, cy, s) => {
  const h = s / 2
  const x = cx - s * 0.95
  return [
    `M${x} ${cy - h} L${x + s * 0.75} ${cy} L${x} ${cy + h} Z`,
    `M${cx + s * 0.1} ${cy - h} h${s * 0.22} v${s} h${-s * 0.22} Z`,
    `M${cx + s * 0.5} ${cy - h} h${s * 0.22} v${s} h${-s * 0.22} Z`,
  ].join(' ')
}

// An arc round (cx, cy), "r" from it, from one angle to another (degrees, clockwise from the top)
const arcPath = (cx, cy, r, from, to) => {
  const at = (deg) => {
    const a = (deg * Math.PI) / 180
    return `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`
  }
  return `M${at(from)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`
}

// "glyph": how high the arrows are, against the text; "wide": how wide the arrows' triangles are;
// "spread": how widely ▶❚❚ is spread
const Labels = ({
  cx,
  cy,
  r,
  color,
  size,
  lower,
  filter,
  glyph = 0.85,
  wide = 0.5,
  spread = 1,
}) => (
  <g fill={color} filter={filter}>
    <text
      x={cx}
      y={cy - r}
      fontSize={size * (lower ? 1.15 : 1)}
      fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
      fontWeight={700}
      letterSpacing={lower ? 0 : size * 0.06}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {lower ? 'menu' : 'MENU'}
    </text>
    <path d={skipPath(cx - r, cy, size * glyph, false, wide)} />
    <path d={skipPath(cx + r, cy, size * glyph, true, wide)} />
    <path
      d={playPausePath(cx, cy + r, size * glyph)}
      transform={`translate(${cx} 0) scale(${spread} 1) translate(${-cx} 0)`}
    />
  </g>
)

// A button or wheel sunk into the front (the 3rd generation's): in shadow inside its top left
// edge, lit inside its bottom right, a fine line where it meets the front
const Well = ({ id, u, cx, cy, r, fill, plain }) => (
  <g>
    <clipPath id={id}>
      <circle cx={cx} cy={cy} r={r} />
    </clipPath>
    <circle cx={cx} cy={cy} r={r} fill={fill} />
    {!plain && (
      <g clipPath={`url(#${id})`} fill="none">
        <circle
          cx={cx + 0.35}
          cy={cy + 0.45}
          r={r}
          stroke="rgba(60,66,64,0.32)"
          strokeWidth="1.3"
          filter={`url(#${u('wellShade')})`}
        />
        <circle
          cx={cx - 0.25}
          cy={cy - 0.3}
          r={r}
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="0.55"
          filter={`url(#${u('wellLight')})`}
        />
      </g>
    )}
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke="rgba(70,76,74,0.35)"
      strokeWidth="0.14"
    />
    {/* The front's edge round it, catching the light at the bottom right */}
    <circle
      cx={cx + 0.1}
      cy={cy + 0.12}
      r={r + 0.2}
      fill="none"
      stroke="#ffffff"
      strokeOpacity="0.55"
      strokeWidth="0.25"
    />
  </g>
)

// "lit": whether the backlight is on, which lit the 3rd generation's buttons too. "plain": without
// its filters (grain, soft light and shadow), quick to draw, while the whole of it is being drawn
// (see bodyPicture)
export const IpodBody = ({
  skin,
  lit = true,
  plain = false,
  className,
  style,
}) => {
  const id = useRef(null)
  if (id.current === null) id.current = `ipod${++ids}`
  const u = (name) => `${id.current}-${name}`
  const m = modelOf(skin)
  const f = skin.face
  // The 1st and 2nd generation, drawn after Apple's 25th-anniversary iPod: a polished chrome rim
  const chrome = skin.rim === 'chrome'
  // The 5th generation's and the classics': only a fine, dark edge shows
  const thin = skin.rim === 'thin'
  const rim = chrome ? 0.75 : thin ? 0.35 : skin.rim ? 0.55 : 0
  const face = { x: rim, y: rim, w: m.w - 2 * rim, h: m.h - 2 * rim }
  const dark = f.kind === 'plastic' && parseInt(f.top.slice(1, 3), 16) < 0x80
  const satin = f.kind === 'aluminium' && f.finish === 'satin'
  // Bead-blasted aluminium: the classic's front and the mini's tube, with no brushed streaks
  const blasted = satin || (f.kind === 'aluminium' && skin.tube)
  // The 3rd generation's thick plastic, rounding away at its edges, its wheel and buttons sunk in
  const rounded = f.kind === 'plastic' && f.rounded
  const sunken = skin.wheel.sunken
  const reflection = f.reflection
  const rowLit = !skin.row?.unlitLabel || lit
  const wheel = m.wheel
  const r = wheel.d / 2

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${m.w} ${m.h}`}
      width="100%"
      height="100%"
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* The polished steel back, showing round the front */}
        <linearGradient id={u('steel')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbfbfc" />
          <stop offset="0.3" stopColor="#a9acb2" />
          <stop offset="0.5" stopColor="#f1f2f3" />
          <stop offset="0.75" stopColor="#8c8f95" />
          <stop offset="1" stopColor="#d9dbde" />
        </linearGradient>
        {f.kind === 'plastic' && !f.diagonal && !rounded && (
          <linearGradient id={u('face')} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={f.top} />
            <stop offset="1" stopColor={f.bottom} />
          </linearGradient>
        )}
        {f.kind === 'plastic' && f.diagonal && (
          // Greying from the top right to the bottom left
          <linearGradient id={u('face')} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={f.bottom} />
            <stop offset="1" stopColor={f.top} />
          </linearGradient>
        )}
        {rounded && (
          // Lit from the left: darkening across to the right, and a little down
          <linearGradient id={u('face')} x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0" stopColor={f.top} />
            <stop offset="0.5" stopColor={f.top} />
            <stop offset="1" stopColor={f.bottom} />
          </linearGradient>
        )}
        {rounded && (
          // Its edges, rounding away into shadow: the right, the bottom, a little at the top
          <>
            <linearGradient id={u('edgeRight')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1e2422" stopOpacity="0" />
              <stop offset="0.33" stopColor="#1e2422" stopOpacity="0.08" />
              <stop offset="0.67" stopColor="#1e2422" stopOpacity="0.26" />
              <stop offset="1" stopColor="#1e2422" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id={u('edgeBottom')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e2422" stopOpacity="0" />
              <stop offset="0.5" stopColor="#1e2422" stopOpacity="0.08" />
              <stop offset="0.75" stopColor="#1e2422" stopOpacity="0.2" />
              <stop offset="1" stopColor="#1e2422" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id={u('edgeTop')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e2422" stopOpacity="0.3" />
              <stop offset="1" stopColor="#1e2422" stopOpacity="0" />
            </linearGradient>
            <filter id={u('shine')} x="-20%" y="-5%" width="140%" height="110%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </>
        )}
        {sunken && (
          <>
            <filter
              id={u('wellShade')}
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
              <feGaussianBlur stdDeviation="0.35" />
            </filter>
            <filter
              id={u('wellLight')}
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
              <feGaussianBlur stdDeviation="0.15" />
            </filter>
          </>
        )}
        {thin && (
          // The steel edge, mirroring the room: lighter at the top, dark at the bottom
          <linearGradient id={u('thinRim')} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" stopColor="#b4b6b8" />
            <stop offset="0.5" stopColor="#6e7174" />
            <stop offset="1" stopColor="#2e3033" />
          </linearGradient>
        )}
        {reflection && (
          <linearGradient
            id={u('reflection')}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={m.h}
          >
            {reflection.map(([offset, color, opacity]) => (
              <stop
                key={offset}
                offset={offset}
                stopColor={color}
                stopOpacity={opacity}
              />
            ))}
          </linearGradient>
        )}
        {satin && (
          // The metal darkening softly as its edges round off
          <filter id={u('edgeSoft')} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        )}
        {chrome && (
          // Polished chrome: bands of light and dark all round, mirroring the room
          <linearGradient id={u('chrome')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7f7f8" />
            <stop offset="0.18" stopColor="#b7b8bb" />
            <stop offset="0.34" stopColor="#ececed" />
            <stop offset="0.5" stopColor="#8e8f93" />
            <stop offset="0.66" stopColor="#d8d9db" />
            <stop offset="0.84" stopColor="#9a9b9f" />
            <stop offset="1" stopColor="#e2e3e5" />
          </linearGradient>
        )}
        {chrome && (
          // And the sharp streaks of light across it
          <linearGradient
            id={u('chromeStreaks')}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientTransform="rotate(-23 0.5 0.5)"
          >
            <stop offset="0.2" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="0.25" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.44" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.73" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.76" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="0.79" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        )}
        {chrome && (
          // The plastic's edge, rounding over: lit at the top left, shaded at the bottom right
          <linearGradient id={u('plasticEdge')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="1" stopColor="#8a8a8a" stopOpacity="0.55" />
          </linearGradient>
        )}
        {skin.wheel.textured && (
          // The scroll wheel's fine grain
          <filter id={u('wheelGrain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="5"
              numOctaves="1"
              seed="11"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0.55 -0.24"
            />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        )}
        {skin.ring?.raised && (
          // Soft light and shadow
          <filter id={u('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        )}
        {satin && (
          // Anodized aluminium, as in Apple's photos: darkening steadily from the top to the bottom
          <linearGradient id={u('face')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={f.light} />
            <stop offset="0.5" stopColor={f.base} />
            <stop offset="1" stopColor={f.dark} />
          </linearGradient>
        )}
        {satin && (
          // A soft light from above the top left, spread across the matte metal
          <radialGradient
            id={u('sheen')}
            cx="0.28"
            cy="0.08"
            r="0.95"
            gradientTransform="translate(0.28 0.08) scale(1 0.6) translate(-0.28 -0.08)"
          >
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        )}
        {satin && (
          // Its bevelled edge, cut through the anodizing: catching the light at the top, in shadow
          // at the bottom
          <linearGradient id={u('chamfer')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.06" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#000000" stopOpacity="0.08" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>
        )}
        {blasted && (
          // The bead-blasted anodizing's fine, even grain, light and dark specks
          <filter id={u('grain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="3"
              numOctaves="2"
              seed="3"
            />
            <feColorMatrix
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
            />
          </filter>
        )}
        {f.kind === 'aluminium' && !skin.tube && !satin && (
          <linearGradient id={u('face')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={f.light} />
            <stop offset="0.45" stopColor={f.base} />
            <stop offset="0.6" stopColor={f.light} stopOpacity="0.9" />
            <stop offset="1" stopColor={f.dark} />
          </linearGradient>
        )}
        {f.kind === 'aluminium' && skin.tube && (
          // The mini's aluminium tube, seen from the front: flat across, curving away only at the
          // sides, a little lighter where the left side turns to the light, darker at the right
          <linearGradient id={u('face')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={f.dark} stopOpacity="0.8" />
            <stop offset="0.02" stopColor={f.base} />
            <stop offset="0.05" stopColor={f.light} stopOpacity="0.4" />
            <stop offset="0.11" stopColor={f.base} />
            <stop offset="0.9" stopColor={f.base} />
            <stop offset="0.975" stopColor={f.dark} stopOpacity="0.45" />
            <stop offset="1" stopColor={f.dark} stopOpacity="0.85" />
          </linearGradient>
        )}
        {/* Brushed metal: fine horizontal streaks */}
        <filter id={u('brushed')} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 2.4"
            numOctaves="2"
            seed="7"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.12"
          />
        </filter>
        {/* The front's shine: a glossy band, or on the anniversary's plastic a soft sheen */}
        <linearGradient id={u('gloss')} x1="0" y1="0" x2="0.9" y2="0.7">
          <stop
            offset="0"
            stopColor="#ffffff"
            stopOpacity={chrome ? 0.45 : dark ? 0.32 : 0.7}
          />
          <stop
            offset={chrome ? 0.45 : 0.38}
            stopColor="#ffffff"
            stopOpacity={chrome ? 0.06 : dark ? 0.08 : 0.15}
          />
          <stop
            offset={chrome ? 0.55 : 0.39}
            stopColor="#ffffff"
            stopOpacity="0"
          />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {skin.wheel.border ? (
          // Lit from far off at the top right
          <radialGradient id={u('wheel')} cx="1.3" cy="-1" r="2.2">
            <stop offset="0.45" stopColor={skin.wheel.surface[0]} />
            <stop offset="1" stopColor={skin.wheel.surface[1]} />
          </radialGradient>
        ) : (
          <radialGradient id={u('wheel')} cx="0.5" cy="0.45" r="0.55">
            <stop offset="0.3" stopColor={skin.wheel.surface[0]} />
            <stop offset="1" stopColor={skin.wheel.surface[1]} />
          </radialGradient>
        )}
        {/* The centre button, slightly domed (the anniversary's: shaded from the bottom left; the
            classics': dished, in shadow at the top) */}
        {skin.wheel.dished ? (
          <linearGradient id={u('center')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skin.wheel.center[1]} />
            <stop offset="1" stopColor={skin.wheel.center[0]} />
          </linearGradient>
        ) : skin.wheel.border ? (
          <radialGradient id={u('center')} cx="-0.09" cy="2.09" r="2.3">
            <stop offset="0" stopColor={skin.wheel.center[1]} />
            <stop offset="0.75" stopColor={skin.wheel.center[0]} />
          </radialGradient>
        ) : (
          <radialGradient
            id={u('center')}
            cx="0.5"
            cy="0.5"
            fx="0.5"
            fy="0.28"
            r="0.6"
          >
            <stop offset="0" stopColor={skin.wheel.center[0]} />
            <stop offset="1" stopColor={skin.wheel.center[1]} />
          </radialGradient>
        )}
        {skin.ring && (
          <radialGradient id={u('ring')} cx="0.5" cy="0.4" r="0.6">
            <stop offset="0.6" stopColor={skin.ring.surface[0]} />
            <stop offset="1" stopColor={skin.ring.surface[1]} />
          </radialGradient>
        )}
        {skin.row && (
          <radialGradient id={u('rowButton')} cx="0.5" cy="0.35" r="0.65">
            <stop offset="0" stopColor={skin.row.surface[0]} />
            <stop offset="1" stopColor={skin.row.surface[1]} />
          </radialGradient>
        )}
        {/* The 3rd generation's lit buttons */}
        <filter id={u('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Inside the transparent iPod: the circuit board's traces */}
        <pattern
          id={u('traces')}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 1.5 H3.5 L5 3 H6 M1 6 V4 L2.5 2.5 M4.5 0 V1.2"
            stroke="#c9a54a"
            strokeWidth="0.18"
            fill="none"
            opacity="0.75"
          />
          <circle cx="3.5" cy="1.5" r="0.3" fill="#d9b860" opacity="0.8" />
        </pattern>
        <linearGradient id={u('drive')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4e6e9" />
          <stop offset="0.5" stopColor="#b9bcc2" />
          <stop offset="1" stopColor="#d6d8dc" />
        </linearGradient>
        <linearGradient id={u('battery')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#474a52" />
          <stop offset="1" stopColor="#2e3036" />
        </linearGradient>
        <clipPath id={u('faceClip')}>
          <rect
            x={face.x}
            y={face.y}
            width={face.w}
            height={face.h}
            rx={m.r - rim}
          />
        </clipPath>
      </defs>

      {/* The body */}
      {skin.rim && (
        <rect
          width={m.w}
          height={m.h}
          rx={m.r}
          fill={`url(#${u(chrome ? 'chrome' : thin ? 'thinRim' : 'steel')})`}
        />
      )}
      {chrome && (
        <rect
          width={m.w}
          height={m.h}
          rx={m.r}
          fill={`url(#${u('chromeStreaks')})`}
        />
      )}
      <g clipPath={`url(#${u('faceClip')})`}>
        {f.kind === 'clear' ? (
          <>
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height={face.h}
              fill="#1a5536"
            />
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height={face.h}
              fill={`url(#${u('traces')})`}
            />
            {/* The hard drive, just behind the screen: its edges show round the glass */}
            <rect
              x={m.window.x - 1.2}
              y={m.window.y - 1}
              width={m.window.w + 2.4}
              height={m.window.h + 2}
              rx="1.6"
              fill={`url(#${u('drive')})`}
              stroke="#7d8188"
              strokeWidth="0.25"
            />
            {/* The battery, behind the wheel, with its label */}
            <rect
              x={face.x + 5}
              y={m.wheel.cy - m.wheel.d / 2 - 2}
              width={face.w - 10}
              height={m.h - (m.wheel.cy - m.wheel.d / 2) - 2.5}
              rx="2"
              fill={`url(#${u('battery')})`}
            />
            <rect
              x={face.x + 8}
              y={m.h - 9}
              width={face.w - 16}
              height="3.2"
              rx="0.5"
              fill="#e9eaec"
              opacity="0.75"
            />
            {/* Chips on the board between the screen and the wheel */}
            <rect
              x="4"
              y={m.window.y + m.window.h + 2}
              width="6.5"
              height="4"
              rx="0.3"
              fill="#121214"
            />
            <rect
              x={m.w - 12}
              y={m.window.y + m.window.h + 1.6}
              width="5.5"
              height="5.5"
              rx="0.3"
              fill="#121214"
            />
            <rect
              x={m.w / 2 + 5}
              y={m.window.y + m.window.h + 2.6}
              width="3"
              height="2"
              fill="#8a6a2c"
            />
            {/* The click wheel's flex cable */}
            <rect
              x={m.w / 2 - 1.8}
              y={m.window.y + m.window.h + 0.5}
              width="3.6"
              height={m.wheel.cy - m.wheel.d / 2 - (m.window.y + m.window.h)}
              fill="#d08a34"
              opacity="0.92"
            />
            {/* The clear acrylic over it all */}
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height={face.h}
              fill="#ffffff"
              opacity="0.1"
            />
          </>
        ) : (
          <>
            {f.kind === 'aluminium' && (
              // The metal's own colour, under its shading
              <rect
                x={face.x}
                y={face.y}
                width={face.w}
                height={face.h}
                fill={f.base}
              />
            )}
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height={face.h}
              fill={`url(#${u('face')})`}
            />
          </>
        )}
        {f.kind === 'aluminium' && !blasted && !plain && (
          <rect
            x={face.x}
            y={face.y}
            width={face.w}
            height={face.h}
            filter={`url(#${u('brushed')})`}
            opacity="0.5"
          />
        )}
        {blasted && !plain && (
          <rect
            x={face.x}
            y={face.y}
            width={face.w}
            height={face.h}
            filter={`url(#${u('grain')})`}
            style={{ mixBlendMode: 'overlay' }}
            opacity={satin ? 0.38 : 0.3}
          />
        )}
        {satin && (
          <rect
            x={face.x}
            y={face.y}
            width={face.w}
            height={face.h}
            fill={`url(#${u('sheen')})`}
          />
        )}
        {satin && !plain && (
          <rect
            x={face.x}
            y={face.y}
            width={face.w}
            height={face.h}
            rx={m.r - rim}
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="3"
            filter={`url(#${u('edgeSoft')})`}
          />
        )}
        {reflection && (
          <polygon
            points={`${m.w * 0.162} 0 ${m.w} 0 ${m.w} ${m.h * 0.953}`}
            fill={`url(#${u('reflection')})`}
          />
        )}
        {rounded && (
          <>
            <rect
              x={face.x + face.w - 6}
              y={face.y}
              width="6"
              height={face.h}
              fill={`url(#${u('edgeRight')})`}
            />
            <rect
              x={face.x}
              y={face.y + face.h - 5.5}
              width={face.w}
              height="5.5"
              fill={`url(#${u('edgeBottom')})`}
            />
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height="1"
              fill={`url(#${u('edgeTop')})`}
            />
            {/* The light running down its rounded left edge and round the bottom corner */}
            {!plain && (
              <path
                d={`M2.6 14 V${face.h - m.r} A${m.r - 2.6} ${m.r - 2.6} 0 0 0 ${m.r} ${face.h - 2.6} H9`}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.55"
                strokeWidth="1.6"
                strokeLinecap="round"
                filter={`url(#${u('shine')})`}
              />
            )}
          </>
        )}
        {(f.kind === 'plastic' || f.kind === 'clear') &&
          !rounded &&
          !reflection && (
            <rect
              x={face.x}
              y={face.y}
              width={face.w}
              height={face.h}
              fill={`url(#${u('gloss')})`}
            />
          )}
      </g>
      {/* The front's edge catching the light */}
      {satin && (
        // Where the front meets the steel back: a hairline of shadow
        <rect
          x={face.x}
          y={face.y}
          width={face.w}
          height={face.h}
          rx={m.r - rim}
          fill="none"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="0.18"
        />
      )}
      <rect
        x={face.x + (satin ? 0.4 : rounded ? 0.1 : 0.15)}
        y={face.y + (satin ? 0.4 : rounded ? 0.1 : 0.15)}
        width={face.w - (satin ? 0.8 : rounded ? 0.2 : 0.3)}
        height={face.h - (satin ? 0.8 : rounded ? 0.2 : 0.3)}
        rx={m.r - rim - (satin ? 0.4 : rounded ? 0.1 : 0.15)}
        fill="none"
        stroke={
          satin
            ? `url(#${u('chamfer')})`
            : chrome
              ? `url(#${u('plasticEdge')})`
              : rounded
                ? 'rgba(40,44,43,0.35)'
                : skin.tube
                  ? 'rgba(255,255,255,0.2)'
                  : dark
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(255,255,255,0.75)'
        }
        strokeWidth={satin ? 0.4 : chrome ? 0.5 : thin ? 0.18 : 0.3}
      />
      {chrome && (
        // Where the plastic meets the chrome: a hairline of shadow and one of white
        <rect
          x={face.x}
          y={face.y}
          width={face.w}
          height={face.h}
          rx={m.r - rim}
          fill="none"
          stroke="rgba(110,110,110,0.55)"
          strokeWidth="0.12"
        />
      )}

      {thin && (
        // The cut edge round the screen's glass, catching the light
        <rect
          x={m.window.x - 0.12}
          y={m.window.y - 0.12}
          width={m.window.w + 0.24}
          height={m.window.h + 0.24}
          rx={m.window.r + 0.12}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={
            dark || (satin && parseInt(f.base.slice(1, 3), 16) < 0x80)
              ? 0.45
              : 0.95
          }
          strokeWidth="0.2"
        />
      )}
      {/* The screen's glass */}
      <rect
        x={m.window.x}
        y={m.window.y}
        width={m.window.w}
        height={m.window.h}
        rx={m.window.r}
        fill={skin.windowFrame}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.2"
      />
      {chrome && (
        // The frame's inner edge, catching the light
        <rect
          x={m.window.x + 0.35}
          y={m.window.y + 0.35}
          width={m.window.w - 0.7}
          height={m.window.h - 0.7}
          rx={Math.max(0, m.window.r - 0.35)}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="0.25"
        />
      )}

      {/* The 1st and 2nd generation's ring of buttons around the wheel */}
      {m.controls === 'ring' && (
        <>
          {skin.ring.raised && !plain && (
            // Raised off the front: its shadow, down and to the left
            <circle
              cx={m.ring.cx - 0.4}
              cy={m.ring.cy + 0.6}
              r={m.ring.d / 2 + 0.2}
              fill="rgba(0,0,0,0.16)"
              filter={`url(#${u('soft')})`}
            />
          )}
          <circle
            cx={m.ring.cx}
            cy={m.ring.cy}
            r={m.ring.d / 2}
            fill={`url(#${u('ring')})`}
            stroke={
              skin.ring.raised ? 'rgba(135,135,135,0.4)' : 'rgba(0,0,0,0.16)'
            }
            strokeWidth="0.3"
          />
          {skin.ring.raised && !plain && (
            // The light caught on its rounded top, at the upper right and lower left
            <g
              fill="none"
              stroke="#ffffff"
              strokeWidth={(m.ring.d / 2 - r) * 0.45}
              strokeLinecap="round"
              opacity="0.9"
              filter={`url(#${u('soft')})`}
            >
              <path
                d={arcPath(
                  m.ring.cx,
                  m.ring.cy,
                  (m.ring.d / 2 + r) / 2,
                  45,
                  90,
                )}
              />
              <path
                d={arcPath(
                  m.ring.cx,
                  m.ring.cy,
                  (m.ring.d / 2 + r) / 2,
                  225,
                  268,
                )}
              />
            </g>
          )}
          {[45, 135, 225, 315].map((deg) => {
            const a = (deg * Math.PI) / 180
            const r0 = r + 0.6
            const r1 = m.ring.d / 2
            const line = (offset, stroke, width) => (
              <line
                x1={m.ring.cx + Math.cos(a) * r0 + offset}
                y1={m.ring.cy + Math.sin(a) * r0 + offset}
                x2={m.ring.cx + Math.cos(a) * r1 + offset}
                y2={m.ring.cy + Math.sin(a) * r1 + offset}
                stroke={stroke}
                strokeWidth={width}
              />
            )
            return (
              <g key={deg}>
                {line(0, 'rgba(0,0,0,0.22)', 0.35)}
                {/* Each groove's lit edge */}
                {skin.ring.raised && line(0.25, 'rgba(255,255,255,0.9)', 0.2)}
              </g>
            )
          })}
          <Labels
            cx={m.ring.cx}
            cy={m.ring.cy}
            r={(m.ring.d / 2 + r) / 2}
            color={skin.ring.label}
            size={2.2}
            lower={skin.ring.lower}
          />
        </>
      )}

      {/* The 3rd generation's lit buttons */}
      {m.controls === 'row' &&
        m.row.xs.map((x, i) => (
          <g key={x}>
            {sunken ? (
              <Well
                id={u(`row${i}`)}
                u={u}
                plain={plain}
                cx={x}
                cy={m.row.cy}
                r={m.row.d / 2}
                fill={`url(#${u('rowButton')})`}
              />
            ) : (
              <circle
                cx={x}
                cy={m.row.cy}
                r={m.row.d / 2}
                fill={`url(#${u('rowButton')})`}
                stroke="rgba(0,0,0,0.18)"
                strokeWidth="0.3"
              />
            )}
            <g
              fill={rowLit ? skin.row.label : skin.row.unlitLabel}
              filter={
                rowLit && skin.row.glow && !plain
                  ? `url(#${u('glow')})`
                  : undefined
              }
              data-lit={rowLit ? 'true' : 'false'}
              style={{ transition: 'fill 400ms ease-out' }}
            >
              {i === 0 && <path d={skipPath(x, m.row.cy, 1.6, false, 0.85)} />}
              {i === 1 && (
                <text
                  x={x}
                  y={m.row.cy}
                  fontSize="1.95"
                  fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  MENU
                </text>
              )}
              {i === 2 && <path d={playPausePath(x, m.row.cy, 1.7)} />}
              {i === 3 && <path d={skipPath(x, m.row.cy, 1.6, true, 0.85)} />}
            </g>
          </g>
        ))}

      {/* The wheel */}
      {skin.wheel.border && (
        // Set into the ring: its shadow, up and to the right
        <circle
          cx={wheel.cx + 0.4}
          cy={wheel.cy - 0.5}
          r={r}
          fill="rgba(122,122,122,0.6)"
          filter={
            skin.ring?.raised && !plain ? `url(#${u('soft')})` : undefined
          }
        />
      )}
      {sunken ? (
        <>
          <Well
            id={u('wheelWell')}
            u={u}
            plain={plain}
            cx={wheel.cx}
            cy={wheel.cy}
            r={r}
            fill={`url(#${u('wheel')})`}
          />
          {/* The touch wheel's edge, just inside */}
          <circle
            cx={wheel.cx}
            cy={wheel.cy}
            r={r - 0.6}
            fill="none"
            stroke="rgba(70,76,74,0.16)"
            strokeWidth="0.14"
          />
        </>
      ) : (
        <circle
          cx={wheel.cx}
          cy={wheel.cy}
          r={r}
          fill={`url(#${u('wheel')})`}
          stroke={
            skin.wheel.border ||
            (m.controls === 'ring' ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.12)')
          }
          strokeWidth={
            skin.wheel.border ? 0.35 : m.controls === 'ring' ? 0.45 : 0.25
          }
        />
      )}
      {skin.wheel.textured && !plain && (
        <circle
          cx={wheel.cx}
          cy={wheel.cy}
          r={r - 0.2}
          fill="#ffffff"
          filter={`url(#${u('wheelGrain')})`}
        />
      )}
      {skin.wheel.border && (
        // A light line just inside its border
        <circle
          cx={wheel.cx}
          cy={wheel.cy}
          r={r - 0.35}
          fill="none"
          stroke="rgba(249,249,249,0.6)"
          strokeWidth="0.3"
        />
      )}
      {/* Its rim, a little shadowed at the top, lit at the bottom: it is set into the front */}
      {!sunken && !thin && (
        <circle
          cx={wheel.cx}
          cy={wheel.cy}
          r={r - 0.25}
          fill="none"
          stroke="rgba(0,0,0,0.07)"
          strokeWidth="0.5"
          strokeDasharray={`${Math.PI * r} ${Math.PI * r}`}
          transform={`rotate(180 ${wheel.cx} ${wheel.cy})`}
        />
      )}
      {m.controls === 'click' && (
        // As in Apple's photos: near the wheel's edge, the arrows wide
        <Labels
          cx={wheel.cx}
          cy={wheel.cy}
          r={r * 0.8}
          color={skin.wheel.label}
          size={wheel.d * 0.072}
          glyph={0.66}
          wide={0.9}
          spread={1.35}
        />
      )}
      {sunken ? (
        <>
          {/* The gap round the centre button */}
          <circle
            cx={wheel.cx}
            cy={wheel.cy}
            r={m.center / 2 + 0.5}
            fill="none"
            stroke="rgba(70,76,74,0.22)"
            strokeWidth="0.14"
          />
          <Well
            id={u('centerWell')}
            u={u}
            plain={plain}
            cx={wheel.cx}
            cy={wheel.cy}
            r={m.center / 2}
            fill={`url(#${u('center')})`}
          />
        </>
      ) : (
        <circle
          cx={wheel.cx}
          cy={wheel.cy}
          r={m.center / 2}
          fill={`url(#${u('center')})`}
          stroke={skin.wheel.border ? '#9f9f9f' : 'rgba(0,0,0,0.16)'}
          strokeWidth={skin.wheel.border ? 0.35 : 0.25}
        />
      )}
    </svg>
  )
}
